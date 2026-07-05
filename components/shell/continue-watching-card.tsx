'use client'

/**
 * Continue Watching card — resume a show exactly where Brave history left off.
 * Minimalist: service-tinted panel, series + episode, relative time. No artwork
 * dependency (history entries carry no images); tint + typography carry it.
 */

import { forwardRef } from 'react'
import { Play } from 'lucide-react'
import type { ContinueWatchingItem } from '@/lib/client'

const SERVICE_TINT: Record<string, string> = {
  crunchyroll: 'oklch(0.28 0.05 55)', // muted warm ember
  'prime-video': 'oklch(0.27 0.04 240)', // muted steel blue
  youtube: 'oklch(0.27 0.05 25)', // muted deep red
}

function relativeTime(unixSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / (7 * 86400))}w ago`
}

function formatClock(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  item: ContinueWatchingItem
  focused: boolean
  onOpen: () => void
}

export const ContinueWatchingCard = forwardRef<HTMLButtonElement, Props>(
  function ContinueWatchingCard({ item, focused, onOpen }, ref) {
    // Real playback progress (from the CDP monitor). Null on history-only rows.
    const progress =
      item.position_secs != null && item.duration_secs != null && item.duration_secs > 0
        ? Math.min(1, item.position_secs / item.duration_secs)
        : null
    return (
      <button
        ref={ref}
        type="button"
        tabIndex={-1}
        aria-label={`Continue watching ${item.series}${item.episode ? `, ${item.episode}` : ''}`}
        onClick={onOpen}
        className={`relative flex h-32 w-64 shrink-0 flex-col justify-between overflow-hidden rounded-lg p-4 text-left will-change-transform md:h-36 md:w-72 ${
          focused ? 'tile-focus scale-[1.06]' : 'tile-rest'
        }`}
        style={{ backgroundColor: SERVICE_TINT[item.service] ?? 'oklch(0.24 0.006 80)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
            {item.serviceLabel}
          </span>
          <span className="text-[11px] text-white/45">{relativeTime(item.watched_at)}</span>
        </div>

        <div>
          <p className="line-clamp-1 text-base font-semibold text-white">{item.series}</p>
          {item.episode ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-white/60">{item.episode}</p>
          ) : null}
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-white/80">
            <Play className="size-3.5 fill-current" />
            {item.position_secs != null && item.position_secs > 0
              ? `Resume at ${formatClock(item.position_secs)}`
              : 'Resume'}
          </div>
        </div>

        {/* Real progress bar — only when the CDP monitor captured a position */}
        {progress != null ? (
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-white/80" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </button>
    )
  },
)
