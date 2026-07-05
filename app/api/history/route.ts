import { NextResponse } from 'next/server'
import { getContinueWatching, importHistory, type RawHistoryEntry } from '@/lib/db/watch-history'

export const runtime = 'nodejs'

/** GET /api/history — Continue Watching list */
export async function GET() {
  return NextResponse.json({ items: getContinueWatching() })
}

/**
 * POST /api/history — bulk import raw browser-history entries.
 * Called by the native layer after reading the Brave History file.
 * Body: { entries: [{ url, title, visited_at }] }
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { entries?: RawHistoryEntry[] }
  const entries = Array.isArray(body.entries) ? body.entries : []
  if (entries.length === 0) {
    return NextResponse.json({ error: 'entries required' }, { status: 400 })
  }
  if (entries.length > 5000) {
    return NextResponse.json({ error: 'too many entries (max 5000 per batch)' }, { status: 400 })
  }
  const valid = entries.filter(
    (e) =>
      typeof e?.url === 'string' &&
      typeof e?.title === 'string' &&
      Number.isFinite(e?.visited_at),
  )
  const result = importHistory(valid)
  return NextResponse.json(result)
}
