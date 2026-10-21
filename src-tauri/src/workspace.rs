use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

pub const MAX_TEXT: u64 = 2 * 1024 * 1024;
#[derive(Default)]
pub struct Workspace {
    pub root: Mutex<Option<PathBuf>>,
    pub writes: Mutex<()>,
    pub search: AtomicU64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub hidden: bool,
    pub symlink: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub path: String,
    pub contents: String,
    pub revision: String,
    pub uri: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub root: String,
    pub uri: String,
    pub entries: Vec<Entry>,
}
pub fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub fn display_path(path: &Path) -> String {
    let path = path.to_string_lossy().into_owned();
    #[cfg(windows)]
    {
        if let Some(unc) = path.strip_prefix("\\\\?\\UNC\\") {
            return format!("\\\\{unc}");
        }
        if let Some(drive) = path.strip_prefix("\\\\?\\") {
            return drive.into();
        }
    }
    path
}
pub fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
impl Workspace {
    pub fn root(&self) -> Result<PathBuf, String> {
        self.root
            .lock()
            .map_err(err)?
            .clone()
            .ok_or("Open a project first.".into())
    }
    pub fn resolve(&self, path: &str) -> Result<PathBuf, String> {
        resolve(&self.root()?, path, true)
    }
}
pub fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
pub fn resolve(root: &Path, path: &str, exists: bool) -> Result<PathBuf, String> {
    let canonical_root = root.canonicalize().map_err(err)?;
    let root = canonical_root.as_path();
    let rel = Path::new(path);
    if rel.is_absolute()
        || rel
            .components()
            .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
    {
        return Err("Use a path inside the open project; parent traversal is not allowed.".into());
    }
    let joined = root.join(rel);
    let checked = if exists {
        joined.canonicalize().map_err(err)?
    } else {
        let parent = joined
            .parent()
            .ok_or("Missing parent folder")?
            .canonicalize()
            .map_err(err)?;
        parent.join(joined.file_name().ok_or("Missing file name")?)
    };
    if !checked.starts_with(root) {
        return Err("This path leaves the project (possibly through a symlink).".into());
    }
    Ok(checked)
}
pub fn entries(root: &Path, directory: &Path) -> Result<Vec<Entry>, String> {
    let mut result = Vec::new();
    for e in fs::read_dir(directory).map_err(err)? {
        let e = e.map_err(err)?;
        let name = e.file_name().to_string_lossy().into_owned();
        let symlink = e.file_type().map_err(err)?.is_symlink();
        result.push(Entry {
            name: name.clone(),
            path: relative(root, &e.path()),
            kind: if e.path().is_dir() {
                "directory"
            } else {
                "file"
            }
            .into(),
            hidden: name.starts_with('.'),
            symlink,
        });
    }
    result.sort_by(|a, b| {
        (a.kind != "directory")
            .cmp(&(b.kind != "directory"))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(result)
}
pub fn read(root: &Path, path: &str) -> Result<Document, String> {
    let target = resolve(root, path, true)?;
    if !target.is_file() {
        return Err("Choose a regular text file.".into());
    }
    if fs::metadata(&target).map_err(err)?.len() > MAX_TEXT {
        return Err(
            "This file exceeds the 2 MiB text-editor limit. Use an external tool for large files."
                .into(),
        );
    }
    let mut bytes = Vec::new();
    fs::File::open(&target)
        .map_err(err)?
        .take(MAX_TEXT + 1)
        .read_to_end(&mut bytes)
        .map_err(err)?;
    if bytes.len() as u64 > MAX_TEXT || bytes.contains(&0) {
        return Err("Binary or oversized files cannot be edited as text.".into());
    }
    let contents = String::from_utf8(bytes.clone())
        .map_err(|_| "This is not UTF-8 text. Convert it before editing.")?;
    Ok(Document {
        path: relative(root, &target),
        contents,
        revision: revision(&bytes),
        uri: url::Url::from_file_path(&target)
            .map_err(|_| "Invalid file URI")?
            .into(),
    })
}
pub fn save(root: &Path, path: &str, contents: &str, expected: &str) -> Result<String, String> {
    if contents.len() as u64 > MAX_TEXT || contents.contains('\0') {
        return Err("Text exceeds the editor's safe size or contains binary data.".into());
    }
    let target = resolve(root, path, true)?;
    let before = read(root, path)?;
    if before.revision != expected {
        return Err("File changed on disk. Your edits are still here. Reload the disk version or save your edits as another file.".into());
    }
    let mut temp =
        tempfile::NamedTempFile::new_in(target.parent().ok_or("Missing parent")?).map_err(err)?;
    temp.as_file()
        .set_permissions(fs::metadata(&target).map_err(err)?.permissions())
        .map_err(err)?;
    temp.write_all(contents.as_bytes()).map_err(err)?;
    temp.as_file().sync_all().map_err(err)?;
    // Recheck immediately before the atomic replacement. External editors are not locked.
    if read(root, path)?.revision != expected {
        return Err("File changed during save. Your buffer was preserved.".into());
    }
    temp.persist(&target).map_err(err)?;
    Ok(revision(contents.as_bytes()))
}
#[tauri::command(async)]
pub fn open_workspace(path: String, state: tauri::State<Workspace>) -> Result<Project, String> {
    let _guard = state.writes.lock().map_err(err)?;
    let root = PathBuf::from(path).canonicalize().map_err(err)?;
    if !root.is_dir() {
        return Err("Choose a project folder.".into());
    }
    let list = entries(&root, &root)?;
    let uri = url::Url::from_directory_path(&root)
        .map_err(|_| "Invalid project URI")?
        .into();
    *state.root.lock().map_err(err)? = Some(root.clone());
    state.search.fetch_add(1, Ordering::SeqCst);
    Ok(Project {
        root: display_path(&root),
        uri,
        entries: list,
    })
}
#[tauri::command(async)]
pub fn read_directory(path: String, state: tauri::State<Workspace>) -> Result<Vec<Entry>, String> {
    let root = state.root()?;
    entries(&root, &resolve(&root, &path, true)?)
}
#[tauri::command(async)]
pub fn read_text_file(path: String, state: tauri::State<Workspace>) -> Result<Document, String> {
    read(&state.root()?, &path)
}
#[tauri::command(async)]
pub fn write_text_file(
    path: String,
    contents: String,
    expected: String,
    state: tauri::State<Workspace>,
) -> Result<String, String> {
    let _guard = state.writes.lock().map_err(err)?;
    save(&state.root()?, &path, &contents, &expected)
}
#[tauri::command(async)]
pub fn create_entry(
    path: String,
    directory: bool,
    state: tauri::State<Workspace>,
) -> Result<(), String> {
    let _guard = state.writes.lock().map_err(err)?;
    let root = state.root()?;
    let dest = resolve(&root, &path, false)?;
    if directory {
        fs::create_dir(dest).map_err(err)
    } else {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dest)
            .map(|_| ())
            .map_err(err)
    }
}
#[tauri::command(async)]
pub fn rename_entry(
    path: String,
    destination: String,
    state: tauri::State<Workspace>,
) -> Result<(), String> {
    let _guard = state.writes.lock().map_err(err)?;
    let root = state.root()?;
    let source = resolve(&root, &path, true)?;
    let dest = resolve(&root, &destination, false)?;
    if source == root || dest.exists() || dest.starts_with(&source) {
        return Err("Cannot replace an existing path or move a folder into itself.".into());
    }
    fs::rename(source, dest).map_err(err)
}
#[tauri::command(async)]
pub fn trash_entry(path: String, state: tauri::State<Workspace>) -> Result<String, String> {
    let _guard = state.writes.lock().map_err(err)?;
    let root = state.root()?;
    let target = resolve(&root, &path, true)?;
    if target == root || path.starts_with(".sinaide/") {
        return Err("Cannot remove the project or SinaIDE recovery folder.".into());
    }
    let trash = root.join(".sinaide");
    if !trash.exists() {
        fs::create_dir(&trash).map_err(err)?;
    }
    let trash = resolve(&root, ".sinaide", true)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(err)?
        .as_nanos();
    let dest = trash.join(format!(
        "{stamp}-{}",
        target.file_name().ok_or("Missing name")?.to_string_lossy()
    ));
    fs::rename(target, &dest).map_err(err)?;
    Ok(relative(&root, &dest))
}
#[derive(Serialize)]
pub struct SearchHit {
    pub path: String,
    pub line: usize,
    pub preview: String,
}
#[derive(Serialize)]
pub struct SearchResults {
    pub hits: Vec<SearchHit>,
    pub truncated: bool,
    pub skipped: usize,
    pub cancelled: bool,
}
#[tauri::command]
pub fn cancel_search(state: tauri::State<Workspace>) {
    state.search.fetch_add(1, Ordering::SeqCst);
}
#[tauri::command(async)]
pub fn search_project(
    query: String,
    case_sensitive: bool,
    filenames: bool,
    excludes: Vec<String>,
    state: tauri::State<Workspace>,
) -> Result<SearchResults, String> {
    if query.is_empty() || query.len() > 512 {
        return Err("Enter 1–512 characters to search.".into());
    }
    let root = state.root()?;
    let ticket = state.search.fetch_add(1, Ordering::SeqCst) + 1;
    let mut result = SearchResults {
        hits: Vec::new(),
        truncated: false,
        skipped: 0,
        cancelled: false,
    };
    let needle = if case_sensitive {
        query
    } else {
        query.to_lowercase()
    };
    let matches = |v: &str| {
        if case_sensitive {
            v.contains(&needle)
        } else {
            v.to_lowercase().contains(&needle)
        }
    };
    let mut walk = ignore::WalkBuilder::new(&root);
    walk.hidden(false).follow_links(false).require_git(false);
    let excluded = excludes;
    walk.filter_entry(move |e| {
        ![
            ".git",
            "node_modules",
            "target",
            "dist",
            "build",
            ".sinaide",
        ]
        .contains(&e.file_name().to_string_lossy().as_ref())
            && !excluded
                .iter()
                .any(|x| e.file_name() == std::ffi::OsStr::new(x))
    });
    for entry in walk.build() {
        if ticket != state.search.load(Ordering::SeqCst) {
            result.cancelled = true;
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                result.skipped += 1;
                continue;
            }
        };
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let path = relative(&root, entry.path());
        if filenames {
            if matches(&path) {
                result.hits.push(SearchHit {
                    path,
                    line: 1,
                    preview: "filename match".into(),
                });
            }
        } else {
            match read(&root, &path) {
                Ok(doc) => {
                    for (i, line) in doc.contents.lines().enumerate() {
                        if matches(line) {
                            result.hits.push(SearchHit {
                                path: path.clone(),
                                line: i + 1,
                                preview: line.chars().take(240).collect(),
                            });
                            if result.hits.len() >= 1000 {
                                break;
                            }
                        }
                    }
                }
                Err(_) => result.skipped += 1,
            }
        }
        if result.hits.len() >= 1000 {
            result.truncated = true;
            break;
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn traversal_and_absolute_paths_are_rejected() {
        let d = tempfile::tempdir().unwrap();
        assert!(resolve(d.path(), "../secret", false).is_err());
        assert!(resolve(d.path(), d.path().to_str().unwrap(), true).is_err());
    }
    #[test]
    fn external_changes_preserve_disk_and_buffer() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("a"), "first").unwrap();
        let doc = read(d.path(), "a").unwrap();
        fs::write(d.path().join("a"), "external").unwrap();
        assert!(save(d.path(), "a", "mine", &doc.revision).is_err());
        assert_eq!(fs::read_to_string(d.path().join("a")).unwrap(), "external");
    }
    #[test]
    fn unicode_and_atomic_save_roundtrip() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("lua ✦.rs"), "olá\r\n").unwrap();
        let doc = read(d.path(), "lua ✦.rs").unwrap();
        let rev = save(d.path(), "lua ✦.rs", "new\r\n", &doc.revision).unwrap();
        assert_eq!(read(d.path(), "lua ✦.rs").unwrap().revision, rev);
    }
    #[test]
    fn binary_and_large_files_rejected() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("bin"), [1, 0, 2]).unwrap();
        assert!(read(d.path(), "bin").is_err());
        fs::write(d.path().join("big"), vec![b'a'; MAX_TEXT as usize + 1]).unwrap();
        assert!(read(d.path(), "big").is_err());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_escape_rejected() {
        let d = tempfile::tempdir().unwrap();
        let out = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(out.path(), d.path().join("link")).unwrap();
        assert!(resolve(d.path(), "link", true).is_err());
    }
}
