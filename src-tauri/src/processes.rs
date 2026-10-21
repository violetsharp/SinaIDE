use crate::tools::discover_tool;
use crate::workspace::{err, Workspace};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    io::{BufRead, BufReader, Read, Write},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

const BUFFER_LIMIT: usize = 2 * 1024 * 1024;
#[derive(Default)]
struct Output {
    chunks: VecDeque<String>,
    bytes: usize,
    dropped: bool,
    eof: bool,
}
type Queue = Arc<Mutex<Output>>;
fn push(queue: &Queue, s: String) {
    if let Ok(mut q) = queue.lock() {
        q.bytes += s.len();
        q.chunks.push_back(s);
        while q.bytes > BUFFER_LIMIT {
            if let Some(s) = q.chunks.pop_front() {
                q.bytes -= s.len();
                q.dropped = true;
            } else {
                break;
            }
        }
    }
}
fn reader(mut stream: impl Read + Send + 'static, queue: Queue, framed: bool) {
    thread::spawn(move || {
        if framed {
            let mut r = BufReader::new(stream);
            loop {
                match read_frame(&mut r) {
                    Ok(Some(s)) => push(&queue, s),
                    Ok(None) => break,
                    Err(e) => {
                        push(&queue, serde_json::json!({"transportError":e}).to_string());
                        break;
                    }
                }
            }
        } else {
            let mut b = [0; 8192];
            let mut pending = Vec::new();
            while let Ok(n) = stream.read(&mut b) {
                if n == 0 {
                    break;
                }
                pending.extend_from_slice(&b[..n]);
                let valid = match std::str::from_utf8(&pending) {
                    Ok(_) => pending.len(),
                    Err(e) => e.valid_up_to(),
                };
                if valid > 0 {
                    push(&queue, String::from_utf8_lossy(&pending[..valid]).into());
                    pending.drain(..valid);
                }
                if pending.len() > 4 {
                    push(&queue, String::from_utf8_lossy(&pending).into());
                    pending.clear();
                }
            }
            if !pending.is_empty() {
                push(&queue, String::from_utf8_lossy(&pending).into());
            }
        }
        if let Ok(mut q) = queue.lock() {
            q.eof = true;
        }
    });
}
pub fn read_frame(reader: &mut impl BufRead) -> Result<Option<String>, String> {
    let mut length = None;
    let mut total = 0;
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).map_err(err)?;
        if n == 0 {
            return Ok(None);
        }
        total += n;
        if total > 8192 {
            return Err("Protocol headers exceed 8 KiB".into());
        }
        if line == "\r\n" || line == "\n" {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            if k.eq_ignore_ascii_case("Content-Length") {
                length = Some(v.trim().parse::<usize>().map_err(err)?);
            }
        }
    }
    let n = length.ok_or("Protocol message has no Content-Length")?;
    if n > 8 * 1024 * 1024 {
        return Err("Protocol message exceeds 8 MiB".into());
    }
    let mut body = vec![0; n];
    reader.read_exact(&mut body).map_err(err)?;
    String::from_utf8(body).map(Some).map_err(err)
}
enum Handle {
    Pipe(Child),
    Terminal(Box<dyn portable_pty::Child + Send + Sync>),
}
struct Session {
    child: Handle,
    writer: Box<dyn Write + Send>,
    master: Option<Box<dyn MasterPty + Send>>,
    out: Queue,
    errors: Queue,
    started: Instant,
    protocol: bool,
}
#[derive(Default)]
pub struct Processes {
    sessions: Mutex<HashMap<u64, Session>>,
    next: AtomicU64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Poll {
    chunks: Vec<String>,
    errors: Vec<String>,
    dropped: bool,
    finished: bool,
    exit_code: Option<i32>,
    elapsed_ms: u128,
}
fn configure(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            command.pre_exec(|| {
                if libc::setpgid(0, 0) == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
}
fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let mut c = Command::new("taskkill");
        configure(&mut c);
        let _ = c.args(["/PID", &pid.to_string(), "/T", "/F"]).output();
    }
    #[cfg(unix)]
    {
        unsafe {
            libc::kill(-(pid as i32), libc::SIGKILL);
        }
    }
}
fn stop(session: &mut Session) {
    match &mut session.child {
        Handle::Pipe(c) => {
            if matches!(c.try_wait(), Ok(Some(_))) {
                return;
            }
            kill_tree(c.id());
            let _ = c.kill();
            let _ = c.wait();
        }
        Handle::Terminal(c) => {
            if matches!(c.try_wait(), Ok(Some(_))) {
                return;
            }
            if let Some(pid) = c.process_id() {
                kill_tree(pid);
            }
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}
impl Processes {
    pub fn shutdown(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for s in sessions.values_mut() {
                stop(s);
            }
            sessions.clear();
        }
    }
}
impl Drop for Processes {
    fn drop(&mut self) {
        self.shutdown();
    }
}
#[tauri::command(async)]
pub fn start_process(
    executable: String,
    args: Vec<String>,
    cwd: String,
    mode: String,
    workspace: tauri::State<Workspace>,
    processes: tauri::State<Processes>,
) -> Result<u64, String> {
    let executable = discover_tool(&executable).unwrap_or(executable);
    if executable.trim().is_empty() || executable.len() > 4096 || args.len() > 256 {
        return Err("Provide an executable and at most 256 arguments.".into());
    }
    if !["task", "terminal", "protocol"].contains(&mode.as_str()) {
        return Err("Unknown process mode".into());
    }
    let directory = workspace.resolve(&cwd)?;
    if !directory.is_dir() {
        return Err("Working directory must be inside the open project.".into());
    }
    let directory = std::path::PathBuf::from(crate::workspace::display_path(&directory));
    let mut sessions = processes.sessions.lock().map_err(err)?;
    if sessions.len() >= 12 {
        return Err("Close a session before opening more (limit: 12).".into());
    }
    let out = Queue::default();
    let errors = Queue::default();
    let protocol = mode == "protocol";
    let (child, writer, master) = if mode == "terminal" {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 90,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(err)?;
        let mut command = CommandBuilder::new(&executable);
        command.args(&args);
        command.cwd(&directory);
        command.env("TERM", "xterm-256color");
        let child = pair.slave.spawn_command(command).map_err(|e| {
            format!("Could not start {executable}: {e}. Install the tool or set its full path.")
        })?;
        drop(pair.slave);
        reader(
            pair.master.try_clone_reader().map_err(err)?,
            out.clone(),
            false,
        );
        let writer = pair.master.take_writer().map_err(err)?;
        (Handle::Terminal(child), writer, Some(pair.master))
    } else {
        let mut command = Command::new(&executable);
        command
            .args(&args)
            .current_dir(&directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        configure(&mut command);
        let mut child = command.spawn().map_err(|e| {
            format!("Could not start {executable}: {e}. Install the tool or set its full path.")
        })?;
        let writer = Box::new(child.stdin.take().ok_or("No input pipe")?) as Box<dyn Write + Send>;
        reader(
            child.stdout.take().ok_or("No output pipe")?,
            out.clone(),
            protocol,
        );
        reader(
            child.stderr.take().ok_or("No error pipe")?,
            errors.clone(),
            false,
        );
        (Handle::Pipe(child), writer, None)
    };
    let id = processes.next.fetch_add(1, Ordering::Relaxed) + 1;
    sessions.insert(
        id,
        Session {
            child,
            writer,
            master,
            out,
            errors,
            started: Instant::now(),
            protocol,
        },
    );
    Ok(id)
}
#[tauri::command(async)]
pub fn poll_process(id: u64, state: tauri::State<Processes>) -> Result<Poll, String> {
    let mut sessions = state.sessions.lock().map_err(err)?;
    let session = sessions.get_mut(&id).ok_or("Session is closed")?;
    let status = match &mut session.child {
        Handle::Pipe(c) => c.try_wait().map_err(err)?.map(|s| s.code().unwrap_or(-1)),
        Handle::Terminal(c) => c.try_wait().map_err(err)?.map(|s| s.exit_code() as i32),
    };
    let mut out = session.out.lock().map_err(err)?;
    let mut errors = session.errors.lock().map_err(err)?;
    let drained = out.eof && (session.master.is_some() || errors.eof);
    let dropped = out.dropped || errors.dropped;
    out.dropped = false;
    errors.dropped = false;
    out.bytes = 0;
    errors.bytes = 0;
    Ok(Poll {
        chunks: out.chunks.drain(..).collect(),
        errors: errors.chunks.drain(..).collect(),
        dropped,
        finished: status.is_some() && drained,
        exit_code: status,
        elapsed_ms: session.started.elapsed().as_millis(),
    })
}
#[tauri::command(async)]
pub fn send_process(id: u64, data: String, state: tauri::State<Processes>) -> Result<(), String> {
    if data.len() > 8 * 1024 * 1024 {
        return Err("Input too large".into());
    }
    let mut sessions = state.sessions.lock().map_err(err)?;
    let s = sessions.get_mut(&id).ok_or("Session is closed")?;
    if s.protocol {
        write!(s.writer, "Content-Length: {}\r\n\r\n{}", data.len(), data).map_err(err)?;
    } else {
        s.writer.write_all(data.as_bytes()).map_err(err)?;
    }
    s.writer.flush().map_err(err)
}
#[tauri::command(async)]
pub fn resize_terminal(
    id: u64,
    cols: u16,
    rows: u16,
    state: tauri::State<Processes>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(err)?;
    let s = sessions.get(&id).ok_or("Session is closed")?;
    s.master
        .as_ref()
        .ok_or("Not a terminal")?
        .resize(PtySize {
            rows: rows.clamp(2, 500),
            cols: cols.clamp(10, 500),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(err)
}
#[tauri::command(async)]
pub fn stop_process(id: u64, state: tauri::State<Processes>) -> Result<(), String> {
    if let Some(mut s) = state.sessions.lock().map_err(err)?.remove(&id) {
        stop(&mut s);
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct GitResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}
fn bounded_read(mut pipe: impl Read) -> String {
    let mut data = Vec::new();
    let _ = pipe.by_ref().take(8 * 1024 * 1024).read_to_end(&mut data);
    let _ = std::io::copy(&mut pipe, &mut std::io::sink());
    String::from_utf8_lossy(&data).into()
}
#[tauri::command(async)]
pub fn git_action(
    action: String,
    path: Option<String>,
    message: Option<String>,
    state: tauri::State<Workspace>,
) -> Result<GitResult, String> {
    let root = state.root()?;
    let mut c = Command::new("git");
    c.current_dir(crate::workspace::display_path(&root))
        .args(["-c", "core.hooksPath=", "-c", "core.quotePath=false"])
        .env("GIT_TERMINAL_PROMPT", "0");
    match action.as_str() {
        "status" => {
            c.args(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
        }
        "branch" => {
            c.args(["branch", "--show-current"]);
        }
        "diff" | "staged_diff" => {
            c.args(["--no-pager", "diff", "--no-ext-diff", "--no-textconv"]);
            if action == "staged_diff" {
                c.arg("--cached");
            }
            c.arg("--");
            c.arg(path.ok_or("Choose a path")?);
        }
        "stage" => {
            let path = path.ok_or("Choose a path")?;
            crate::workspace::resolve(&root, &path, false)?;
            c.args(["add", "--", &path]);
        }
        "unstage" => {
            c.args(["restore", "--staged", "--", &path.ok_or("Choose a path")?]);
        }
        "commit" => {
            let msg = message.unwrap_or_default();
            if msg.trim().is_empty() || msg.len() > 10000 {
                return Err("Enter a commit message.".into());
            }
            c.args(["commit", "-m", &msg]);
        }
        _ => return Err("Unsupported Git action".into()),
    }
    c.stdout(Stdio::piped()).stderr(Stdio::piped());
    configure(&mut c);
    let mut child = c
        .spawn()
        .map_err(|e| format!("Install Git or add it to PATH: {e}"))?;
    let stdout = child.stdout.take().ok_or("No Git output")?;
    let stderr = child.stderr.take().ok_or("No Git error output")?;
    let a = thread::spawn(move || bounded_read(stdout));
    let b = thread::spawn(move || bounded_read(stderr));
    let start = Instant::now();
    let status = loop {
        if let Some(s) = child.try_wait().map_err(err)? {
            break s;
        }
        if start.elapsed() > Duration::from_secs(30) {
            kill_tree(child.id());
            let _ = child.kill();
            let _ = child.wait();
            return Err("Git timed out after 30 seconds.".into());
        }
        thread::sleep(Duration::from_millis(20));
    };
    Ok(GitResult {
        code: status.code().unwrap_or(-1),
        stdout: a.join().unwrap_or_default(),
        stderr: b.join().unwrap_or_default(),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn frame_handles_utf8_and_back_to_back_messages() {
        let text = "{\"text\":\"olá ✦\"}";
        let input = format!(
            "Content-Length: {}\r\n\r\n{}Content-Length: 2\r\n\r\n{{}}",
            text.len(),
            text
        );
        let mut r = std::io::Cursor::new(input.into_bytes());
        assert_eq!(read_frame(&mut r).unwrap().unwrap(), text);
        assert_eq!(read_frame(&mut r).unwrap().unwrap(), "{}");
        assert!(read_frame(&mut r).unwrap().is_none());
    }
    #[test]
    fn rejects_malformed_frames() {
        assert!(read_frame(&mut std::io::Cursor::new(
            b"Content-Length: 999999999\r\n\r\n"
        ))
        .is_err());
    }
    #[test]
    fn bounded_output_reports_truncation() {
        let q = Queue::default();
        push(&q, "a".repeat(BUFFER_LIMIT));
        push(&q, "b".into());
        let output = q.lock().unwrap();
        assert!(output.dropped);
        assert!(output.bytes <= BUFFER_LIMIT);
    }
}
