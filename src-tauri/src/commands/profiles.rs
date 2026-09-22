use crate::models::Profile;
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_profiles(pool: State<'_, PgPool>) -> Result<Vec<Profile>, String> {
    sqlx::query_as::<_, Profile>(
        "SELECT id, name, color, created_at FROM profiles ORDER BY created_at ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_profile(
    pool: State<'_, PgPool>,
    name: String,
    color: String,
) -> Result<Profile, String> {
    sqlx::query_as::<_, Profile>(
        "INSERT INTO profiles (id, name, color) VALUES (gen_random_uuid(), $1, $2)
         RETURNING id, name, color, created_at",
    )
    .bind(name)
    .bind(color)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_profile(pool: State<'_, PgPool>, profile_id: Uuid) -> Result<(), String> {
    sqlx::query("DELETE FROM profiles WHERE id = $1")
        .bind(profile_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
