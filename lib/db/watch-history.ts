import { getDb } from './index'

/**
 * Watch history — imported from the user's Brave profile by the native layer.
 *
 * The Rust core reads Brave's History SQLite (page URL + title + visit time),
 * filters to streaming domains, and POSTs raw entries to /api/history/import.
 * Here we parse service-specific page titles into (series, episode) and store
 * them for: Continue Watching, taste learning, and "new episode" awareness.
 */

export interface RawHistoryEntry {
  url: string
  title: string
  /** unix seconds */
  visited_at: number
}

export interface WatchEntry {
  service: 'crunchyroll' | 'prime-video' | 'youtube'
  series: string
  episode: string
  url: string
  title_raw: string
  watched_at: number
}

export interface ContinueWatchingItem {
  service: WatchEntry['service']
  serviceLabel: string
  series: string
  episode: string
  url: string
  watched_at: number
  visits: number
}

/* ---------- title parsing ---------- */

const SERVICE_LABEL: Record<WatchEntry['service'], string> = {
  crunchyroll: 'Crunchyroll',
  'prime-video': 'Prime Video',
  youtube: 'YouTube',
}

/**
 * Crunchyroll titles look like:
 *   "Watching One Piece Season 14 Episode 1071 - Crunchyroll"
 *   "One Piece - Watch on Crunchyroll"
 * URLs: crunchyroll.com/watch/<id>/<slug>
 */
function parseCrunchyroll(url: string, title: string): Omit<WatchEntry, 'watched_at'> | null {
  if (!/crunchyroll\.com\/(watch|series)\//.test(url)) return null
  let t = title
    .replace(/\s*[-|–]\s*(Watch on\s*)?Crunchyroll\s*$/i, '')
    .replace(/^Watching\s+/i, '')
    .trim()
  if (!t) return null
  // split "<series> Season X Episode Y" / "<series> Episode Y"
  const m = t.match(/^(.*?)\s+((?:Season\s+\d+\s+)?Episode\s+[\d.]+.*)$/i)
  const series = (m ? m[1] : t).replace(/\s*[-–]\s*$/, '').trim()
  const episode = m ? m[2].trim() : ''
  if (!series) return null
  return { service: 'crunchyroll', series, episode, url, title_raw: title }
}

/**
 * Prime Video titles look like:
 *   "Prime Video: The Boys - Season 4"
 *   "Watch The Boys | Prime Video"
 * URLs: primevideo.com/detail/<id> or /region/detail/...
 */
function parsePrime(url: string, title: string): Omit<WatchEntry, 'watched_at'> | null {
  if (!/primevideo\.com\/.*detail\//.test(url) && !/amazon\.[a-z.]+\/gp\/video/.test(url))
    return null
  let t = title
    .replace(/^Prime Video:\s*/i, '')
    .replace(/^Watch\s+/i, '')
    .replace(/\s*[|–-]\s*Prime Video\s*$/i, '')
    .trim()
  if (!t || /^prime video$/i.test(t)) return null
  const m = t.match(/^(.*?)\s*[-–]\s*(Season\s+\d+.*)$/i)
  const series = (m ? m[1] : t).trim()
  const episode = m ? m[2].trim() : ''
  return { service: 'prime-video', series, episode, url, title_raw: title }
}

/**
 * YouTube: "Some Video Title - YouTube", urls youtube.com/watch?v=
 * Kept for interest signals; not shown in Continue Watching (videos are short-form).
 */
function parseYouTube(url: string, title: string): Omit<WatchEntry, 'watched_at'> | null {
  if (!/youtube\.com\/watch/.test(url)) return null
  const t = title.replace(/\s*-\s*YouTube\s*$/i, '').trim()
  if (!t) return null
  return { service: 'youtube', series: t, episode: '', url, title_raw: title }
}

export function parseHistoryEntry(raw: RawHistoryEntry): WatchEntry | null {
  const parsed =
    parseCrunchyroll(raw.url, raw.title) ??
    parsePrime(raw.url, raw.title) ??
    parseYouTube(raw.url, raw.title)
  if (!parsed) return null
  return { ...parsed, watched_at: raw.visited_at }
}

/* ---------- import ---------- */

export function importHistory(entries: RawHistoryEntry[]): { imported: number; skipped: number } {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO watch_history (service, series, episode, url, title_raw, watched_at)
    VALUES (@service, @series, @episode, @url, @title_raw, @watched_at)
  `)
  let imported = 0
  let skipped = 0
  const run = db.transaction((rows: RawHistoryEntry[]) => {
    for (const raw of rows) {
      const entry = parseHistoryEntry(raw)
      if (!entry) {
        skipped++
        continue
      }
      const res = insert.run(entry)
      if (res.changes > 0) imported++
      else skipped++
    }
  })
  run(entries)
  return { imported, skipped }
}

/* ---------- queries ---------- */

/**
 * Continue Watching: most recent entry per series (Crunchyroll + Prime only),
 * newest first. `visits` = how many entries for that series (engagement signal).
 */
export function getContinueWatching(limit = 10): ContinueWatchingItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT service, series, episode, url, watched_at,
              (SELECT COUNT(*) FROM watch_history w2 WHERE w2.series = w1.series) AS visits
       FROM watch_history w1
       WHERE service IN ('crunchyroll', 'prime-video')
         AND watched_at = (SELECT MAX(watched_at) FROM watch_history w3 WHERE w3.series = w1.series)
       GROUP BY series
       ORDER BY watched_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<Omit<ContinueWatchingItem, 'serviceLabel'>>
  return rows.map((r) => ({ ...r, serviceLabel: SERVICE_LABEL[r.service] }))
}

/** Series names from history, most-engaged first — feeds taste + "what's next". */
export function getWatchedSeries(limit = 12): Array<{ series: string; service: string; visits: number }> {
  const db = getDb()
  return db
    .prepare(
      `SELECT series, service, COUNT(*) AS visits
       FROM watch_history
       WHERE service IN ('crunchyroll', 'prime-video')
       GROUP BY series
       ORDER BY visits DESC, MAX(watched_at) DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ series: string; service: string; visits: number }>
}
