# Building Gamepad UX as a native Windows app

This project ships with a complete Tauri native core (`src-tauri/`). Building it on your
Windows 10 PC produces a real `Gamepad UX.exe` — no browser, no server, instant load.

## One-time setup (your PC)

1. **Install Rust** — https://rustup.rs (accept defaults; installs MSVC toolchain).
   If prompted, install "Desktop development with C++" via the Visual Studio Build Tools installer.
2. **Install Node.js 20+ and pnpm** — https://nodejs.org then `npm i -g pnpm`
3. **WebView2** — already part of Windows 10/11 (nothing to do).

## Build

```bash
# in the project folder (downloaded ZIP or git clone)
pnpm install
pnpm add -D @tauri-apps/cli
pnpm tauri build
```

Output: `src-tauri/target/release/Gamepad UX.exe` plus an installer under
`src-tauri/target/release/bundle/`.

For development with hot reload:

```bash
pnpm tauri dev
```

## What the native build unlocks (vs the web preview)

| Feature | Web preview | Native exe |
| --- | --- | --- |
| Launch Steam/Epic games, Brave | Splash simulation | Real process launch (`steam://`, `com.epicgames.launcher://`, `--app` mode Brave) |
| Virtual mouse | DOM cursor overlay | Real Windows cursor (enigo injection) |
| Spiral keyboard typing | In-shell fields only | Types into ANY focused Windows app |
| Volume buttons (LB/RB) | On-screen HUD only | Real system volume |
| Guide/Xbox button | G key in shell only | GLOBAL hook — works while gaming (XInputGetStateEx poll thread) |
| Brave watch history import | Simulated via API | Reads your real Brave profile on every launch |
| Installed game library | Manual entry | Auto-scan of Steam + Epic manifests on launch |
| Exit to Windows | Splash | Actually closes the shell |

## Architecture notes

- The UI is statically exported Next.js embedded in the exe, rendered by WebView2.
- All data stays local: SQLite at `data/gamepad-ux.db` (dev) — the same schema the
  native build uses. Watch history, usage patterns, and taste weights never leave your PC.
- `lib/native.ts` is the bridge: every OS action checks `isNative()` — simulation in the
  preview, Rust command in the exe. One codebase.
- Rust commands live in `src-tauri/src/main.rs`: `launch_target`, `move_cursor`, `click`,
  `scroll`, `type_text`, `set_volume`, `exit_to_windows`, `read_brave_history`,
  `scan_installed_games`, plus the background Guide-button hook.

## Autostart (optional)

After building, press `Win+R` → `shell:startup` → drop a shortcut to the exe there.
The shell opens fullscreen on boot; the Guide button summons it any time.
