use std::fs;
use std::path::{Path, PathBuf};
use serde_json::json;

// Heuristic to locate files in various environments (dev, release, cwd)
fn find_file(filename: &str) -> Option<PathBuf> {
    // 1. Check current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let path = cwd.join(filename);
        if path.exists() {
            return Some(path);
        }
    }
    // 2. Check directory of the executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let path = exe_dir.join(filename);
            if path.exists() {
                return Some(path);
            }
        }
    }
    // 3. Check parent directory (useful during local development inside src-tauri)
    let parent_path = Path::new("..").join(filename);
    if parent_path.exists() {
        return Some(parent_path);
    }
    
    None
}

// Get the resolved write path for config saving
fn get_write_path(filename: &str) -> PathBuf {
    if let Some(existing) = find_file(filename) {
        existing
    } else if let Ok(cwd) = std::env::current_dir() {
        cwd.join(filename)
    } else if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            exe_dir.join(filename)
        } else {
            PathBuf::from(filename)
        }
    } else {
        PathBuf::from(filename)
    }
}

#[tauri::command]
fn load_config() -> Result<serde_json::Value, String> {
    if let Some(path) = find_file("config.json") {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(json)
    } else {
        // Return default empty config
        Ok(json!({
            "G_WEB_APP_URL": "",
            "autoSync": true
        }))
    }
}

#[tauri::command]
fn save_config(config: serde_json::Value) -> Result<(), String> {
    let path = get_write_path("config.json");
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_events_csv() -> Result<String, String> {
    if let Some(path) = find_file("events.csv") {
        // Read file using Windows-1252 CP1252 or CP437, or just standard UTF-8 lossy conversion
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let content = String::from_utf8_lossy(&bytes).into_owned();
        Ok(content)
    } else {
        Err("events.csv not found".to_string())
    }
}

#[tauri::command]
fn publish_status(url: String, payload: String) -> Result<String, String> {
    let response = ureq::post(&url)
        .set("Content-Type", "application/json")
        .set("User-Agent", "SwimMeet-ScoreboardController/1.0")
        .send_string(&payload)
        .map_err(|e| e.to_string())?;

    let text = response.into_string().map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
fn publish_status_get(url: String) -> Result<String, String> {
    let response = ureq::get(&url)
        .set("User-Agent", "SwimMeet-ScoreboardController/1.0")
        .call()
        .map_err(|e| e.to_string())?;

    let text = response.into_string().map_err(|e| e.to_string())?;
    Ok(text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            load_events_csv,
            publish_status,
            publish_status_get
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
