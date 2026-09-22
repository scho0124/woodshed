use crate::models::SkillWithProgress;
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_skills_by_path(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
    path: String,
) -> Result<Vec<SkillWithProgress>, String> {
    sqlx::query_as::<_, SkillWithProgress>(
        "SELECT
            s.id, s.path::text AS path, s.category, s.name, s.description,
            s.generator_type, s.config, s.mastery_reps, s.sort_order,
            COALESCE(SUM(sess.reps_completed), 0) AS total_reps,
            MAX(sess.ended_at) AS last_practiced_at,
            MAX(sess.tempo_end) AS best_tempo
        FROM skills s
        LEFT JOIN sessions sess
            ON sess.skill_id = s.id
            AND sess.profile_id = $1
            AND sess.ended_at IS NOT NULL
        WHERE s.path::text = $2
        GROUP BY s.id
        ORDER BY s.sort_order",
    )
    .bind(profile_id)
    .bind(path)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
