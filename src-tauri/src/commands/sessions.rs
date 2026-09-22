use crate::models::{
    CompleteSessionInput, LogEventInput, NewSessionInput, Session, SessionSummary,
};
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn create_session(
    pool: State<'_, PgPool>,
    input: NewSessionInput,
) -> Result<Session, String> {
    sqlx::query_as::<_, Session>(
        "INSERT INTO sessions
            (id, profile_id, skill_id, sets_planned, reps_per_set_planned, tempo_start, settings_snapshot)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
         RETURNING id, profile_id, skill_id, started_at, ended_at, sets_planned,
                   reps_per_set_planned, sets_completed, reps_completed, misses,
                   tempo_start, tempo_end, settings_snapshot",
    )
    .bind(input.profile_id)
    .bind(input.skill_id)
    .bind(input.sets_planned)
    .bind(input.reps_per_set_planned)
    .bind(input.tempo_start)
    .bind(input.settings_snapshot)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn log_session_event(
    pool: State<'_, PgPool>,
    input: LogEventInput,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO session_events (session_id, seq, event_type, payload)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(input.session_id)
    .bind(input.seq)
    .bind(input.event_type)
    .bind(input.payload)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn complete_session(
    pool: State<'_, PgPool>,
    input: CompleteSessionInput,
) -> Result<Session, String> {
    sqlx::query_as::<_, Session>(
        "UPDATE sessions
         SET ended_at = now(), sets_completed = $2, reps_completed = $3,
             misses = $4, tempo_end = $5
         WHERE id = $1
         RETURNING id, profile_id, skill_id, started_at, ended_at, sets_planned,
                   reps_per_set_planned, sets_completed, reps_completed, misses,
                   tempo_start, tempo_end, settings_snapshot",
    )
    .bind(input.session_id)
    .bind(input.sets_completed)
    .bind(input.reps_completed)
    .bind(input.misses)
    .bind(input.tempo_end)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_recent_sessions(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
    limit: i64,
) -> Result<Vec<SessionSummary>, String> {
    sqlx::query_as::<_, SessionSummary>(
        "SELECT
            sess.id, sess.skill_id, sk.name AS skill_name, sk.path::text AS path,
            sess.started_at, sess.ended_at, sess.sets_completed, sess.reps_completed,
            sess.tempo_start, sess.tempo_end, fb.difficulty
        FROM sessions sess
        JOIN skills sk ON sk.id = sess.skill_id
        LEFT JOIN feedback fb ON fb.session_id = sess.id
        WHERE sess.profile_id = $1 AND sess.ended_at IS NOT NULL
        ORDER BY sess.started_at DESC
        LIMIT $2",
    )
    .bind(profile_id)
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
