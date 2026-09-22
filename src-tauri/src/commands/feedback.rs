use crate::models::FeedbackInput;
use sqlx::PgPool;
use tauri::State;

#[tauri::command]
pub async fn submit_feedback(pool: State<'_, PgPool>, input: FeedbackInput) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO feedback (id, session_id, difficulty, tags, notes)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT (session_id) DO UPDATE
            SET difficulty = EXCLUDED.difficulty,
                tags = EXCLUDED.tags,
                notes = EXCLUDED.notes",
    )
    .bind(input.session_id)
    .bind(input.difficulty)
    .bind(&input.tags)
    .bind(input.notes)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
