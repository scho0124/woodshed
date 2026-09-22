use crate::models::{NewTabInput, TabDetail, TabSummary, UpdateTabInput};
use sqlx::PgPool;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

const SUMMARY_COLUMNS: &str = "id, title, artist, tuning, file_name, mime_type, created_at";

#[tauri::command]
pub async fn list_tabs(
    pool: State<'_, PgPool>,
    profile_id: Uuid,
) -> Result<Vec<TabSummary>, String> {
    sqlx::query_as::<_, TabSummary>(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM tabs WHERE profile_id = $1 ORDER BY created_at DESC"
    ))
    .bind(profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tab(pool: State<'_, PgPool>, id: Uuid) -> Result<TabDetail, String> {
    let summary = sqlx::query_as::<_, TabSummary>(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM tabs WHERE id = $1"
    ))
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let content = if summary.mime_type.starts_with("text/") {
        let data: Vec<u8> = sqlx::query_scalar("SELECT data FROM tabs WHERE id = $1")
            .bind(id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
        Some(String::from_utf8_lossy(&data).into_owned())
    } else {
        None
    };

    Ok(TabDetail { summary, content })
}

#[tauri::command]
pub async fn create_tab(pool: State<'_, PgPool>, input: NewTabInput) -> Result<TabSummary, String> {
    sqlx::query_as::<_, TabSummary>(&format!(
        "INSERT INTO tabs (profile_id, title, artist, tuning, file_name, mime_type, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING {SUMMARY_COLUMNS}"
    ))
    .bind(input.profile_id)
    .bind(input.title.trim())
    .bind(input.artist.trim())
    .bind(input.tuning.trim())
    .bind(input.file_name)
    .bind(input.mime_type)
    .bind(input.data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_tab(pool: State<'_, PgPool>, input: UpdateTabInput) -> Result<TabSummary, String> {
    sqlx::query_as::<_, TabSummary>(&format!(
        "UPDATE tabs SET title = $2, artist = $3, tuning = $4, updated_at = now()
         WHERE id = $1
         RETURNING {SUMMARY_COLUMNS}"
    ))
    .bind(input.id)
    .bind(input.title.trim())
    .bind(input.artist.trim())
    .bind(input.tuning.trim())
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tab(pool: State<'_, PgPool>, id: Uuid) -> Result<(), String> {
    sqlx::query("DELETE FROM tabs WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Writes the stored file to the app cache and hands it to the system's default
/// app, for formats the in-app viewer can't show (PDF, Guitar Pro, images).
#[tauri::command]
pub async fn open_tab_file(app: AppHandle, pool: State<'_, PgPool>, id: Uuid) -> Result<(), String> {
    let (file_name, data): (String, Vec<u8>) =
        sqlx::query_as("SELECT file_name, data FROM tabs WHERE id = $1")
            .bind(id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("tabs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Keep only the base name so a stored file name can't point outside the cache dir.
    let base = std::path::Path::new(&file_name)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "tab".to_string());
    let path = dir.join(format!("{id}-{base}"));
    std::fs::write(&path, data).map_err(|e| e.to_string())?;

    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
