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
- [ ] Ship as Tauri desktop app scaffold IN THIS PROJECT (src-tauri/): Rust shell, WebView2 UI
- [ ] Rust commands: process launch (steam://, epic://, exe, Brave), enigo input injection,
      global gamepad hook (Guide button), system volume (Windows Core Audio)
- [ ] Local SQLite lives with the app (same schema); UI served from built static assets — zero server
- [ ] Build instructions for user's Windows PC (download ZIP → pnpm tauri build)
- User has offered full PC access; v0 sandbox cannot execute on their PC — deliverable is a
  ready-to-build native project, not a hosted web app.

### Known issues / polish backlog
- [x] Library list: focused row auto-scroll — RETESTED ✓
- [x] Volume HUD overlaps Quick Settings slider — fixed (suppressed while panel open)
- [ ] YouTube TV: row virtualization if subscriptions grow large
- [x] YouTube channels API (add by @handle w/ resolution, remove) — TESTED ✓; UI pending restyle

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
