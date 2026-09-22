fn main() {
    // sqlx::migrate! embeds the migrations at compile time, so a new migration
    // file has to trigger a rebuild or the app keeps running the old set.
    println!("cargo:rerun-if-changed=migrations");
    tauri_build::build()
}
