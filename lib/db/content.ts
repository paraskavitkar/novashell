import { getDb } from './index'
import { getWatchedSeries } from './watch-history'

/**
 * Content discovery engine.
 *
 * Sources currently-airing / popular shows from TVmaze (free, no API key),
 * then re-ranks them against the user's learned genre taste:
 *   +  weight for genres of content the user opened
 *   -  heavier weight for genres of content the user dismissed ("not interested")
 * Dismissed items themselves are hard-excluded.
 */

export interface ContentItem {
  id: string // tvmaze:<id>
  title: string
  image: string // large landscape-ish artwork
  genres: string[]
  rating: number | null
  summary: string
  service: 'crunchyroll' | 'prime-video' | 'youtube' | 'web'
  serviceLabel: string
  url: string // where to open it
  score: number
  reason: string
}

interface TvmazeShow {
  id: number
  name: string
  genres: string[]
  rating?: { average: number | null }
  image?: { original?: string; medium?: string } | null
  summary?: string | null
  premiered?: string | null
  network?: { name: string } | null
  webChannel?: { name: string } | null
  language?: string | null
}

// ---- taste profile ----------------------------------------------------------

export function getGenreWeights(): Record<string, number> {
  const db = getDb()
  const rows = db
    .prepare(`SELECT verdict, genres FROM content_feedback ORDER BY ts DESC LIMIT 400`)
    .all() as Array<{ verdict: string; genres: string }>

  const weights: Record<string, number> = {}
  for (const row of rows) {
    let genres: string[] = []
    try {
      genres = JSON.parse(row.genres)
    } catch {
      /* ignore malformed rows */
    }
    for (const g of genres) {
      const delta = row.verdict === 'opened' ? 1 : -1.6
      weights[g] = (weights[g] ?? 0) + delta
    }
  }
  return weights
}

export function getDismissedContentIds(): Set<string> {
  const db = getDb()
  const rows = db
    .prepare(`SELECT DISTINCT content_id FROM content_feedback WHERE verdict = 'dismissed'`)
    .all() as Array<{ content_id: string }>
  return new Set(rows.map((r) => r.content_id))
}

export function recordContentFeedback(input: {
  content_id: string
  title: string
  verdict: 'opened' | 'dismissed'
  genres: string[]
}) {
  const db = getDb()
  db.prepare(
    `INSERT INTO content_feedback (content_id, title, verdict, genres) VALUES (?, ?, ?, ?)`,
  ).run(input.content_id, input.title, input.verdict, JSON.stringify(input.genres))
}

// ---- watch-history taste (cached genre lookups) -----------------------------

/**
 * Resolve watched series (from Brave history import) to TVmaze genres.
 * Each watched series contributes its genres to the taste profile, weighted by
 * engagement (visit count, capped). Results cached: series names rarely change.
 */
let historyTasteCache: { key: string; weights: Record<string, number>; watched: Set<string> } | null =
  null

async function getHistoryTaste(): Promise<{ weights: Record<string, number>; watched: Set<string> }> {
  const series = getWatchedSeries(12)
  const key = series.map((s) => `${s.series}:${s.visits}`).join('|')
  if (historyTasteCache && historyTasteCache.key === key) return historyTasteCache

  const weights: Record<string, number> = {}
  const watched = new Set<string>()

  await Promise.all(
    series.map(async ({ series: name, visits }) => {
      try {
        const res = (await fetchJson(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(name)}`,
        )) as TvmazeShow | null
        if (!res) return
        watched.add(res.name.toLowerCase())
        const engagement = Math.min(visits, 6) / 2 // 0.5 .. 3
        for (const g of res.genres) weights[g] = (weights[g] ?? 0) + engagement
      } catch {
        /* unmatched series — fine */
      }
    }),
  )

  historyTasteCache = { key, weights, watched }
  return historyTasteCache
}

// ---- source fetching (cached) ----------------------------------------------

let poolCache: { at: number; shows: TvmazeShow[] } | null = null
const POOL_CACHE_MS = 30 * 60_000

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

/** Currently airing (today's schedule, US + JP for anime) + top-rated pages. */
async function fetchShowPool(): Promise<TvmazeShow[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_CACHE_MS) return poolCache.shows

  const byId = new Map<number, TvmazeShow>()

  const tasks: Array<Promise<void>> = [
    // Airing today — captures "trending right now"
    ...['US', 'JP', 'GB'].map(async (country) => {
      try {
        const eps = (await fetchJson(
          `https://api.tvmaze.com/schedule?country=${country}`,
        )) as Array<{ show?: TvmazeShow }>
        for (const ep of eps) {
          if (ep.show?.image) byId.set(ep.show.id, ep.show)
        }
      } catch {
        /* source down — tolerate */
      }
    }),
    // Streaming/web schedule — Prime, Netflix-style webChannels
    (async () => {
      try {
        const eps = (await fetchJson(
          `https://api.tvmaze.com/schedule/web?`,
        )) as Array<{ _embedded?: { show?: TvmazeShow } }>
        for (const ep of eps) {
          const show = ep._embedded?.show
          if (show?.image) byId.set(show.id, show)
        }
      } catch {
        /* tolerate */
      }
    })(),
  ]

  await Promise.all(tasks)

  const shows = Array.from(byId.values())
  if (shows.length > 0) poolCache = { at: Date.now(), shows }
  return shows
}

// ---- service mapping ---------------------------------------------------------

function mapService(show: TvmazeShow): Pick<ContentItem, 'service' | 'serviceLabel' | 'url'> {
  const isAnime =
    show.genres.includes('Anime') ||
    (show.language === 'Japanese' && show.genres.includes('Animation'))
  if (isAnime) {
    return {
      service: 'crunchyroll',
      serviceLabel: 'Crunchyroll',
      url: `https://www.crunchyroll.com/search?q=${encodeURIComponent(show.name)}`,
    }
  }
  const channel = (show.webChannel?.name ?? '').toLowerCase()
  if (channel.includes('prime') || channel.includes('amazon')) {
    return {
      service: 'prime-video',
      serviceLabel: 'Prime Video',
      url: `https://www.primevideo.com/search/?phrase=${encodeURIComponent(show.name)}`,
    }
  }
  if (channel.includes('youtube')) {
    return {
      service: 'youtube',
      serviceLabel: 'YouTube',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(show.name)}`,
    }
  }
  return {
    service: 'web',
    serviceLabel: show.webChannel?.name || show.network?.name || 'Watch',
    url: `https://www.google.com/search?q=${encodeURIComponent(`watch ${show.name}`)}`,
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ---- public API --------------------------------------------------------------

export async function getTrendingForTaste(limit = 8): Promise<ContentItem[]> {
  const [shows, feedbackWeights, dismissed, historyTaste] = await Promise.all([
    fetchShowPool(),
    Promise.resolve(getGenreWeights()),
    Promise.resolve(getDismissedContentIds()),
    getHistoryTaste(),
  ])

  // Merge: explicit feedback (opened/dismissed in shell) + imported watch history
  const weights: Record<string, number> = { ...historyTaste.weights }
  for (const [g, w] of Object.entries(feedbackWeights)) weights[g] = (weights[g] ?? 0) + w

  const hasTaste = Object.keys(weights).length > 0

  const items = shows
    .filter((s) => s.image?.original && !dismissed.has(`tvmaze:${s.id}`))
    .map((s) => {
      const base = s.rating?.average ?? 5.5
      let affinity = 0
      for (const g of s.genres) affinity += weights[g] ?? 0
      const isWatched = historyTaste.watched.has(s.name.toLowerCase())
      // shows the user already watches get a strong boost — "new episode of yours"
      const score = affinity * 2 + base + (isWatched ? 12 : 0)

      const top = s.genres.find((g) => (weights[g] ?? 0) > 0)
      const reason = isWatched
        ? 'New episode of a show you watch'
        : hasTaste && top
          ? `Because you watch ${top}`
          : 'Trending now'

      const svc = mapService(s)
      return {
        id: `tvmaze:${s.id}`,
        title: s.name,
        image: s.image!.original!,
        genres: s.genres,
        rating: s.rating?.average ?? null,
        summary: stripHtml(s.summary ?? '').slice(0, 220),
        score,
        reason,
        ...svc,
      } satisfies ContentItem
    })
    .sort((a, b) => b.score - a.score)

  // Diversity: max 3 per service so one provider doesn't own the whole carousel
  const perService: Record<string, number> = {}
  const out: ContentItem[] = []
  for (const item of items) {
    if ((perService[item.service] ?? 0) >= 3) continue
    perService[item.service] = (perService[item.service] ?? 0) + 1
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}
