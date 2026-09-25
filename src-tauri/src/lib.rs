mod audio;
mod commands;
mod db;
mod models;
mod player;
mod tutorials;

use audio::capture::AudioState;
use commands::audio::{
    get_audio_settings, list_audio_inputs, set_audio_consent, set_audio_settings, start_audio_input,
    stop_audio_input,
};
use commands::feedback::submit_feedback;
use commands::playalong::{create_playalong_run, list_playalong_runs};
use commands::profiles::{create_profile, delete_profile, list_profiles};
use commands::progress::{export_sessions_json, get_progress_stats};
use commands::sessions::{complete_session, create_session, list_recent_sessions, log_session_event};
use commands::skills::list_skills_by_path;
use commands::tutorials::{get_skill_tutorial, watch_tutorial};
use commands::tabs::{create_tab, delete_tab, get_tab, list_tabs, open_tab_file, update_tab};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::connect_and_migrate())
                .expect("failed to connect to Postgres / run migrations");
            app.manage(pool);
            app.manage(Arc::new(AudioState::default()));
            Ok(())
        })
        // A tutorial left playing shouldn't keep the app running.
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(player) = window.app_handle().get_webview_window(player::LABEL) {
                    let _ = player.close();
                }
            }
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
            list_audio_inputs,
            get_audio_settings,
            set_audio_settings,
            set_audio_consent,
            start_audio_input,
            stop_audio_input,
            create_playalong_run,
            list_playalong_runs,
            get_skill_tutorial,
            watch_tutorial,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
