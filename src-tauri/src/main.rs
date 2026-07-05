// NovaShell native core — Tauri v2
// Real OS actions the web layer calls through `invoke()`:
//   launch_target   — steam:// | epic:// | spotify: | exe paths | https:// (Brave app mode)
//   move_cursor     — relative mouse move (virtual cursor -> real cursor)
//   click / scroll  — real input injection
//   type_text       — real keyboard injection (spiral keyboard output)
//   set_volume      — system master volume (Windows Core Audio)
//   exit_to_windows — close the shell window

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use enigo::{
    Axis, Button, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings,
};
use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, State};

struct InputState(Mutex<Enigo>);

#[tauri::command]
fn launch_target(target: String) -> Result<(), String> {
    let t = target.trim();
    if t.is_empty() {
        return Err("empty target".into());
    }
    // URL-style protocols and web URLs are handed to the OS shell.
    // Web URLs open in Brave app mode (frameless, console-like).
    if t.starts_with("http://") || t.starts_with("https://") {
        // Brave app-mode window: user's real profile, sessions, and accounts.
        let brave = Command::new("cmd")
            .args(["/C", "start", "", "brave.exe", &format!("--app={t}")])
            .spawn();
        if brave.is_err() {
            // Fallback: default browser
            Command::new("cmd")
                .args(["/C", "start", "", t])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    if t.contains("://") || t.ends_with(':') || t.starts_with("spotify:") {
        Command::new("cmd")
            .args(["/C", "start", "", t])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    // Bare executable name or full path
    Command::new("cmd")
        .args(["/C", "start", "", t])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn move_cursor(dx: i32, dy: i32, state: State<InputState>) -> Result<(), String> {
    let mut enigo = state.0.lock().map_err(|e| e.to_string())?;
    enigo
        .move_mouse(dx, dy, Coordinate::Rel)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn click(button: String, state: State<InputState>) -> Result<(), String> {
    let mut enigo = state.0.lock().map_err(|e| e.to_string())?;
    let btn = match button.as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    enigo.button(btn, Direction::Click).map_err(|e| e.to_string())
}

#[tauri::command]
fn scroll(dy: i32, state: State<InputState>) -> Result<(), String> {
    let mut enigo = state.0.lock().map_err(|e| e.to_string())?;
    enigo.scroll(dy, Axis::Vertical).map_err(|e| e.to_string())
}

#[tauri::command]
fn type_text(text: String, state: State<InputState>) -> Result<(), String> {
    let mut enigo = state.0.lock().map_err(|e| e.to_string())?;
    enigo.text(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_volume(level: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        return windows_volume::set_master_volume((level.min(100)) as f32 / 100.0);
    }
    #[allow(unreachable_code)]
    Err("volume control is Windows-only".into())
}

#[tauri::command]
fn exit_to_windows(window: tauri::Window) {
    let _ = window.close();
}

// ---------------------------------------------------------------------------
// Brave history import — reads the user's LOCAL Brave profile History file
// (SQLite). Data never leaves the machine: entries are handed to the local
// shell DB via /api/history. Chrome epoch = microseconds since 1601-01-01.
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct HistoryEntry {
    url: String,
    title: String,
    visited_at: i64, // unix seconds
}

const CHROME_EPOCH_OFFSET_SECS: i64 = 11_644_473_600;

#[tauri::command]
fn read_brave_history(limit: u32) -> Result<Vec<HistoryEntry>, String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
    let history_path = std::path::PathBuf::from(local)
        .join("BraveSoftware/Brave-Browser/User Data/Default/History");
    if !history_path.exists() {
        return Err("Brave History file not found".into());
    }
    // Brave locks the live file — copy to temp and read the copy.
    let tmp = std::env::temp_dir().join("novashell-brave-history.db");
    std::fs::copy(&history_path, &tmp).map_err(|e| format!("copy history: {e}"))?;

    let conn = rusqlite::Connection::open_with_flags(
        &tmp,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT url, title, last_visit_time FROM urls
             WHERE (url LIKE '%crunchyroll.com/watch/%'
                 OR url LIKE '%crunchyroll.com/series/%'
                 OR url LIKE '%primevideo.com/%detail/%'
                 OR url LIKE '%youtube.com/watch%')
               AND title != ''
             ORDER BY last_visit_time DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([limit.min(5000)], |row| {
            let micros: i64 = row.get(2)?;
            Ok(HistoryEntry {
                url: row.get(0)?,
                title: row.get(1)?,
                visited_at: micros / 1_000_000 - CHROME_EPOCH_OFFSET_SECS,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    let _ = std::fs::remove_file(&tmp);
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Installed-game scan — Steam library manifests + Epic launcher manifests.
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct InstalledGame {
    id: String,
    name: String,
    source: String,        // steam | epic
    launch_target: String, // steam://rungameid/<id> | com.epicgames.launcher://...
}

fn scan_steam() -> Vec<InstalledGame> {
    let mut out = Vec::new();
    let roots = [
        r"C:\Program Files (x86)\Steam\steamapps",
        r"C:\Program Files\Steam\steamapps",
    ];
    let mut libraries: Vec<std::path::PathBuf> =
        roots.iter().map(std::path::PathBuf::from).collect();

    // libraryfolders.vdf lists additional library drives:  "path"  "D:\\SteamLibrary"
    for root in &roots {
        let vdf = std::path::Path::new(root).join("libraryfolders.vdf");
        if let Ok(text) = std::fs::read_to_string(&vdf) {
            for line in text.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix("\"path\"") {
                    let p = rest.trim().trim_matches('"').replace("\\\\", "\\");
                    libraries.push(std::path::PathBuf::from(p).join("steamapps"));
                }
            }
        }
    }
    libraries.dedup();

    for lib in libraries {
        let Ok(dir) = std::fs::read_dir(&lib) else { continue };
        for entry in dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("appmanifest_") || !name.ends_with(".acf") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
            let get = |key: &str| -> Option<String> {
                text.lines().find_map(|l| {
                    let l = l.trim();
                    l.strip_prefix(&format!("\"{key}\""))
                        .map(|rest| rest.trim().trim_matches('"').to_string())
                })
            };
            if let (Some(appid), Some(game)) = (get("appid"), get("name")) {
                // Skip runtime/redist entries
                if game.contains("Steamworks") || game.contains("Redistributables") {
                    continue;
                }
                out.push(InstalledGame {
                    id: format!("steam-{appid}"),
                    name: game,
                    source: "steam".into(),
                    launch_target: format!("steam://rungameid/{appid}"),
                });
            }
        }
    }
    out
}

fn scan_epic() -> Vec<InstalledGame> {
    let mut out = Vec::new();
    let manifests = std::path::Path::new(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests");
    let Ok(dir) = std::fs::read_dir(manifests) else { return out };
    for entry in dir.flatten() {
        if entry.path().extension().and_then(|e| e.to_str()) != Some("item") {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
        let name = json["DisplayName"].as_str().unwrap_or_default().to_string();
        let app = json["AppName"].as_str().unwrap_or_default().to_string();
        if name.is_empty() || app.is_empty() {
            continue;
        }
        out.push(InstalledGame {
            id: format!("epic-{app}"),
            name,
            source: "epic".into(),
            launch_target: format!(
                "com.epicgames.launcher://apps/{app}?action=launch&silent=true"
            ),
        });
    }
    out
}

#[tauri::command]
fn scan_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = scan_steam();
    games.extend(scan_epic());
    Ok(games)
}

#[cfg(windows)]
mod windows_volume {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    pub fn set_master_volume(level: f32) -> Result<(), String> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e| e.to_string())?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| e.to_string())?;
            let volume: IAudioEndpointVolume =
                device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
            volume
                .SetMasterVolumeLevelScalar(level, std::ptr::null())
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Global Guide-button hook — polls XInput on a background thread even while
// another app (game, Brave) has focus. Uses the undocumented-but-stable
// XInputGetStateEx (ordinal 100 in xinput1_4.dll), which is the only API that
// reports the Guide/Xbox button. On press: bring the shell to front + emit
// a "guide-button" event so the web layer opens Quick Settings / home.
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod guide_hook {
    use tauri::{AppHandle, Emitter, Manager};
    use windows::core::s;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct XinputGamepad {
        buttons: u16,
        left_trigger: u8,
        right_trigger: u8,
        thumb_lx: i16,
        thumb_ly: i16,
        thumb_rx: i16,
        thumb_ry: i16,
    }
    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct XinputState {
        packet_number: u32,
        gamepad: XinputGamepad,
    }

    const GUIDE_BUTTON: u16 = 0x0400;
    type XInputGetStateEx = unsafe extern "system" fn(u32, *mut XinputState) -> u32;

    pub fn spawn(app: AppHandle) {
        std::thread::spawn(move || unsafe {
            let Ok(lib) = LoadLibraryA(s!("xinput1_4.dll")) else { return };
            // Ordinal 100 = XInputGetStateEx (exposes the Guide bit)
            let Some(proc) = GetProcAddress(lib, windows::core::PCSTR(100 as *const u8)) else {
                return;
            };
            let get_state: XInputGetStateEx = std::mem::transmute(proc);

            let mut was_down = false;
            loop {
                let mut any_down = false;
                for pad in 0..4u32 {
                    let mut state = XinputState::default();
                    if get_state(pad, &mut state) == 0
                        && state.gamepad.buttons & GUIDE_BUTTON != 0
                    {
                        any_down = true;
                        break;
                    }
                }
                // rising edge only
                if any_down && !was_down {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                    let _ = app.emit("guide-button", ());
                }
                was_down = any_down;
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        });
    }
}

fn main() {
    let enigo = Enigo::new(&Settings::default()).expect("input driver");
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(InputState(Mutex::new(enigo)))
        .invoke_handler(tauri::generate_handler![
            launch_target,
            move_cursor,
            click,
            scroll,
            type_text,
            set_volume,
            exit_to_windows,
            read_brave_history,
            scan_installed_games
        ])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_fullscreen(true);
            }
            #[cfg(windows)]
            guide_hook::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running NovaShell");
}
