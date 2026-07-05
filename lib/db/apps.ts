import { getDb } from './index'

export type AppRow = {
  id: string
  name: string
  category: 'games' | 'media' | 'apps' | 'system'
  source: string
  launch_target: string
  image: string
  icon: string
  accent: string
  description: string
  pinned: number
  sort_order: number
  hidden: number
  created_at: number
  updated_at: number
}

export function listApps(): AppRow[] {
  return getDb()
    .prepare('SELECT * FROM apps WHERE hidden = 0 ORDER BY category, sort_order, name')
    .all() as AppRow[]
}

export function getApp(id: string): AppRow | undefined {
  return getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined
}

export function createApp(input: {
  name: string
  category: string
  source: string
  launch_target: string
  image?: string
  icon?: string
  accent?: string
  description?: string
  pinned?: boolean
}): AppRow {
  const id =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) +
    '-' +
    Math.random().toString(36).slice(2, 6)

  const max = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM apps WHERE category = ?')
    .get(input.category) as { m: number }

  getDb()
    .prepare(
      `INSERT INTO apps (id, name, category, source, launch_target, image, icon, accent, description, pinned, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.category,
      input.source,
      input.launch_target,
      input.image ?? '',
      input.icon ?? 'app-window',
      input.accent ?? '#22d3ee',
      input.description ?? '',
      input.pinned ? 1 : 0,
      max.m + 1
    )
  return getApp(id)!
}

const EDITABLE = new Set([
  'name',
  'category',
  'source',
  'launch_target',
  'image',
  'icon',
  'accent',
  'description',
  'pinned',
  'sort_order',
  'hidden',
])

export function updateApp(id: string, patch: Record<string, unknown>): AppRow | undefined {
  const keys = Object.keys(patch).filter((k) => EDITABLE.has(k))
  if (keys.length > 0) {
    const sets = keys.map((k) => `${k} = @${k}`).join(', ')
    getDb()
      .prepare(`UPDATE apps SET ${sets}, updated_at = unixepoch() WHERE id = @id`)
      .run({ ...normalize(patch, keys), id })
  }
  return getApp(id)
}

function normalize(patch: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = patch[k]
    out[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v
  }
  return out
}

export function deleteApp(id: string): boolean {
  const app = getApp(id)
  if (!app || app.source === 'builtin') return false
  getDb().prepare('DELETE FROM apps WHERE id = ?').run(id)
  return true
}
