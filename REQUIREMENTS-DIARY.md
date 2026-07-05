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
- [ ] PS5/Android-TV style full-screen home: horizontal focus-based tile rows, hero banner for focused item
- [ ] Instant mode switch: Xbox/Guide button opens shell; one keyboard key returns to normal Windows (native layer)
- [ ] Dark mode, minimalist, cinematic; smooth fast animations everywhere
- [ ] Easy volume controls (overlay HUD)
- [ ] Quick settings overlay
- [ ] Easy multimedia navigation

### Library (fully user-customizable — NOT hardcoded)
- [ ] User can manually ADD games/apps (name, artwork, category, launch target)
- [ ] User can EDIT and DELETE entries
- [ ] User can customize artwork — custom theme-based icons for famous apps (generate these)
- [ ] Steam games, Epic games, YouTube, Prime Video, Crunchyroll, Brave browser as first-class entries
- [ ] Persisted in a real database (no localStorage)

### Recommendations engine (learning, not fake)
- [ ] Banner on home giving suggestions for Crunchyroll / Prime Video / YouTube
- [ ] Learns from usage patterns tracked in the shell: what user opens, time of day, frequency, day-of-week
- [ ] "Don't suggest this" option on any suggestion — engine must learn from rejection
- [ ] Monitors in-shell activity history continuously
- [ ] NOTE (honest constraint): real Prime/Crunchyroll watch-history APIs don't exist publicly.
      Recommendations are driven by in-shell usage tracking + manual preferences.
      Native layer can later add Brave-session-based history import.

### YouTube
- [ ] YouTube presented with **Android TV-like UI** (leanback style: rows, big thumbnails, focus navigation)
- [ ] Opens with same Brave data/accounts (native layer responsibility — shell opens URLs via Brave)

### Controller (Cosmic Byte Ares Pro, XInput mode)
- [ ] Full Gamepad API support: D-pad + left stick navigation, A select, B back, Y keyboard, etc.
- [ ] Keyboard arrows/Enter/Escape mirror controller for testing
- [ ] Smooth, easy-to-navigate virtual cursor (stick-driven, acceleration curve)
- [ ] Scroll via right stick / triggers
- [ ] Spiral/radial on-screen keyboard (Controller Companion style)
- [ ] Button mapping display / hints on screen

### Modes
- [ ] Console home (launcher)
- [ ] Desktop/app mode: virtual mouse + keyboard over regular apps (simulated in web; native injects real input)
- [ ] "Return to Windows" exit action

### Native layer (future — Tauri; documented, not buildable in v0 sandbox)
- Real process launching (steam://, com.epicgames.launcher://, exe paths, Brave with URL)
- Real mouse/keyboard injection (enigo)
- Global Xbox-button hook, global keyboard-key return hook
- System volume control
- Brave-profile history import for better recommendations

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
