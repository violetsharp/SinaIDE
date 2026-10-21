use crate::workspace::err;
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
pub fn discover_tool(name: &str) -> Option<String> {
    if Path::new(name).is_absolute() {
        return Some(name.into());
    }
    let filename = if cfg!(windows) && Path::new(name).extension().is_none() {
        format!("{name}.exe")
    } else {
        name.into()
    };
    if let Some(paths) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&paths) {
            let file = directory.join(&filename);
            if file.is_file() {
                return Some(file.to_string_lossy().into());
            }
        }
    }
    // Finder-launched apps do not normally inherit a login shell's Homebrew PATH.
    #[cfg(target_os = "macos")]
    for directory in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/homebrew/opt/libpq/bin",
        "/usr/local/opt/libpq/bin",
    ] {
        let file = Path::new(directory).join(&filename);
        if file.is_file() {
            return Some(file.to_string_lossy().into());
        }
    }
    #[cfg(windows)]
    if name == "psql" {
        let directory = PathBuf::from(std::env::var_os("ProgramFiles")?).join("PostgreSQL");
        let mut versions: Vec<_> = std::fs::read_dir(directory)
            .ok()?
            .filter_map(Result::ok)
            .collect();
        versions.sort_by_key(|d| {
            std::cmp::Reverse(d.file_name().to_string_lossy().parse::<u32>().unwrap_or(0))
        });
        for version in versions {
            let file = version.path().join("bin/psql.exe");
            if file.is_file() {
                return Some(file.to_string_lossy().into());
            }
        }
    }
    None
}
fn inspect(exe: &str, args: &[&str]) -> Result<String, String> {
    let mut c = Command::new(exe);
    c.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000);
    }
    let mut child = c.spawn().map_err(err)?;
    let started = Instant::now();
    loop {
        if child.try_wait().map_err(err)?.is_some() {
            let out = child.wait_with_output().map_err(err)?;
            return Ok(format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            ));
        }
        if started.elapsed() > Duration::from_secs(5) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Tool check timed out".into());
        }
        thread::sleep(Duration::from_millis(20));
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub php: Option<String>,
    pub psql: Option<String>,
    pub git: Option<String>,
    pub php_version: String,
    pub psql_version: String,
    pub php_postgres: bool,
    pub php_extension_dir: Option<String>,
}
#[tauri::command(async)]
pub fn check_web_tools() -> Result<ToolStatus, String> {
    let php = discover_tool("php");
    let psql = discover_tool("psql");
    let git = discover_tool("git");
    let php_version = php
        .as_ref()
        .map(|p| inspect(p, &["--version"]).unwrap_or_else(err))
        .unwrap_or("PHP is not installed or not on PATH.".into());
    let psql_version = psql
        .as_ref()
        .map(|p| inspect(p, &["--version"]).unwrap_or_else(err))
        .unwrap_or("PostgreSQL client not found. Install psql or enter its full path.".into());
    let php_postgres = php.as_ref().is_some_and(|p| {
        inspect(
            p,
            &[
                "-r",
                "echo extension_loaded('pdo_pgsql') ? 'ready' : 'missing';",
            ],
        )
        .is_ok_and(|s| s == "ready")
    });
    let php_extension_dir = php
        .as_ref()
        .and_then(|p| PathBuf::from(p).parent().map(|p| p.join("ext")))
        .filter(|p| p.join("php_pdo_pgsql.dll").is_file() && p.join("php_pgsql.dll").is_file())
        .map(|p| p.to_string_lossy().into());
    Ok(ToolStatus {
        php,
        psql,
        git,
        php_version,
        psql_version,
        php_postgres,
        php_extension_dir,
    })
}
