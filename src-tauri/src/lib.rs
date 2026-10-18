use serde::Serialize;
use std::{fs, path::Path};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    path: String,
    kind: String,
    hidden: bool,
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    let entries = fs::read_dir(root).map_err(|error| error.to_string())?;
    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let kind = if file_path.is_dir() { "directory" } else { "file" }.to_string();
        let hidden = name.starts_with('.');
        files.push(FileEntry {
            name,
            path: file_path.to_string_lossy().into_owned(),
            kind,
            hidden,
        });
    }

    files.sort_by(|a, b| {
        let a_is_dir = a.kind == "directory";
        let b_is_dir = b.kind == "directory";
        b_is_dir.cmp(&a_is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("Not a file: {}", file_path.display()));
    }
    fs::read_to_string(file_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("Refusing to create or overwrite an unknown path: {}", file_path.display()));
    }
    fs::write(file_path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_text_file,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running SinaIDE");
}
