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

### Known issues / polish backlog
- [ ] Library list: focused row auto-scroll added — retest after next session
- [ ] Volume HUD overlaps Quick Settings slider visually (minor)
- [ ] YouTube TV: row virtualization if subscriptions grow large
- [ ] Settings screen for managing YouTube channel subscriptions (API supports it; no UI yet)

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
