import { NextResponse } from 'next/server'
import { getTrendingForTaste, recordContentFeedback } from '@/lib/db/content'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await getTrendingForTaste(8)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[content] trending failed:', err)
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    content_id?: string
    title?: string
    verdict?: 'opened' | 'dismissed'
    genres?: string[]
  }
  if (!body.content_id || !body.verdict || !['opened', 'dismissed'].includes(body.verdict)) {
    return NextResponse.json({ error: 'content_id and valid verdict required' }, { status: 400 })
  }
  recordContentFeedback({
    content_id: body.content_id,
    title: body.title ?? '',
    verdict: body.verdict,
    genres: Array.isArray(body.genres) ? body.genres.slice(0, 12) : [],
  })
  return NextResponse.json({ ok: true })
}
