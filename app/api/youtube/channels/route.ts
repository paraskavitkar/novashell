import { NextResponse } from 'next/server'
import { getSetting, setSetting } from '@/lib/db/settings'

export const dynamic = 'force-dynamic'

interface Channel {
  id: string
  name: string
}

function readChannels(): Channel[] {
  const raw = getSetting('youtube_channels')
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeChannels(channels: Channel[]) {
  setSetting('youtube_channels', JSON.stringify(channels))
}

/** Resolve a @handle or channel URL to a UC... channel id by scraping the channel page. */
async function resolveHandle(handle: string): Promise<Channel | null> {
  const clean = handle.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//, '')
  const path = clean.startsWith('@') ? clean : `@${clean}`
  try {
    const res = await fetch(`https://www.youtube.com/${encodeURIComponent(path)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const id = html.match(/"channelId":"(UC[\w-]{22})"/)?.[1]
    const name =
      html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? path.slice(1)
    if (!id) return null
    return { id, name }
  } catch {
    return null
  }
}

export async function GET() {
  return NextResponse.json(readChannels())
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { query?: string } | null
  const query = body?.query?.trim()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  let channel: Channel | null = null
  if (/^UC[\w-]{22}$/.test(query)) {
    // raw channel id — fetch the RSS feed to confirm + get the name
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${query}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const xml = await res.text()
        const name = xml.match(/<title>([^<]+)<\/title>/)?.[1] ?? query
        channel = { id: query, name }
      }
    } catch {
      channel = null
    }
  } else {
    channel = await resolveHandle(query)
  }

  if (!channel) {
    return NextResponse.json({ error: 'channel not found' }, { status: 404 })
  }

  const channels = readChannels()
  if (!channels.some((c) => c.id === channel.id)) {
    channels.push(channel)
    writeChannels(channels)
  }
  return NextResponse.json(channel)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  writeChannels(readChannels().filter((c) => c.id !== id))
  return NextResponse.json({ ok: true })
}
