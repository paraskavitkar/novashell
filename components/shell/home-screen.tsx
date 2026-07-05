'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  recordUsage,
  sendSuggestionFeedback,
  useLibrary,
  useRecommendations,
  type ShellApp,
} from '@/lib/client'
import { useShellInput } from './gamepad-context'
import { TileIcon } from './tile-icon'
import { ButtonHints } from './button-hints'
import { Sparkles } from 'lucide-react'

interface RowData {
  id: string
  label: string
  suggested?: boolean
  items: Array<{ app: ShellApp; reason?: string }>
}

interface HomeScreenProps {
  active: boolean
  onLaunch: (app: ShellApp) => void
  onOpenQuick: () => void
}

const CATEGORY_LABEL: Record<string, string> = {
  games: 'Games',
  media: 'Media',
  apps: 'Apps',
  system: 'System',
}

export function HomeScreen({ active, onLaunch, onOpenQuick }: HomeScreenProps) {
  const { apps, isLoading } = useLibrary()
  const { recommendations } = useRecommendations()

  const rows: RowData[] = useMemo(() => {
    const out: RowData[] = []
    if (recommendations.length > 0) {
      out.push({
        id: 'suggested',
        label: 'Suggested for You',
        suggested: true,
        items: recommendations.slice(0, 6).map((r) => ({ app: r.app, reason: r.reason })),
      })
    }
    for (const cat of ['games', 'media', 'apps', 'system'] as const) {
      const items = apps.filter((a) => a.category === cat)
      if (items.length > 0) {
        out.push({ id: cat, label: CATEGORY_LABEL[cat], items: items.map((app) => ({ app })) })
      }
    }
    return out
  }, [apps, recommendations])

  const [rowIndex, setRowIndex] = useState(0)
  const [cols, setCols] = useState<Record<string, number>>({})
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const safeRow = Math.min(rowIndex, Math.max(0, rows.length - 1))
  const row = rows[safeRow]
  const colIndex = row ? Math.min(cols[row.id] ?? 0, row.items.length - 1) : 0
  const focused = row?.items[colIndex]

  useShellInput(
    (action) => {
      if (!row || !focused) return false
      switch (action) {
        case 'up':
          setRowIndex((r) => Math.max(0, r - 1))
          return true
        case 'down':
          setRowIndex((r) => Math.min(rows.length - 1, r + 1))
          return true
        case 'left':
          setCols((c) => ({ ...c, [row.id]: Math.max(0, colIndex - 1) }))
          return true
        case 'right':
          setCols((c) => ({ ...c, [row.id]: Math.min(row.items.length - 1, colIndex + 1) }))
          return true
        case 'accept':
          activate(focused.app, row.suggested)
          return true
        case 'x':
          if (row.suggested) {
            sendSuggestionFeedback(focused.app.id, 'dismissed')
            return true
          }
          return false
        case 'start':
          onOpenQuick()
          return true
        default:
          return false
      }
    },
    10,
    active,
  )

  function activate(app: ShellApp, fromSuggestion?: boolean) {
    recordUsage(app.id, 'launch')
    if (fromSuggestion) sendSuggestionFeedback(app.id, 'opened')
    onLaunch(app)
  }

  useEffect(() => {
    if (!focused) return
    const el = tileRefs.current.get(`${row.id}:${focused.app.id}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
  }, [focused?.app.id, row?.id])

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading library" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cinematic backdrop from the focused item */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {focused?.app.image ? (
          <img
            key={focused.app.image}
            src={focused.app.image || "/placeholder.svg"}
            alt=""
            className="size-full scale-110 object-cover opacity-30 blur-2xl transition-opacity duration-700"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Hero — focused item */}
      <section className="px-10 pb-4 pt-6 md:px-14" aria-live="polite">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-primary">
          {row?.suggested ? <Sparkles className="size-4" aria-hidden="true" /> : null}
          {row?.suggested ? 'Suggestion' : (CATEGORY_LABEL[focused?.app.category ?? 'apps'] ?? 'App')}
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          {focused?.app.name ?? 'Library'}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {row?.suggested && focused ? (
            <span className="text-primary">{rows[0].items[colIndex]?.reason}</span>
          ) : (
            focused?.app.description || '\u00A0'
          )}
        </p>
      </section>

      {/* Tile rows */}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-10 pb-8 md:px-14">
        {rows.map((r, ri) => {
          const rowFocused = ri === safeRow
          return (
            <section key={r.id}>
              <h2
                className={`mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                  rowFocused ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {r.suggested ? <Sparkles className="size-3.5 text-primary" aria-hidden="true" /> : null}
                {r.label}
              </h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto py-3 pl-1">
                {r.items.map(({ app, reason }, ci) => {
                  const isFocused = rowFocused && ci === (r.id === row?.id ? colIndex : (cols[r.id] ?? 0))
                  const isGame = app.category === 'games'
                  return (
                    <button
                      key={app.id}
                      ref={(el) => {
                        const k = `${r.id}:${app.id}`
                        if (el) tileRefs.current.set(k, el)
                        else tileRefs.current.delete(k)
                      }}
                      type="button"
                      tabIndex={-1}
                      aria-label={`${app.name}${reason ? ` — ${reason}` : ''}`}
                      onClick={() => {
                        setRowIndex(ri)
                        setCols((c) => ({ ...c, [r.id]: ci }))
                        activate(app, r.suggested)
                      }}
                      className={`group relative shrink-0 overflow-hidden rounded-xl bg-card text-left transition-all duration-200 ease-out ${
                        isGame ? 'h-36 w-64 md:h-40 md:w-72' : 'size-32 md:size-36'
                      } ${isFocused ? 'tile-glow z-10 scale-105' : 'opacity-80 hover:opacity-100'}`}
                    >
                      {app.image ? (
                        <img src={app.image || "/placeholder.svg"} alt="" className="absolute inset-0 size-full object-cover" />
                      ) : (
                        <div
                          className="flex size-full flex-col items-center justify-center gap-3"
                          style={{ backgroundColor: 'color-mix(in oklab, ' + app.accent + ' 18%, oklch(0.17 0.015 260))' }}
                        >
                          <TileIcon name={app.icon} className="size-10" />
                          <span className="px-2 text-center text-sm font-semibold">{app.name}</span>
                        </div>
                      )}
                      {app.image ? (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                          <span className="text-sm font-semibold text-white">{app.name}</span>
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <ButtonHints
        hints={[
          { glyph: 'A', label: 'Launch', color: 'oklch(0.75 0.17 145)' },
          { glyph: 'B', label: 'Back', color: 'oklch(0.65 0.2 25)' },
          ...(row?.suggested ? [{ glyph: 'X', label: "Don't suggest", color: 'oklch(0.65 0.15 250)' }] : []),
          { glyph: '≡', label: 'Quick Settings' },
          { glyph: 'LB', label: 'Vol −' },
          { glyph: 'RB', label: 'Vol +' },
          { glyph: 'ⓖ', label: 'Desktop Mode' },
        ]}
      />
    </div>
  )
}
