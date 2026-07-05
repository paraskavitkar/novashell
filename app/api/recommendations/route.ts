import { NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/db/recommendations'
import { recordFeedback } from '@/lib/db/usage'
import { getApp } from '@/lib/db/apps'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const hour = clamp(Number(url.searchParams.get('hour')), 0, 23)
  const dow = clamp(Number(url.searchParams.get('dow')), 0, 6)
  const recs = getRecommendations({ hour, dow, ts: Math.floor(Date.now() / 1000) }, 3)
  return NextResponse.json(recs)
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body?.app_id || !getApp(body.app_id)) {
    return NextResponse.json({ error: 'valid app_id required' }, { status: 400 })
  }
  const verdict = body.verdict === 'dismissed' ? 'dismissed' : 'opened'
  recordFeedback({ app_id: body.app_id, verdict })
  return NextResponse.json({ ok: true }, { status: 201 })
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : min
}
