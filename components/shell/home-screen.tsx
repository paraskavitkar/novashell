'use client'

/**
 * Console home — minimalist premium.
 * Row 0 is the discovery banner (trending content matched to taste).
 * Below: Games / Media / Apps / System tile rows.
 * Focus: transform-only scale + hairline ring (no glow, no layout shift).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  recordUsage,
  sendContentFeedback,
  useLibrary,
  useTrendingContent,
  type ContentItem,
  type ShellApp,
} from '@/lib/client'
import { useShellInput } from './gamepad-context'
import { TileIcon } from './tile-icon'
import { ButtonHints } from './button-hints'
import { DiscoveryBanner } from './discovery-banner'

interface RowData {
  id: string
  label: string
  items: ShellApp[]
}

interface HomeScreenProps {
  active: boolean
  onLaunch: (app: ShellApp) => void
  onOpenContent: (item: ContentItem) => void
  onOpenQuick: () => void
}

const CATEGORY_LABEL: Record<string, string> = {
  games: 'Games',
  media: 'Media',
  apps: 'Apps',
  system: 'System',
}

const BANNER_ROW = -1

export function HomeScreen({ active, onLaunch, onOpenContent, onOpenQuick }: HomeScreenProps) {
  const { apps, isLoading } = useLibrary()
  const { content } = useTrendingContent()

  const rows: RowData[] = useMemo(() => {
    const out: RowData[] = []
    for (const cat of ['games', 'media', 'apps', 'system'] as const) {
      const items = apps.filter((a) => a.category === cat && !a.hidden)
      if (items.length > 0) out.push({ id: cat, label: CATEGORY_LABEL[cat], items })
    }
    return out
  }, [apps])

  const hasBanner = content.length > 0
  const [rowIndex, setRowIndex] = useState(0) // BANNER_ROW = banner, 0..n = tile rows
  const [bannerIndex, setBannerIndex] = useState(0)
  const [cols, setCols] = useState<Record<string, number>>({})
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)

  const safeRow = Math.min(rowIndex, Math.max(0, rows.length - 1))
  const onBanner = hasBanner && rowIndex === BANNER_ROW
  const row = onBanner ? null : rows[safeRow]
  const colIndex = row ? Math.min(cols[row.id] ?? 0, row.items.length - 1) : 0
  const focused = row?.items[colIndex] ?? null
  const activeContent = content[Math.min(bannerIndex, Math.max(0, content.length - 1))]

  useShellInput(
    (action) => {
      if (onBanner) {
        switch (action) {
          case 'down':
            setRowIndex(0)
            return true
          case 'left':
            setBannerIndex((i) => (i - 1 + content.length) % content.length)
            return true
          case 'right':
            setBannerIndex((i) => (i + 1) % content.length)
            return true
          case 'accept':
            if (activeContent) {
              sendContentFeedback(activeContent, 'opened')
              onOpenContent(activeContent)
            }
            return true
          case 'x':
            if (activeContent) {
              sendContentFeedback(activeContent, 'dismissed')
              setBannerIndex(0)
            }
            return true
          case 'start':
            onOpenQuick()
            return true
          default:
            return false
        }
      }

      if (!row || !focused) return false
      switch (action) {
        case 'up':
          if (safeRow === 0 && hasBanner) setRowIndex(BANNER_ROW)
          else setRowIndex((r) => Math.max(0, r - 1))
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
          recordUsage(focused.id, 'launch')
          onLaunch(focused)
          return true
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

  // Scroll management: banner pinned at top; focusing a row scrolls it into view
  useEffect(() => {
    if (onBanner) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!focused || !row) return
    const el = tileRefs.current.get(`${row.id}:${focused.id}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
  }, [focused?.id, row?.id, onBanner])

  // When content first arrives, let the banner be the initial focus
  useEffect(() => {
    if (hasBanner) setRowIndex(BANNER_ROW)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBanner])

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="size-7 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
          aria-label="Loading library"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Discovery banner — trending content matched to taste */}
        {hasBanner ? (
          <DiscoveryBanner
            items={content}
            focused={onBanner}
            index={bannerIndex}
            onIndexChange={setBannerIndex}
          />
        ) : null}

        {/* Tile rows */}
        <div className="flex flex-col gap-8 px-14 pb-10 pt-8">
          {rows.map((r, ri) => {
            const rowFocused = !onBanner && ri === safeRow
            return (
              <section key={r.id}>
                <h2
                  className={`mb-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors duration-200 ${
                    rowFocused ? 'text-foreground' : 'text-muted-foreground/70'
                  }`}
                >
                  {r.label}
                </h2>
                <div className="no-scrollbar flex gap-3.5 overflow-x-auto px-1 py-2.5">
                  {r.items.map((app, ci) => {
                    const isFocused = rowFocused && ci === colIndex
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
                        aria-label={app.name}
                        onClick={() => {
                          setRowIndex(ri)
                          setCols((c) => ({ ...c, [r.id]: ci }))
                          recordUsage(app.id, 'launch')
                          onLaunch(app)
                        }}
                        className={`group relative shrink-0 overflow-hidden rounded-lg bg-card text-left will-change-transform ${
                          isGame ? 'h-32 w-56 md:h-36 md:w-64' : 'size-28 md:size-32'
                        } ${isFocused ? 'tile-focus scale-[1.06]' : 'tile-rest'}`}
                      >
                        {app.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={app.image || '/placeholder.svg'}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-2.5 bg-secondary">
                            <TileIcon name={app.icon} className="size-8 text-muted-foreground" />
                            <span className="px-2 text-center text-xs font-medium text-foreground">
                              {app.name}
                            </span>
                          </div>
                        )}
                        {app.image && isGame ? (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-9">
                            <span className="text-sm font-medium text-white">{app.name}</span>
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
      </div>

      <ButtonHints
        hints={
          onBanner
            ? [
                { glyph: 'A', label: 'Watch' },
                { glyph: 'X', label: 'Not interested' },
                { glyph: '≡', label: 'Quick Settings' },
                { glyph: 'ⓖ', label: 'Desktop' },
              ]
            : [
                { glyph: 'A', label: 'Launch' },
                { glyph: 'B', label: 'Back' },
                { glyph: '≡', label: 'Quick Settings' },
                { glyph: 'LB', label: 'Vol −' },
                { glyph: 'RB', label: 'Vol +' },
                { glyph: 'ⓖ', label: 'Desktop' },
              ]
        }
      />
    </div>
  )
}
