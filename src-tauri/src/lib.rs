mod processes;
mod tools;
mod workspace;
use tauri::Manager;
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.state::<processes::Processes>().shutdown();
    app.restart();
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(workspace::Workspace::default())
        .manage(processes::Processes::default())
        .invoke_handler(tauri::generate_handler![
            restart_app,
            tools::check_web_tools,
            workspace::open_workspace,
            workspace::read_directory,
            workspace::read_text_file,
            workspace::write_text_file,
            workspace::create_entry,
            workspace::rename_entry,
            workspace::trash_entry,
            workspace::search_project,
            workspace::cancel_search,
            processes::start_process,
            processes::poll_process,
            processes::send_process,
            processes::resize_terminal,
            processes::stop_process,
            processes::git_action
        ])
        .build(tauri::generate_context!())
        .expect("error while building SinaIDE")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                app.state::<processes::Processes>().shutdown();
            }
        });
}
