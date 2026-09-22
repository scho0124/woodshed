use crate::tutorials::{find_tutorials, TutorialVideo};
use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use tauri::State;

/// Picks older than this are fetched again the next time the skill is opened.
const CACHE_DAYS: i64 = 14;

#[derive(Debug, Serialize)]
pub struct SkillTutorial {
    pub query: String,
    /// A plain YouTube search for the same query, for when there's no pick.
    pub search_url: String,
    /// Best first.
    pub videos: Vec<TutorialVideo>,
    pub fetched_at: Option<DateTime<Utc>>,
    /// True when YOUTUBE_API_KEY isn't set, so nothing could be fetched.
    pub missing_api_key: bool,
}

#[derive(sqlx::FromRow)]
struct Cached {
    query: String,
    videos: sqlx::types::Json<Vec<TutorialVideo>>,
    fetched_at: DateTime<Utc>,
}

fn search_url(query: &str) -> String {
    reqwest::Url::parse_with_params("https://www.youtube.com/results", &[("search_query", query)])
        .map(|u| u.to_string())
        .unwrap_or_default()
}

/// The skill's tutorial picks: from cache when fresh, otherwise from YouTube.
/// `refresh` skips the cache. If YouTube fails, a stale pick beats no pick.
#[tauri::command]
pub async fn get_skill_tutorial(
    pool: State<'_, PgPool>,
    skill_id: String,
    refresh: bool,
) -> Result<SkillTutorial, String> {
    let pool = pool.inner();
    let query: String = sqlx::query_scalar(
        "SELECT COALESCE(config->>'tutorial_query', name || ' tutorial') FROM skills WHERE id = $1",
    )
    .bind(&skill_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let cached = sqlx::query_as::<_, Cached>(
        "SELECT query, videos, fetched_at FROM skill_tutorials WHERE skill_id = $1",
    )
    .bind(&skill_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    // A changed query in a later migration makes the old pick irrelevant.
    .filter(|c| c.query == query);

    let from_cache = |c: Cached, missing_api_key: bool| SkillTutorial {
        search_url: search_url(&c.query),
        query: c.query,
        videos: c.videos.0,
        fetched_at: Some(c.fetched_at),
        missing_api_key,
    };

    let cached = match cached {
        Some(c) if !refresh && Utc::now() - c.fetched_at < Duration::days(CACHE_DAYS) => {
            return Ok(from_cache(c, false));
        }
        other => other,
    };

    let key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    if key.trim().is_empty() {
        return Ok(match cached {
            Some(c) => from_cache(c, true),
            None => SkillTutorial {
                search_url: search_url(&query),
                query,
                videos: Vec::new(),
                fetched_at: None,
                missing_api_key: true,
            },
        });
    }

    let videos = match find_tutorials(&query, key.trim()).await {
        Ok(videos) => videos,
        Err(e) => return cached.map(|c| from_cache(c, false)).ok_or(e),
    };

    let fetched_at: DateTime<Utc> = sqlx::query_scalar(
        "INSERT INTO skill_tutorials (skill_id, query, videos, fetched_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (skill_id) DO UPDATE
            SET query = EXCLUDED.query, videos = EXCLUDED.videos, fetched_at = EXCLUDED.fetched_at
         RETURNING fetched_at",
    )
    .bind(&skill_id)
    .bind(&query)
    .bind(sqlx::types::Json(&videos))
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(SkillTutorial {
        search_url: search_url(&query),
        query,
        videos,
        fetched_at: Some(fetched_at),
        missing_api_key: false,
    })
}
