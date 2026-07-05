# Installing NovaShell on Windows

## Easiest: download the installer (no tools needed)

This repo has a GitHub Actions workflow (`.github/workflows/build-windows.yml`) that
builds the Windows installer automatically on GitHub's servers.

1. **Connect this project to GitHub** (in v0: Settings → Git → connect a repository).
   Every push then triggers a build automatically.
2. On GitHub → **Actions** tab → latest "Build NovaShell Windows Installer" run →
   download the **NovaShell-Setup** artifact.
3. Unzip and run `NovaShell_0.1.0_x64-setup.exe`. Done — it installs per-user
   (no admin prompt) with a Start Menu entry.

To publish a permanent download link, push a version tag:

```bash
git tag v0.1.0 && git push --tags
```

That creates a GitHub **Release** with the setup exe attached — a shareable,
permanent `https://github.com/<you>/<repo>/releases` download page.

The installer is fully self-contained: it embeds the UI, the Next.js server,
a portable Node runtime, and the Rust native core. Nothing else to install
(WebView2 is already part of Windows 10/11).

## Alternative: build locally

1. **Rust** — https://rustup.rs (MSVC toolchain; install VS Build Tools "Desktop C++" if prompted)
2. **Node.js 22+ and pnpm** — https://nodejs.org then `npm i -g pnpm`

```bash
pnpm install
pnpm build
# prepare embedded server resources (same as CI, PowerShell):
#   mkdir src-tauri/resources/app; cp -r .next/standalone/* src-tauri/resources/app
#   mkdir src-tauri/resources/app/.next/static; cp -r .next/static/* src-tauri/resources/app/.next/static
#   cp -r public src-tauri/resources/app/public
#   mkdir src-tauri/resources/node; cp (Get-Command node).Source src-tauri/resources/node/node.exe
pnpm dlx @tauri-apps/cli build
```

Output: `src-tauri/target/release/bundle/nsis/NovaShell_..._x64-setup.exe`

For development with hot reload: `pnpm dlx @tauri-apps/cli dev`

## How the exe works

- On launch, the Rust core starts the embedded Next.js server (bundled portable
  `node.exe` + standalone build) on `127.0.0.1:3210`, hidden, then opens the
  fullscreen WebView2 window pointed at it. The server is killed on exit.
- User data (SQLite: library, usage, taste, watch history, playback positions)
  lives in `%APPDATA%\NovaShell` — survives updates and reinstalls, never leaves your PC.
- Brave launches include `--remote-debugging-port=9222`, powering the CDP playback
  monitor: real `video.currentTime` positions for Continue Watching.

## What the native build unlocks (vs the web preview)

| Feature | Web preview | Native exe |
| --- | --- | --- |
| Launch Steam/Epic games, Brave | Splash simulation | Real process launch (`steam://`, `com.epicgames.launcher://`, `--app` mode Brave) |
| Virtual mouse | DOM cursor overlay | Real Windows cursor (enigo injection) |
| Spiral keyboard typing | In-shell fields only | Types into ANY focused Windows app |
| Volume buttons (LB/RB) | On-screen HUD only | Real system volume |
| Guide/Xbox button | G key in shell only | GLOBAL hook — works while gaming (XInputGetStateEx poll thread) |
| Brave watch history import | Simulated via API | Reads your real Brave profile on every launch |
| Playback positions (CDP) | Simulated test video | Real positions from Crunchyroll/Prime/YouTube tabs |
| Installed game library | Manual entry | Auto-scan of Steam + Epic manifests on launch |
| Exit to Windows | Splash | Actually closes the shell |

## Autostart (optional)

`Win+R` → `shell:startup` → drop a shortcut to NovaShell there.
The shell opens fullscreen on boot; the Guide button summons it any time.
