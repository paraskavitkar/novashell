import { NextResponse } from 'next/server'
import { listApps, createApp } from '@/lib/db/apps'

export async function GET() {
  return NextResponse.json(listApps())
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body?.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const category = ['games', 'media', 'apps'].includes(body.category) ? body.category : 'apps'
  const app = createApp({
    name: body.name.trim().slice(0, 80),
    category,
    source: typeof body.source === 'string' ? body.source.slice(0, 20) : 'custom',
    launch_target: typeof body.launch_target === 'string' ? body.launch_target.slice(0, 500) : '',
    image: typeof body.image === 'string' ? body.image.slice(0, 500) : '',
    icon: typeof body.icon === 'string' ? body.icon.slice(0, 40) : 'app-window',
    accent: typeof body.accent === 'string' ? body.accent.slice(0, 20) : '#22d3ee',
    description: typeof body.description === 'string' ? body.description.slice(0, 200) : '',
    pinned: Boolean(body.pinned),
  })
  return NextResponse.json(app, { status: 201 })
}
