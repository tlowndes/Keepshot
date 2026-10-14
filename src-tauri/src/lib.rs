//! Keepshot desktop shell. The UI and all media logic live in TypeScript;
//! this side owns things only native code can do: processes, the tray,
//! global shortcuts, extra windows and the clipboard.
mod config;
mod files;
mod hotkeys;
mod platform;
mod recorder;
mod tools;
mod tray;
mod windows;

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_opener::OpenerExt;

pub struct AppState {
    pub config: Mutex<config::AppConfig>,
    pub recording: Mutex<Option<recorder::Recording>>,
    pub hotkeys: Mutex<HashMap<u32, String>>,
}

#[tauri::command]
fn app_config(state: State<'_, AppState>) -> Result<config::AppConfig, String> {
    state.config.lock().map(|c| c.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_image(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    let root = state.config.lock().map_err(|e| e.to_string())?.data_dir.clone();
    if !config::is_inside(&root, std::path::Path::new(&path)) {
        return Err("Only files in the Keepshot folder can be copied.".into());
    }
    let image = tauri::image::Image::from_path(&path).map_err(|e| format!("Couldn't read the image: {e}"))?;
    app.clipboard().write_image(&image).map_err(|e| format!("Couldn't copy to the clipboard: {e}"))
}

#[tauri::command]
fn open_mic_settings(app: AppHandle) -> Result<(), String> {
    app.opener().open_url("ms-settings:privacy-microphone", None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_data_folder(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let dir = state.config.lock().map_err(|e| e.to_string())?.data_dir.clone();
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    windows::show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    config::load_env();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| windows::show_main(app)))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(hotkeys::plugin())
        .setup(|app| {
            let cfg = config::resolve(app.handle());
            std::fs::create_dir_all(&cfg.data_dir)?;
            // Let the webview play videos and show images from the data folder only.
            app.asset_protocol_scope().allow_directory(&cfg.data_dir, true)?;
            app.manage(AppState {
                config: Mutex::new(cfg),
                recording: Mutex::new(None),
                hotkeys: Mutex::new(HashMap::new()),
            });
            tray::build(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window keeps Keepshot running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_config,
            copy_image,
            open_mic_settings,
            open_data_folder,
            show_main_window,
            tools::run_tool,
            tools::tool_available,
            files::fs_exists,
            files::fs_mkdirp,
            files::fs_read_text,
            files::fs_write_text,
            files::fs_remove,
            files::fs_remove_dir,
            files::fs_size,
            files::fs_list,
            files::data_size,
            platform::list_windows,
            windows::open_region_picker,
            recorder::rec_start,
            recorder::rec_toggle_pause,
            recorder::rec_stop,
            recorder::rec_status,
            hotkeys::set_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Keepshot");
}
