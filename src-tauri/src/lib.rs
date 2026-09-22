mod commands;
mod db;
mod models;

use commands::feedback::submit_feedback;
use commands::profiles::{create_profile, delete_profile, list_profiles};
use commands::progress::{export_sessions_json, get_progress_stats};
use commands::sessions::{complete_session, create_session, list_recent_sessions, log_session_event};
use commands::skills::list_skills_by_path;
use commands::tabs::{create_tab, delete_tab, get_tab, list_tabs, open_tab_file, update_tab};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::connect_and_migrate())
                .expect("failed to connect to Postgres / run migrations");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_profiles,
            create_profile,
            delete_profile,
            list_skills_by_path,
            create_session,
            log_session_event,
            complete_session,
            list_recent_sessions,
            submit_feedback,
            get_progress_stats,
            export_sessions_json,
            list_tabs,
            get_tab,
            create_tab,
            update_tab,
            delete_tab,
            open_tab_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
