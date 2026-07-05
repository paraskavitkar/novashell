import { NextResponse } from 'next/server'
import { recordUsage, recentActivity } from '@/lib/db/usage'
import { getApp } from '@/lib/db/apps'

export async function GET() {
  return NextResponse.json(recentActivity(30))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body?.app_id || !getApp(body.app_id)) {
    return NextResponse.json({ error: 'valid app_id required' }, { status: 400 })
  }
  const hour = Number.isInteger(body.hour) && body.hour >= 0 && body.hour <= 23 ? body.hour : 0
  const dow = Number.isInteger(body.dow) && body.dow >= 0 && body.dow <= 6 ? body.dow : 0
  recordUsage({
    app_id: body.app_id,
    action: typeof body.action === 'string' ? body.action : 'launch',
    hour,
    dow,
    session_seconds: Number.isFinite(body.session_seconds) ? body.session_seconds : 0,
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}
