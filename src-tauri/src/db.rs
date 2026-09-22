use sqlx::postgres::{PgPool, PgPoolOptions};

const DEFAULT_DATABASE_URL: &str = "postgres://woodshed:woodshed_dev_local@127.0.0.1:5432/woodshed";

pub async fn connect_and_migrate() -> anyhow::Result<PgPool> {
    // Loads src-tauri/.env if present; falls back to the local dev default
    // so the app runs out of the box against the Postgres instance set up
    // during initial setup. Override DATABASE_URL for any other target.
    let _ = dotenvy::dotenv();
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
