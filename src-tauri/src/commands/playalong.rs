use crate::models::{NewPlayAlongRun, PlayAlongRunSummary};
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

const SUMMARY_COLUMNS: &str = "id, tab_id, started_at, ended_at, completed, notes_played, \
                               first_try_hits, retried_hits, skipped, wrong_notes";

#[tauri::command]
pub async fn create_playalong_run(
    pool: State<'_, PgPool>,
    input: NewPlayAlongRun,
) -> Result<PlayAlongRunSummary, String> {
    sqlx::query_as::<_, PlayAlongRunSummary>(&format!(
        "INSERT INTO playalong_runs
            (profile_id, tab_id, started_at, ended_at, completed, notes_played,
             first_try_hits, retried_hits, skipped, wrong_notes, settings, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING {SUMMARY_COLUMNS}"
    ))
    .bind(input.profile_id)
    .bind(input.tab_id)
    .bind(input.started_at)
    .bind(input.ended_at)
    .bind(input.completed)
    .bind(input.notes_played)
    .bind(input.first_try_hits)
    .bind(input.retried_hits)
    .bind(input.skipped)
    .bind(input.wrong_notes)
    .bind(input.settings)
    .bind(input.details)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_playalong_runs(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
    tab_id: Uuid,
) -> Result<Vec<PlayAlongRunSummary>, String> {
    sqlx::query_as::<_, PlayAlongRunSummary>(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM playalong_runs
         WHERE profile_id = $1 AND tab_id = $2
         ORDER BY started_at DESC LIMIT 50"
    ))
    .bind(profile_id)
    .bind(tab_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
