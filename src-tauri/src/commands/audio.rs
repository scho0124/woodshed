use crate::audio::analysis::{AudioEvent, InstrumentRange};
use crate::audio::capture::{AudioState, StartedInput};
use crate::audio::devices::{self, AudioInputInfo};
use crate::audio::settings::{self, AudioSettings};
use crate::models::Profile;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_audio_inputs() -> Result<Vec<AudioInputInfo>, String> {
    tauri::async_runtime::spawn_blocking(devices::list_inputs)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_audio_settings(pool: State<'_, PgPool>) -> Result<AudioSettings, String> {
    settings::load(pool.inner()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_audio_settings(
    pool: State<'_, PgPool>,
    settings: AudioSettings,
) -> Result<AudioSettings, String> {
    settings::save(pool.inner(), settings).await.map_err(|e| e.to_string())
}

/// Records or withdraws a profile's permission to use the audio input.
/// Withdrawing also stops any capture that is running.
#[tauri::command]
pub async fn set_audio_consent(
    pool: State<'_, PgPool>,
    audio: State<'_, Arc<AudioState>>,
    profile_id: Uuid,
    granted: bool,
) -> Result<Profile, String> {
    let profile = sqlx::query_as::<_, Profile>(
        "UPDATE profiles SET audio_consent_at = CASE WHEN $2 THEN now() ELSE NULL END
         WHERE id = $1
         RETURNING id, name, color, created_at, audio_consent_at",
    )
    .bind(profile_id)
    .bind(granted)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if !granted {
        let audio = audio.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || audio.stop(None)).await;
    }
    Ok(profile)
}

/// Starts listening on the configured input and streams analysis events to
/// `on_event`. Refuses unless this profile has given permission.
#[tauri::command]
pub async fn start_audio_input(
    pool: State<'_, PgPool>,
    audio: State<'_, Arc<AudioState>>,
    profile_id: Uuid,
    range: InstrumentRange,
    on_event: Channel<AudioEvent>,
) -> Result<StartedInput, String> {
    let consent: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT audio_consent_at FROM profiles WHERE id = $1")
            .bind(profile_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    if consent.is_none() {
        return Err("Woodshed needs your permission before it can listen to the audio input.".into());
    }

    let settings = settings::load(pool.inner()).await.map_err(|e| e.to_string())?;
    let audio = audio.inner().clone();
    tauri::async_runtime::spawn_blocking(move || audio.start(settings, range, on_event))
        .await
        .map_err(|e| e.to_string())?
}

/// Stops capture. Pass the `session` from `start_audio_input` so a stop that
/// arrives late can't end a newer capture; omit it to stop whatever is running.
#[tauri::command]
pub async fn stop_audio_input(audio: State<'_, Arc<AudioState>>, session: Option<u64>) -> Result<(), String> {
    let audio = audio.inner().clone();
    tauri::async_runtime::spawn_blocking(move || audio.stop(session))
        .await
        .map_err(|e| e.to_string())
}
