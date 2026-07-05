import { NextResponse } from 'next/server'
import { getApp, updateApp, deleteApp } from '@/lib/db/apps'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!getApp(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const body = await req.json()
  const app = updateApp(id, body)
  return NextResponse.json(app)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteApp(id)
  if (!ok) return NextResponse.json({ error: 'not found or not deletable' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
