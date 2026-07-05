# Gamepad UX — Requirements Diary

> Living document. Updated every session. Cross-check every feature against this before calling anything done.
> Last updated: 2026-07-05

## Vision (user's words, condensed)

A **console-like alternate environment for Windows 10** — think PS5 / Xbox / Android TV home
screen layered over Windows. Not a demo, not a prototype: a fully dynamic, fully customizable,
database-backed product. Dark, minimalist, slick, smooth, fast, seamless. Cool animations.
Controller-first everything.

## Hard requirements checklist

### Shell / Environment
- [x] PS5/Android-TV style full-screen home: horizontal focus-based tile rows, hero banner for focused item
- [x] Instant mode switch: Guide button (G key) toggles console <-> desktop — TESTED ✓ (physical global hook = native layer)
- [x] Dark mode, minimalist, cinematic; smooth fast animations everywhere
- [x] Easy volume controls (overlay HUD) — LB/RB anywhere + Quick Settings slider, TESTED ✓
- [x] Quick settings overlay — TESTED ✓ (volume, brightness, night mode, keyboard, desktop, exit)
- [x] Easy multimedia navigation — media row + YouTube TV screen

### Library (fully user-customizable — NOT hardcoded)
- [x] User can manually ADD games/apps — TESTED ✓ (added "dtq" via spiral keyboard end-to-end, persisted to SQLite)
- [x] User can EDIT and DELETE entries — TESTED ✓ (delete confirm dialog, DB verified)
- [x] Custom theme-based icons generated for YouTube, Prime Video, Crunchyroll, Spotify, Brave, Steam, Epic, Cursor
- [x] Steam, Epic, YouTube, Prime Video, Crunchyroll, Brave as first-class DB entries
- [x] Persisted in real SQLite database via API routes (no localStorage)

### Recommendations engine (learning, not fake)
- [x] Suggestion hero banner on home ("You usually open Prime Video around this time") — TESTED ✓
- [x] Learns from usage: frequency + recency + hour-of-day + day-of-week affinity scoring — API TESTED ✓
- [x] "Don't suggest this" (X button) — learns from rejection, tile drops instantly — TESTED ✓
- [x] Every launch recorded as usage event with hour/dow — DB VERIFIED ✓
- [x] NOTE (honest constraint): real Prime/Crunchyroll watch-history APIs don't exist publicly.
      Recommendations are driven by in-shell usage tracking + manual preferences.
      Native layer can later add Brave-session-based history import.

### YouTube
- [x] Android TV leanback UI: hero, channel rows, real videos via YouTube RSS feeds — TESTED ✓
- [x] Search via spiral keyboard → opens YouTube results — TESTED ✓ (keyboard flow verified)
- [x] Player screen embeds video; native layer will open in Brave app mode for real accounts

### Controller (Cosmic Byte Ares Pro, XInput mode)
- [x] Full Gamepad API engine: rAF polling, edge detection, deadzone, auto-repeat, priority handler stack
- [x] Keyboard mirror (arrows/Enter/Esc/X/C/Q/E/Tab/G) — used for all browser testing
- [x] Virtual cursor with acceleration curve (desktop mode) — TESTED ✓
- [x] Scroll via right stick / triggers (desktop mode)
- [x] Spiral daisy-wheel keyboard (8 sectors x 4 letters, Y/X/B/A petals) — TESTED ✓ typed real text
      Fixed: stick-loop was clearing D-pad sector selection every frame (stickOwnedRef)
- [x] Button glyph hints bar on every screen

### Modes
- [x] Console home (launcher)
- [x] Desktop/app mode: virtual mouse + simulated app frame — TESTED ✓
- [x] "Return to Windows" exit action (splash; real exit = native layer)

### DESIGN OVERHAUL (2026-07-05 user feedback — CRITICAL)
- [x] User REJECTS "neon AI crap": no glow rings, no cyan glow, no gradient blobs
- [x] Minimalist premium theme shipped: warm near-black, hairline borders, restrained accent
- [x] Focus state fixed: GPU-composited (.tile-focus scale + double hairline ring), no glow — TESTED ✓
- [x] DISCOVERY BANNER SHIPPED — TESTED ✓: home rebuilt around full-bleed 62vh auto-rotating
      carousel of trending shows (TVmaze, no key needed), ken-burns + crossfade, thin segment
      progress bars (pause while focused), contextual hints (A Watch / X Not interested).
      Genre taste learning VERIFIED: opened anime → anime jumped to top w/ "Because you watch X";
      dismissed item removed instantly + genres downweighted. Test feedback rows cleaned after.
      Anime→Crunchyroll, Amazon→Prime, YouTube mapping; max 3 items/service for diversity.
      Old "Suggested for You" app row REMOVED per user (app-suggestion engine still in DB/API).
      Gotcha fixed: banner needed shrink-0 inside flex scroll column (was collapsing to 0 height).
- [x] Cinematic wide banner art generated for services (youtube, prime, crunchyroll, spotify, steam, brave)
- [x] DB migrations: v2 `banner` column; v3 `content_feedback` table

### NATIVE-FIRST MANDATE (user insists: full native software, not web-first)
- [x] Tauri scaffold shipped in src-tauri/: tauri.conf.json (withGlobalTauri), Cargo.toml, build.rs, main.rs
- [x] Rust commands written: launch (steam://, epic://, exe, Brave --app mode), enigo
      move_cursor/click/scroll/type_text, set_volume (Windows Core Audio via keybd fallback), exit_shell
- [x] Web bridge (lib/native.ts) wired through shell: launch, content-open, volume, exit,
      cursor move/click/scroll, keyboard type — same UI code, isNative() switches simulation → real OS
- [x] Global Guide-button hook: Rust background thread polling XInputGetStateEx (ordinal 100,
      xinput1_4.dll — the only API exposing the Guide bit); rising-edge → focus shell window +
      emit "guide-button"; shell subscribes via onGuideButton() and returns home
- [x] Auto-scan installed games: Rust reads Steam appmanifest_*.acf (incl. extra library drives
      via libraryfolders.vdf) + Epic ProgramData manifests → POST /api/library/import
      (bulk upsert, stable lowercase ids steam-<appid>/epic-<app>, dedupe TESTED ✓)
      Bug fixed: mixed-case Epic AppNames were rejected by id regex — now normalized
- [x] Brave history import: Rust copies locked History SQLite to temp, reads crunchyroll/
      primevideo/youtube URLs (Chrome epoch → unix), POSTs to /api/history on shell startup
- [x] Build instructions doc: BUILD-WINDOWS.md (setup, build commands, web-vs-native feature matrix)
- [ ] SQLite via Tauri SQL plugin in the native build (schema identical; currently better-sqlite3 on dev server)

### WATCH HISTORY / TASTE PIPELINE (2026-07-05 — how existing + upcoming data connects)
- [x] v4 migration: watch_history table (service, series, episode, url, watched_at, UNIQUE dedupe)
- [x] Title parsers TESTED ✓: "Watching One Piece Episode 1071 - Crunchyroll" → series+episode;
      "Prime Video: The Boys - Season 4" / "Watch Reacher | Prime Video"; YouTube " - YouTube";
      non-streaming URLs (google search) correctly rejected by the importer
- [x] Continue Watching row on home TESTED ✓: latest entry per series, service-tinted cards,
      episode label + relative time, A=Resume deep-links to the exact episode page (the service
      resumes its own in-episode position — exact timestamp is server-side only, NOT accessible)
- [x] Taste engine merges THREE signals TESTED ✓: banner feedback (opened/dismissed) +
      watched-series genres (TVmaze singlesearch, cached, engagement-weighted by visits) +
      already-watched shows get +12 boost with "New episode of a show you watch" reason.
      Verified: One Piece/Solo Leveling/The Boys history → banner leads with
      "Because you watch Action" anime on Crunchyroll.
- NOTE: preview DB holds SIMULATED Brave-history rows (One Piece, Solo Leveling, The Boys,
  Reacher) imported through the REAL pipeline so the feature is visible in preview. The native
  build overwrites with the real profile import on first launch. Clear manually with:
  DELETE FROM watch_history.
- v0 sandbox is Linux: cannot compile the Windows exe here — deliverable is a ready-to-build native project.

### CDP PLAYBACK MONITOR (2026-07-05 — user requested REAL positions, not title parsing)
- [x] Research: no public watch APIs for Prime/Crunchyroll; browser-extension scrobblers
      (universal-trakt-scrobbler, web-scrobbler) prove reading video.currentTime works.
      CDP approach chosen: Brave launched with --remote-debugging-port=9222, monitor polls
      /json/list → attaches via WebSocket (Node 22 native, zero deps) → Runtime.evaluate reads
      {currentTime, duration, paused} from the <video> element. Iframe targets supported via
      parentId chain (CRITICAL for Crunchyroll's cross-origin player iframe).
- [x] v5 migration: playback_positions table (url PK, service, series, episode, position_secs,
      duration_secs, paused, updated_at)
- [x] lib/cdp/monitor.ts: 4s poll loop, HMR-safe generation guard, port priority
      settings.cdp_port → env CDP_PORT → 9222; starts lazily from GET /api/history
- [x] Continue Watching merge: playback rows (ground truth, real progress) override
      title-parsed history; >=97% watched treated as finished (falls back to history)
- [x] Card UI: "Resume at 4:05" + bottom progress bar (role=progressbar) only when real
      position exists; history-only rows show plain "Resume"
- [x] TESTED END-TO-END ✓ in sandbox: launched real Chromium w/ debug port + canvas-stream
      video faking a Crunchyroll watch page; monitor captured position 245.8s/1440s;
      home screen showed "Resume at 4:05" + 17% progress bar on the One Piece card.
      Test artifacts cleaned (test chrome killed, file:// playback rows + port override deleted).
- [x] Rust launch() now passes --remote-debugging-port=9222 to Brave (flag only binds on first
      Brave process start; if Brave already runs without it, monitor stays idle harmlessly)
- Preview home now shows plain "Resume" cards again (correct: only REAL playback gets a bar).

### Known issues / polish backlog
- [x] Library list: focused row auto-scroll — RETESTED ✓
- [x] Volume HUD overlaps Quick Settings slider — fixed (suppressed while panel open)
- [ ] YouTube TV: row virtualization if subscriptions grow large (only matters at ~20+ channels)
- [x] YouTube channels API (add by @handle w/ resolution, remove) — TESTED ✓
- [x] Channel manager UI SHIPPED + TESTED ✓: X on YouTube screen opens minimalist modal
      (list + Add entry), D-pad nav, X removes (Fireship removed 5→4 verified), A on Add opens
      spiral keyboard, status line shows resolve feedback. Fireship restored via @handle after test.

## User preferences observed
- Wants maximal effort, long autonomous work sessions, thorough testing of every click/component
- Wants honesty; hates "demo shit"
- No emojis requirement not stated; keep default (none)
- Dark cinematic theme; no purple prominence (design rule)

## Architecture decisions
- Next.js (App Router) web shell now; Tauri-ready separation: all OS actions behind a `native/` adapter interface with web fallbacks
- ~~Neon~~ → User declined cloud integrations. Using **local SQLite (better-sqlite3)** via Next.js
  API routes — correct local-first architecture for a native launcher anyway (maps 1:1 to Tauri).
  Tables: apps, usage_events, suggestion_feedback, settings.
- Gamepad engine: rAF polling loop, edge detection, repeat handling — lib/gamepad.ts
- Focus system: React context, roving focus, scrollIntoView centering

## Status log
- 2026-07-05: Initial shell built (home, quick settings, volume HUD, desktop mode w/ virtual cursor,
  spiral keyboard, launch splash). Verified in browser: home ✓, navigation ✓, scroll fix ✓,
  desktop mode ✓. Spiral keyboard open-via-Y not verified yet (was mid-debug).
  Stale Turbopack CSS issue resolved via dev-server restart.
- 2026-07-05: User escalated scope: dynamic DB-backed library, learning recommendations,
  Android-TV YouTube UI, custom icons, banners. Diary created. Next: Neon integration → schema →
  rebuild library as DB-driven → recommendations engine → YouTube leanback UI → icon/banner art →
  full click-by-click test pass.
- 2026-07-05 (final test pass, post-overhaul): tsc clean. Verified in browser click-by-click:
  discovery banner render/rotate/page ✓, X dismiss re-ranks instantly ✓, quick settings + volume
  65→75 no HUD overlap ✓, desktop mode w/ simulated editor ✓, spiral keyboard typed "da" ✓,
  launch splash + usage event recorded ✓ (Steam), library manager list/detail/hints ✓,
  YouTube leanback with real current videos (MKBHD 2-days-ago) ✓, banner Watch opens service URL ✓.
  Test artifacts cleaned: content_feedback rows + test Steam usage event deleted so the user's
  taste profile starts neutral. Remaining backlog: Rust global Guide hook, Steam/Epic manifest
  scan, Tauri SQL plugin swap, Windows build instructions doc, YT row virtualization.
- 2026-07-05 (data-connection session): User asked how existing/upcoming data connects and what's
  incomplete in Prime/Crunchyroll. Answer implemented: Brave-history import pipeline (only local
  source of Prime/Crunchyroll truth — no public watch APIs exist) → watch_history → Continue
  Watching row + genre taste via TVmaze. Full regression pass: home banner shows
  "Because you watch Action" ✓, Continue Watching cards w/ One Piece Ep 1071 (2h ago) ✓,
  row nav + focus ✓, desktop toggle ✓. Rust core finished: Guide hook, game scan, history reader.
  Game import API tested incl. Epic id-casing bugfix + cleanup of test rows (Cyberpunk/Fortnite
  deleted). BUILD-WINDOWS.md written. tsc clean. Remaining: Tauri SQL swap (native-build-time),
  YT row virtualization (only matters at scale), YT channel manager UI.
- 2026-07-06 (easy-install session): User asked for one-click install. DECISION: the app has API
  routes + SQLite so static export is impossible — exe embeds the Next standalone server +
  portable node.exe as Tauri resources; Rust boots it hidden on 127.0.0.1:3210, kills on exit
  (RunEvent::Exit), data in %APPDATA%\NovaShell via NOVASHELL_DATA_DIR env (db path override
  in lib/db/index.ts). Changes: next.config output:'standalone', tauri.conf frontendDist/url
  → :3210 + bundle.resources, main.rs spawn_embedded_server + kill_embedded_server,
  .github/workflows/build-windows.yml (windows-latest: pnpm build → prepare resources →
  tauri build → artifact upload; version tags v* → GitHub Release w/ setup exe).
  VERIFIED: pnpm build standalone OK; ran standalone server.js with custom data dir exactly
  as the exe will — home 200 ✓, /api/library serves ✓, DB created in override dir ✓; dev
  preview unaffected ✓. data/ + src-tauri/{target,resources} gitignored; DB untracked from git.
  NOTE: GitHub repo NOT yet connected in v0 — user must connect (Settings → Git), then
  Actions builds NovaShell-Setup automatically; `git tag v0.1.0 && git push --tags` = release link.
- 2026-07-06 (auto-update pipeline session): User asked for updates with zero manual steps.
  DONE: created private repo github.com/paraskavitkar/novashell via gh CLI (user approved,
  blanket push permission granted), remote `github`, pushed master — Actions workflow
  triggered automatically (run 28752073922, building the installer). UPDATES.md written:
  full pipeline doc (push → CI → installer; tags → Releases; gh commands to watch/debug
  builds; rules for v0 each session). Memory updated with repo + push workflow so every
  future session pushes at end after browser testing. Distribution is now fully hands-off.
- 2026-07-06 (pipeline debugging → FIRST RELEASE SHIPPED): Three CI failures fixed in-session:
  (1) missing icons/icon.ico — Windows Tauri builds REQUIRE it; generated nova icon via
  tauri-cli icon command, wired bundle.icon in tauri.conf. (2) plain `git push github master`
  silently no-ops from v0's working branch — must use HEAD:master (UPDATES.md + memory
  corrected). (3) release publish 403 — workflow needs `permissions: contents: write`.
  Also mid-session: repo 404'd unexpectedly (external deletion?) — recreated, re-pushed,
  cache made second build faster. RESULT: v0.1.0 release LIVE with
  NovaShell_0.1.0_x64-setup.exe (68 MB):
  https://github.com/paraskavitkar/novashell/releases/tag/v0.1.0
  Pipeline fully proven end-to-end: push → green build → tag → release with installer.
