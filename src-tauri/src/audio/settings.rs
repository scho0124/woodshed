use serde::{Deserialize, Serialize};
use sqlx::PgPool;

/// Machine-wide audio input settings, stored under the `audio` key of `app_settings`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    /// cpal device id ("host:device"); None means pick automatically.
    pub device_id: Option<String>,
    /// The mic for vocal mic checks, kept apart so the guitar input doesn't
    /// change; None means pick automatically.
    pub voice_device_id: Option<String>,
    /// Input channel to listen to; None mixes all channels together.
    pub channel: Option<u16>,
    /// Anything quieter than this is treated as silence.
    pub gate_db: f32,
    /// Tuner reference pitch.
    pub a4_hz: f32,
}

impl Default for AudioSettings {
    fn default() -> Self {
        Self { device_id: None, voice_device_id: None, channel: None, gate_db: -55.0, a4_hz: 440.0 }
    }
}

pub async fn load(pool: &PgPool) -> Result<AudioSettings, sqlx::Error> {
    let value: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT value FROM app_settings WHERE key = 'audio'")
            .fetch_optional(pool)
            .await?;
    Ok(value.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default())
}

pub async fn save(pool: &PgPool, mut settings: AudioSettings) -> Result<AudioSettings, sqlx::Error> {
    settings.gate_db = settings.gate_db.clamp(-90.0, -10.0);
    settings.a4_hz = settings.a4_hz.clamp(415.0, 466.0);
    sqlx::query(
        "INSERT INTO app_settings (key, value) VALUES ('audio', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(serde_json::to_value(&settings).expect("settings serialize"))
    .execute(pool)
    .await?;
    Ok(settings)
}
