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
            exit_to_windows
        ])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_fullscreen(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running NovaShell");
}
