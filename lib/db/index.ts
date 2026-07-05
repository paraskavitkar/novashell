import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'gamepad-ux.db')

export function getDb(): Database.Database {
  if (db) return db
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedIfEmpty(db)
  return db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'apps',        -- games | media | apps | system
      source TEXT NOT NULL DEFAULT 'custom',        -- steam | epic | browser | exe | builtin | custom
      launch_target TEXT NOT NULL DEFAULT '',       -- steam://, url, exe path, builtin:*
      image TEXT NOT NULL DEFAULT '',               -- key art path
      icon TEXT NOT NULL DEFAULT 'app-window',      -- lucide icon name fallback
      accent TEXT NOT NULL DEFAULT '#22d3ee',
      description TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      action TEXT NOT NULL DEFAULT 'launch',        -- launch | focus | session_end
      ts INTEGER NOT NULL DEFAULT (unixepoch()),
      hour INTEGER NOT NULL,                        -- 0-23 local hour, provided by client
      dow INTEGER NOT NULL,                         -- 0-6 local day of week
      session_seconds INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_app ON usage_events(app_id, ts);

    CREATE TABLE IF NOT EXISTS suggestion_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      verdict TEXT NOT NULL,                        -- dismissed | opened
      ts INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_app ON suggestion_feedback(app_id, ts);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // v3: content taste learning — feedback on shows/movies surfaced in the discovery banner
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id TEXT NOT NULL,                     -- e.g. tvmaze:123
      title TEXT NOT NULL DEFAULT '',
      verdict TEXT NOT NULL,                        -- opened | dismissed
      genres TEXT NOT NULL DEFAULT '[]',            -- JSON array of genre strings
      ts INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_content_feedback ON content_feedback(content_id, ts);
  `)

  // v4: imported watch history (Brave profile import via native layer)
  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,                        -- crunchyroll | prime-video | youtube
      series TEXT NOT NULL,                         -- normalized series/show title
      episode TEXT NOT NULL DEFAULT '',             -- episode label if parseable
      url TEXT NOT NULL,                            -- deep link back to the exact page
      title_raw TEXT NOT NULL DEFAULT '',           -- original page title
      watched_at INTEGER NOT NULL,                  -- unix seconds of the visit
      UNIQUE(url, watched_at)
    );
    CREATE INDEX IF NOT EXISTS idx_watch_service ON watch_history(service, watched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_watch_series ON watch_history(series, watched_at DESC);
  `)

  // v5: REAL playback positions captured live via CDP (Brave --remote-debugging-port).
  // One row per media URL, continuously upserted while a video plays.
  db.exec(`
    CREATE TABLE IF NOT EXISTS playback_positions (
      url TEXT PRIMARY KEY,
      service TEXT NOT NULL,                        -- crunchyroll | prime-video | youtube
      series TEXT NOT NULL,
      episode TEXT NOT NULL DEFAULT '',
      title_raw TEXT NOT NULL DEFAULT '',
      position_secs REAL NOT NULL DEFAULT 0,        -- video.currentTime
      duration_secs REAL,                           -- video.duration (null if unknown/live)
      paused INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_playback_series ON playback_positions(series, updated_at DESC);
  `)

  // v2: wide cinematic banner artwork for the hero carousel
  const cols = db.prepare(`PRAGMA table_info(apps)`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'banner')) {
    db.exec(`ALTER TABLE apps ADD COLUMN banner TEXT NOT NULL DEFAULT ''`)
    const setBanner = db.prepare('UPDATE apps SET banner = ? WHERE id = ?')
    for (const [id, banner] of [
      ['youtube', '/banners/youtube.png'],
      ['prime-video', '/banners/prime-video.png'],
      ['crunchyroll', '/banners/crunchyroll.png'],
      ['spotify', '/banners/spotify.png'],
      ['steam', '/banners/steam.png'],
      ['brave', '/banners/brave.png'],
      // games reuse their key art as banner
      ['neon-drift', '/games/neon-drift.png'],
      ['starfall', '/games/starfall.png'],
      ['emberkeep', '/games/emberkeep.png'],
      ['skybound', '/games/skybound.png'],
      ['vanguard', '/games/vanguard.png'],
      ['apex-league', '/games/apex-league.png'],
    ]) {
      setBanner.run(banner, id)
    }
  }
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM apps').get() as { c: number }).c
  if (count > 0) return

  const insert = db.prepare(`
    INSERT INTO apps (id, name, category, source, launch_target, image, icon, accent, description, pinned, sort_order)
    VALUES (@id, @name, @category, @source, @launch_target, @image, @icon, @accent, @description, @pinned, @sort_order)
  `)

  const seed = db.transaction((rows: Record<string, unknown>[]) => {
    for (const r of rows) insert.run(r)
  })

  seed([
    // Games (user-editable examples with generated key art; user can delete/replace)
    { id: 'neon-drift', name: 'Neon Drift', category: 'games', source: 'steam', launch_target: 'steam://rungameid/0', image: '/games/neon-drift.png', icon: 'gamepad-2', accent: '#22d3ee', description: 'Cyberpunk street racing', pinned: 1, sort_order: 0 },
    { id: 'starfall', name: 'Starfall', category: 'games', source: 'steam', launch_target: 'steam://rungameid/0', image: '/games/starfall.png', icon: 'gamepad-2', accent: '#38bdf8', description: 'Open-galaxy exploration', pinned: 1, sort_order: 1 },
    { id: 'emberkeep', name: 'Emberkeep', category: 'games', source: 'epic', launch_target: 'com.epicgames.launcher://apps/emberkeep?action=launch', image: '/games/emberkeep.png', icon: 'gamepad-2', accent: '#fb923c', description: 'Dark fantasy action RPG', pinned: 1, sort_order: 2 },
    { id: 'skybound', name: 'Skybound', category: 'games', source: 'epic', launch_target: 'com.epicgames.launcher://apps/skybound?action=launch', image: '/games/skybound.png', icon: 'gamepad-2', accent: '#4ade80', description: 'Sky-island adventure', pinned: 0, sort_order: 3 },
    { id: 'vanguard', name: 'Vanguard Protocol', category: 'games', source: 'steam', launch_target: 'steam://rungameid/0', image: '/games/vanguard.png', icon: 'gamepad-2', accent: '#a3e635', description: 'Tactical squad shooter', pinned: 0, sort_order: 4 },
    { id: 'apex-league', name: 'Apex League 26', category: 'games', source: 'steam', launch_target: 'steam://rungameid/0', image: '/games/apex-league.png', icon: 'gamepad-2', accent: '#f59e0b', description: 'Pro football sim', pinned: 0, sort_order: 5 },
    // Media (first-class, open via Brave in native layer)
    { id: 'youtube', name: 'YouTube', category: 'media', source: 'browser', launch_target: 'builtin:youtube-tv', image: '/icons/youtube.png', icon: 'play', accent: '#ef4444', description: 'Android TV style leanback UI', pinned: 1, sort_order: 0 },
    { id: 'prime-video', name: 'Prime Video', category: 'media', source: 'browser', launch_target: 'https://www.primevideo.com', image: '/icons/prime-video.png', icon: 'clapperboard', accent: '#38bdf8', description: 'Movies and originals', pinned: 1, sort_order: 1 },
    { id: 'crunchyroll', name: 'Crunchyroll', category: 'media', source: 'browser', launch_target: 'https://www.crunchyroll.com', image: '/icons/crunchyroll.png', icon: 'tv', accent: '#f97316', description: 'Anime streaming', pinned: 1, sort_order: 2 },
    { id: 'spotify', name: 'Spotify', category: 'media', source: 'exe', launch_target: 'spotify:', image: '/icons/spotify.png', icon: 'music', accent: '#22c55e', description: 'Music streaming', pinned: 0, sort_order: 3 },
    // Apps
    { id: 'brave', name: 'Brave', category: 'apps', source: 'exe', launch_target: 'brave.exe', image: '/icons/brave.png', icon: 'globe', accent: '#fb923c', description: 'Browser (your profile, your accounts)', pinned: 1, sort_order: 0 },
    { id: 'steam', name: 'Steam', category: 'apps', source: 'exe', launch_target: 'steam://open/bigpicture', image: '/icons/steam.png', icon: 'library', accent: '#38bdf8', description: 'Game library', pinned: 0, sort_order: 1 },
    { id: 'epic', name: 'Epic Games', category: 'apps', source: 'exe', launch_target: 'com.epicgames.launcher://', image: '/icons/epic.png', icon: 'library', accent: '#e2e8f0', description: 'Game launcher', pinned: 0, sort_order: 2 },
    { id: 'cursor', name: 'Cursor', category: 'apps', source: 'exe', launch_target: 'cursor.exe', image: '/icons/cursor.png', icon: 'file-code-2', accent: '#22d3ee', description: 'Code editor (desktop mode)', pinned: 0, sort_order: 3 },
    // System (builtin, not deletable in UI)
    { id: 'sys-desktop', name: 'Desktop Mode', category: 'system', source: 'builtin', launch_target: 'builtin:desktop', image: '', icon: 'mouse-pointer-2', accent: '#22d3ee', description: 'Virtual mouse + keyboard', pinned: 0, sort_order: 0 },
    { id: 'sys-library', name: 'Manage Library', category: 'system', source: 'builtin', launch_target: 'builtin:library', image: '', icon: 'settings-2', accent: '#e2e8f0', description: 'Add, edit, remove apps', pinned: 0, sort_order: 1 },
    { id: 'sys-windows', name: 'Return to Windows', category: 'system', source: 'builtin', launch_target: 'builtin:exit', image: '', icon: 'log-out', accent: '#f87171', description: 'Exit to standard Windows', pinned: 0, sort_order: 2 },
  ])
}
