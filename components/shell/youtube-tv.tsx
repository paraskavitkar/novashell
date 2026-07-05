'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useYouTubeFeed, type YouTubeVideo } from '@/lib/client'
import { useShellInput } from './gamepad-context'
import { ButtonHints } from './button-hints'
import { ChannelManager } from './channel-manager'
import { Play, Search, Tv } from 'lucide-react'

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`
  return `${Math.floor(s / (86400 * 30))} months ago`
}

export function YouTubeTv({
  active,
  onBack,
  onOpenSearch,
  onRequestAddChannel,
  channelStatus,
}: {
  active: boolean
  onBack: () => void
  onOpenSearch: () => void
  onRequestAddChannel: () => void
  channelStatus: string | null
}) {
  const { rows, isLoading } = useYouTubeFeed()
  const [rowIndex, setRowIndex] = useState(0)
  const [cols, setCols] = useState<Record<string, number>>({})
  const [playing, setPlaying] = useState<YouTubeVideo | null>(null)
  const [managing, setManaging] = useState(false)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const safeRow = Math.min(rowIndex, Math.max(0, rows.length - 1))
  const row = rows[safeRow]
  const colIndex = row ? Math.min(cols[row.channelId] ?? 0, row.videos.length - 1) : 0
  const focused = row?.videos[colIndex]

  useShellInput(
    (action) => {
      if (playing) {
        if (action === 'back' || action === 'accept') {
          setPlaying(null)
          return true
        }
        return true // modal while playing
      }
      switch (action) {
        case 'up':
          setRowIndex((r) => Math.max(0, r - 1))
          return true
        case 'down':
          setRowIndex((r) => Math.min(rows.length - 1, r + 1))
          return true
        case 'left':
          if (row) setCols((c) => ({ ...c, [row.channelId]: Math.max(0, colIndex - 1) }))
          return true
        case 'right':
          if (row)
            setCols((c) => ({ ...c, [row.channelId]: Math.min(row.videos.length - 1, colIndex + 1) }))
          return true
        case 'accept':
          if (focused) setPlaying(focused)
          return true
        case 'y':
          onOpenSearch()
          return true
        case 'x':
          setManaging(true)
          return true
        case 'back':
          onBack()
          return true
        default:
          return false
      }
    },
    20,
    active && !managing,
  )

  useEffect(() => {
    if (!focused || !row) return
    const el = cardRefs.current.get(`${row.channelId}:${focused.id}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
  }, [focused?.id, row?.channelId])

  const backdrop = useMemo(
    () => (focused ? `https://i.ytimg.com/vi/${focused.id}/maxresdefault.jpg` : null),
    [focused?.id],
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {backdrop ? (
          <img
            key={backdrop}
            src={backdrop || "/placeholder.svg"}
            alt=""
            className="size-full scale-110 object-cover opacity-25 blur-2xl transition-opacity duration-700"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      {/* header */}
      <header className="flex items-center gap-3 px-10 pb-2 pt-6 md:px-14">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#ef4444]">
          <Play className="size-5 fill-white text-white" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">YouTube</h1>
        <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          TV Mode
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="size-4" aria-hidden="true" /> Press Y to search
        </span>
      </header>

      {/* focused video info */}
      <section className="px-10 pb-4 pt-2 md:px-14" aria-live="polite">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-primary">
          {focused ? focused.channel : 'Loading'}
        </p>
        <h2 className="line-clamp-2 max-w-3xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
          {focused?.title ?? 'Fetching your feed…'}
        </h2>
        <p className="mt-1.5 text-muted-foreground">{focused ? timeAgo(focused.published) : ''}</p>
      </section>

      {/* rows */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading feed" />
        </div>
      ) : (
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-10 pb-8 md:px-14">
          {rows.map((r, ri) => {
            const rowFocused = ri === safeRow
            return (
              <section key={r.channelId}>
                <h3
                  className={`mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                    rowFocused ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Tv className="size-3.5" aria-hidden="true" />
                  {r.channel}
                </h3>
                <div className="no-scrollbar flex gap-4 overflow-x-auto py-3 pl-1">
                  {r.videos.map((v, ci) => {
                    const isFocused =
                      rowFocused && ci === (row?.channelId === r.channelId ? colIndex : (cols[r.channelId] ?? 0))
                    return (
                      <button
                        key={v.id}
                        ref={(el) => {
                          const k = `${r.channelId}:${v.id}`
                          if (el) cardRefs.current.set(k, el)
                          else cardRefs.current.delete(k)
                        }}
                        type="button"
                        tabIndex={-1}
                        aria-label={`${v.title} — ${v.channel}`}
                        onClick={() => {
                          setRowIndex(ri)
                          setCols((c) => ({ ...c, [r.channelId]: ci }))
                          setPlaying(v)
                        }}
                        className={`group relative h-32 w-56 shrink-0 overflow-hidden rounded-xl bg-card text-left transition-all duration-200 ease-out md:h-36 md:w-64 ${
                          isFocused ? 'tile-glow z-10 scale-105' : 'opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={v.thumbnail || "/placeholder.svg"}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
                          <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                            {v.title}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* player modal — embeds the actual video */}
      {playing ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 md:p-12"
          role="dialog"
          aria-modal="true"
          aria-label={`Playing ${playing.title}`}
        >
          <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-xl shadow-2xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${playing.id}?autoplay=1`}
              title={playing.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
          <p className="mt-4 line-clamp-1 max-w-4xl text-center text-lg font-semibold">
            {playing.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{playing.channel} · Press B to close</p>
        </div>
      ) : null}

      <ChannelManager
        open={managing}
        onClose={() => setManaging(false)}
        onRequestAdd={onRequestAddChannel}
        status={channelStatus}
      />

      <ButtonHints
        hints={[
          { glyph: 'A', label: 'Play', color: 'oklch(0.75 0.17 145)' },
          { glyph: 'B', label: 'Home', color: 'oklch(0.65 0.2 25)' },
          { glyph: 'Y', label: 'Search', color: 'oklch(0.8 0.16 85)' },
          { glyph: 'X', label: 'Channels', color: 'oklch(0.72 0.14 240)' },
          { glyph: 'ⓖ', label: 'Desktop Mode' },
        ]}
      />
    </div>
  )
}
