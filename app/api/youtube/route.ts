import { NextResponse } from 'next/server'
import { getSetting, setSetting } from '@/lib/db/settings'

export const dynamic = 'force-dynamic'

interface Video {
  id: string
  title: string
  channel: string
  channelId: string
  thumbnail: string
  published: string
}

const DEFAULT_CHANNELS: Array<{ id: string; name: string }> = [
  { id: 'UCBJycsmduvYEL83R_U4JriQ', name: 'MKBHD' },
  { id: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship' },
  { id: 'UCXuqSBlHAE6Xw-yeJA0Tunw', name: 'Linus Tech Tips' },
  { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium' },
  { id: 'UCR1IuLEqb6UEA_zQ81kwXfg', name: 'Real Engineering' },
]

// naive in-memory cache (per server process), keyed by the channel list
// so edits via /api/youtube/channels invalidate it immediately
let cache: { at: number; key: string; rows: unknown } | null = null
const CACHE_MS = 10 * 60_000

function parseEntries(xml: string, channelId: string): Video[] {
  const videos: Video[] = []
  const channelName = xml.match(/<title>([^<]+)<\/title>/)?.[1] ?? 'Channel'
  const entries = xml.split('<entry>').slice(1)
  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? ''
    if (!id || !title) continue
    videos.push({
      id,
      title: decodeEntities(title),
      channel: decodeEntities(channelName),
      channelId,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published,
    })
  }
  return videos
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function getChannels(): Array<{ id: string; name: string }> {
  const raw = getSetting('youtube_channels')
  if (!raw) {
    setSetting('youtube_channels', JSON.stringify(DEFAULT_CHANNELS))
    return DEFAULT_CHANNELS
  }
  try {
    return JSON.parse(raw)
  } catch {
    return DEFAULT_CHANNELS
  }
}

export async function GET() {
  const channels = getChannels()
  const key = channels.map((c) => c.id).join(',')
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.rows)
  }
  const results = await Promise.allSettled(
    channels.map(async (ch) => {
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`,
        { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) throw new Error(`feed ${ch.id}: ${res.status}`)
      const xml = await res.text()
      const videos = parseEntries(xml, ch.id).slice(0, 12)
      return { channel: videos[0]?.channel ?? ch.name, channelId: ch.id, videos }
    })
  )

  const rows = results
    .filter((r): r is PromiseFulfilledResult<{ channel: string; channelId: string; videos: Video[] }> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.videos.length > 0)

  const payload = { rows }
  cache = { at: Date.now(), key, rows: payload }
  return NextResponse.json(payload)
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'expected array of {id, name}' }, { status: 400 })
  }
  setSetting('youtube_channels', JSON.stringify(body))
  cache = null
  return NextResponse.json({ ok: true })
}
