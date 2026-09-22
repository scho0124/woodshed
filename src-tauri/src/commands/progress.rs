use crate::models::{ProgressStats, WeekCount};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde_json::json;
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn get_progress_stats(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
) -> Result<ProgressStats, String> {
    let pool = pool.inner();

    let total_sessions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sessions WHERE profile_id = $1 AND ended_at IS NOT NULL",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_practice_seconds: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)))::BIGINT, 0)
         FROM sessions WHERE profile_id = $1 AND ended_at IS NOT NULL",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let skills_mastered: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (
            SELECT sk.id, COALESCE(SUM(sess.reps_completed), 0) AS total_reps, sk.mastery_reps
            FROM skills sk
            LEFT JOIN sessions sess
                ON sess.skill_id = sk.id AND sess.profile_id = $1 AND sess.ended_at IS NOT NULL
            GROUP BY sk.id, sk.mastery_reps
         ) t WHERE total_reps >= mastery_reps",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let dates: Vec<NaiveDate> = sqlx::query_scalar(
        "SELECT DISTINCT date(started_at) FROM sessions
         WHERE profile_id = $1 AND ended_at IS NOT NULL ORDER BY 1 DESC",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let current_streak_days = compute_streak(&dates);

    let weekly_session_counts = sqlx::query_as::<_, WeekCount>(
        "SELECT date_trunc('week', started_at) AS week_start, COUNT(*) AS session_count
         FROM sessions
         WHERE profile_id = $1 AND ended_at IS NOT NULL
           AND started_at >= now() - interval '8 weeks'
         GROUP BY 1 ORDER BY 1",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(ProgressStats {
        total_sessions,
        current_streak_days,
        total_practice_seconds,
        skills_mastered,
        weekly_session_counts,
    })
}

fn compute_streak(dates_desc: &[NaiveDate]) -> i64 {
    if dates_desc.is_empty() {
        return 0;
    }
    let today = Utc::now().date_naive();
    let mut expected = today;
    if dates_desc[0] != today {
        expected = today - Duration::days(1);
        if dates_desc[0] != expected {
            return 0;
        }
    }
    let mut streak = 0i64;
    for d in dates_desc {
        if *d == expected {
            streak += 1;
            expected -= Duration::days(1);
        } else if *d < expected {
            break;
        }
    }
    streak
}

#[derive(sqlx::FromRow)]
struct ExportRow {
    path: String,
    skill_id: String,
    started_at: DateTime<Utc>,
    sets_completed: i32,
    reps_completed: i32,
    tempo_start: Option<i32>,
    tempo_end: Option<i32>,
    difficulty: Option<String>,
    tags: Option<Vec<String>>,
    notes: Option<String>,
}

/// Serializes this profile's full session + feedback history to the flat
/// JSON shape meant to be handed to Claude (or another LLM) for progress
/// analysis, matching the export preview shown in the app's Progress screen.
#[tauri::command]
pub async fn export_sessions_json(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
) -> Result<String, String> {
    let pool = pool.inner();

    let profile_name: String = sqlx::query_scalar("SELECT name FROM profiles WHERE id = $1")
        .bind(profile_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query_as::<_, ExportRow>(
        "SELECT sk.path::text AS path, sk.id AS skill_id, sess.started_at,
                sess.sets_completed, sess.reps_completed, sess.tempo_start, sess.tempo_end,
                fb.difficulty, fb.tags, fb.notes
         FROM sessions sess
         JOIN skills sk ON sk.id = sess.skill_id
         LEFT JOIN feedback fb ON fb.session_id = sess.id
         WHERE sess.profile_id = $1 AND sess.ended_at IS NOT NULL
         ORDER BY sess.started_at ASC",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let sessions: Vec<_> = rows
        .into_iter()
        .map(|r| {
            json!({
                "date": r.started_at.to_rfc3339(),
                "path": r.path,
                "skill": r.skill_id,
                "sets": r.sets_completed,
                "reps": r.reps_completed,
                "tempo": [r.tempo_start, r.tempo_end],
                "difficulty": r.difficulty,
                "tags": r.tags.unwrap_or_default(),
                "notes": r.notes.unwrap_or_default(),
            })
        })
        .collect();

    let export = json!({
        "profile": profile_name,
        "exported_at": Utc::now().to_rfc3339(),
        "sessions": sessions,
    });

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}
