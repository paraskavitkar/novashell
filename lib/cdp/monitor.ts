import { getDb } from '@/lib/db'
import { parseHistoryEntry } from '@/lib/db/watch-history'

/**
 * CDP playback monitor — the "Android TV grade" Continue Watching source.
 *
 * The shell launches Brave with --remote-debugging-port=9222. This monitor
 * polls the DevTools endpoint, finds tabs (and player IFRAMES — Crunchyroll's
 * video lives in a cross-origin iframe that appears as its own CDP target
 * with a parentId) on streaming sites, attaches over WebSocket one-shot, and
 * reads the actual <video> element state: currentTime / duration / paused.
 *
 * Real positions land in playback_positions, keyed by URL, continuously
 * upserted while you watch. Title parsing (watch-history.ts) remains only a
 * cold-start fallback for history from before the shell existed.
 *
 * Zero dependencies: Node 22+ ships a native WebSocket client.
 */

const POLL_MS = 4000

/** Port priority: settings table (`cdp_port`) → env → 9222 default. */
function getCdpPort(): number {
  try {
    const row = getDb().prepare(`SELECT value FROM settings WHERE key = 'cdp_port'`).get() as
      | { value: string }
      | undefined
    if (row && Number.isFinite(Number(row.value))) return Number(row.value)
  } catch {
    /* settings unavailable — fall through */
  }
  return Number(process.env.CDP_PORT ?? 9222)
}
const STREAM_URL = /crunchyroll\.com|primevideo\.com|amazon\.[a-z.]+\/gp\/video|youtube\.com\/watch/

interface CdpTarget {
  id: string
  type: string // page | iframe | ...
  url: string
  title: string
  parentId?: string
  webSocketDebuggerUrl?: string
}

interface VideoState {
  currentTime: number
  duration: number | null
  paused: boolean
}

/** Expression evaluated inside the target: state of the most relevant <video>. */
const VIDEO_PROBE = `(() => {
  const vids = [...document.querySelectorAll('video')]
    .filter(v => v.readyState > 0 && (v.duration > 0 || v.currentTime > 0))
    .sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight));
  const v = vids[0];
  if (!v) return null;
  return JSON.stringify({
    currentTime: v.currentTime,
    duration: Number.isFinite(v.duration) ? v.duration : null,
    paused: v.paused,
  });
})()`

/** One-shot CDP call: connect, Runtime.evaluate, close. */
function probeTarget(wsUrl: string): Promise<VideoState | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (val: VideoState | null) => {
      if (!settled) {
        settled = true
        resolve(val)
      }
    }
    try {
      const ws = new WebSocket(wsUrl)
      const timer = setTimeout(() => {
        ws.close()
        done(null)
      }, 3000)
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression: VIDEO_PROBE, returnByValue: true },
          }),
        )
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data))
          if (msg.id !== 1) return
          clearTimeout(timer)
          ws.close()
          const raw = msg.result?.result?.value
          done(raw ? (JSON.parse(raw) as VideoState) : null)
        } catch {
          clearTimeout(timer)
          ws.close()
          done(null)
        }
      }
      ws.onerror = () => {
        clearTimeout(timer)
        done(null)
      }
    } catch {
      done(null)
    }
  })
}

function upsertPlayback(
  pageUrl: string,
  pageTitle: string,
  video: VideoState,
): 'stored' | 'unparsed' {
  const parsed = parseHistoryEntry({ url: pageUrl, title: pageTitle, visited_at: 0 })
  if (!parsed) return 'unparsed'
  const db = getDb()
  db.prepare(
    `INSERT INTO playback_positions
       (url, service, series, episode, title_raw, position_secs, duration_secs, paused, updated_at)
     VALUES (@url, @service, @series, @episode, @title_raw, @position, @duration, @paused, unixepoch())
     ON CONFLICT(url) DO UPDATE SET
       position_secs = @position,
       duration_secs = @duration,
       paused = @paused,
       series = @series,
       episode = @episode,
       title_raw = @title_raw,
       updated_at = unixepoch()`,
  ).run({
    url: pageUrl,
    service: parsed.service,
    series: parsed.series,
    episode: parsed.episode,
    title_raw: pageTitle,
    position: video.currentTime,
    duration: video.duration,
    paused: video.paused ? 1 : 0,
  })
  return 'stored'
}

async function tick(): Promise<void> {
  let targets: CdpTarget[]
  try {
    const res = await fetch(`http://127.0.0.1:${getCdpPort()}/json/list`, {
      signal: AbortSignal.timeout(2000),
    })
    targets = (await res.json()) as CdpTarget[]
  } catch {
    return // Brave not running / port closed — completely normal, retry next tick
  }

  const byId = new Map(targets.map((t) => [t.id, t]))

  for (const t of targets) {
    if (!t.webSocketDebuggerUrl) continue
    if (t.type !== 'page' && t.type !== 'iframe') continue

    // The page whose URL/title we attribute playback to: for iframes (e.g.
    // Crunchyroll's player), walk up to the parent page target.
    let owner: CdpTarget = t
    while (owner.parentId && byId.get(owner.parentId)) {
      owner = byId.get(owner.parentId) as CdpTarget
    }
    if (!STREAM_URL.test(owner.url) && !STREAM_URL.test(t.url)) continue

    const video = await probeTarget(t.webSocketDebuggerUrl)
    if (!video || video.currentTime <= 0) continue
    upsertPlayback(owner.url, owner.title, video)
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __cdpMonitorGen: number | undefined
}

/**
 * Idempotent per module load: starts the background poll loop. On dev HMR the
 * module reloads with a new generation number — the old loop sees the bumped
 * generation and stops itself, so exactly one CURRENT loop runs.
 */
export function ensureCdpMonitor(): void {
  const myGen = (globalThis.__cdpMonitorGen ?? 0) + 1
  if (globalThis.__cdpMonitorGen === undefined) {
    globalThis.__cdpMonitorGen = 0
  }
  // another loop from THIS module version already running
  if (moduleLoopRunning) return
  moduleLoopRunning = true
  globalThis.__cdpMonitorGen = myGen
  const loop = async () => {
    if (globalThis.__cdpMonitorGen !== myGen) return // superseded by newer module
    try {
      await tick()
    } catch {
      /* never let the loop die */
    }
    setTimeout(loop, POLL_MS)
  }
  loop()
}

let moduleLoopRunning = false
