import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

const ACCENT: Record<string, string> = { steam: '#38bdf8', epic: '#e2e8f0' }

/**
 * POST /api/library/import — bulk upsert of scanned installed games.
 * Called by the native layer after reading Steam/Epic manifests.
 * IDs are stable (steam-<appid> / epic-<app>) so re-scans update, not duplicate.
 * Body: { games: [{ id, name, source, launch_target }] }
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    games?: Array<{ id: string; name: string; source: string; launch_target: string }>
  }
  const games = Array.isArray(body.games) ? body.games : []
  if (games.length === 0) {
    return NextResponse.json({ error: 'games required' }, { status: 400 })
  }
  if (games.length > 500) {
    return NextResponse.json({ error: 'too many games (max 500)' }, { status: 400 })
  }

  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO apps (id, name, category, source, launch_target, icon, accent, description, sort_order)
    VALUES (@id, @name, 'games', @source, @launch_target, 'gamepad-2', @accent, @description,
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM apps WHERE category = 'games'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      launch_target = excluded.launch_target,
      updated_at = unixepoch()
  `)

  let count = 0
  const run = db.transaction(() => {
    for (const g of games) {
      if (
        typeof g?.id !== 'string' ||
        typeof g?.name !== 'string' ||
        !['steam', 'epic'].includes(g?.source) ||
        typeof g?.launch_target !== 'string' ||
        !/^[a-z0-9-]{1,60}$/.test(g.id)
      ) {
        continue
      }
      upsert.run({
        id: g.id,
        name: g.name.slice(0, 80),
        source: g.source,
        launch_target: g.launch_target.slice(0, 500),
        accent: ACCENT[g.source] ?? '#22d3ee',
        description: g.source === 'steam' ? 'Installed via Steam' : 'Installed via Epic Games',
      })
      count++
    }
  })
  run()
  return NextResponse.json({ imported: count })
}
