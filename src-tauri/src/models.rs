use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Profile {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

/// A skill joined with this profile's aggregate progress against it,
/// which is what the skill list screen renders per card.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SkillWithProgress {
    pub id: String,
    pub path: String,
    pub category: String,
    pub name: String,
    pub description: String,
    pub generator_type: String,
    pub config: serde_json::Value,
    pub mastery_reps: i32,
    pub sort_order: i32,
    pub total_reps: i64,
    pub last_practiced_at: Option<DateTime<Utc>>,
    pub best_tempo: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub skill_id: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub sets_planned: i32,
    pub reps_per_set_planned: i32,
    pub sets_completed: i32,
    pub reps_completed: i32,
    pub misses: i32,
    pub tempo_start: Option<i32>,
    pub tempo_end: Option<i32>,
    pub settings_snapshot: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SessionSummary {
    pub id: Uuid,
    pub skill_id: String,
    pub skill_name: String,
    pub path: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub sets_completed: i32,
    pub reps_completed: i32,
    pub tempo_start: Option<i32>,
    pub tempo_end: Option<i32>,
    pub difficulty: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressStats {
    pub total_sessions: i64,
    pub current_streak_days: i64,
    pub total_practice_seconds: i64,
    pub skills_mastered: i64,
    pub weekly_session_counts: Vec<WeekCount>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WeekCount {
    pub week_start: DateTime<Utc>,
    pub session_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct NewSessionInput {
    pub profile_id: Uuid,
    pub skill_id: String,
    pub sets_planned: i32,
    pub reps_per_set_planned: i32,
    pub tempo_start: Option<i32>,
    pub settings_snapshot: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct LogEventInput {
    pub session_id: Uuid,
    pub seq: i32,
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CompleteSessionInput {
    pub session_id: Uuid,
    pub sets_completed: i32,
    pub reps_completed: i32,
    pub misses: i32,
    pub tempo_end: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct FeedbackInput {
    pub session_id: Uuid,
    pub difficulty: String,
    pub tags: Vec<String>,
    pub notes: String,
}

/// Tab metadata for the library list; the file itself is only loaded when opened.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TabSummary {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub tuning: String,
    pub file_name: String,
    pub mime_type: String,
    pub created_at: DateTime<Utc>,
}

/// A tab opened in the viewer. `content` is set for text tabs only.
#[derive(Debug, Serialize, Deserialize)]
pub struct TabDetail {
    #[serde(flatten)]
    pub summary: TabSummary,
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NewTabInput {
    pub profile_id: Uuid,
    pub title: String,
    pub artist: String,
    pub tuning: String,
    pub file_name: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTabInput {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub tuning: String,
}
