'use client'

import { useEffect, useRef, useState } from 'react'
import {
  removeYouTubeChannel,
  useYouTubeChannels,
} from '@/lib/client'
import { useShellInput } from './gamepad-context'
import { Plus, Trash2, Tv } from 'lucide-react'

/**
 * Controller-driven manager for YouTube channel subscriptions.
 * List of subscribed channels + "Add channel" entry (opens spiral keyboard
 * via onRequestAdd — the parent owns the keyboard flow).
 */
export function ChannelManager({
  open,
  onClose,
  onRequestAdd,
  status,
}: {
  open: boolean
  onClose: () => void
  onRequestAdd: () => void
  status: string | null
}) {
  const { channels, isLoading } = useYouTubeChannels()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // index 0 = Add channel, 1..n = channels
  const total = channels.length + 1
  const safeIndex = Math.min(index, total - 1)

  useEffect(() => {
    if (!open) setIndex(0)
  }, [open])

  useEffect(() => {
    rowRefs.current.get(safeIndex)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [safeIndex])

  useShellInput(
    (action) => {
      if (!open || busy) return open // swallow input while busy
      switch (action) {
        case 'up':
          setIndex((i) => Math.max(0, i - 1))
          return true
        case 'down':
          setIndex((i) => Math.min(total - 1, i + 1))
          return true
        case 'accept':
          if (safeIndex === 0) onRequestAdd()
          return true
        case 'x': {
          const channel = channels[safeIndex - 1]
          if (channel) {
            setBusy(true)
            removeYouTubeChannel(channel.id).finally(() => {
              setBusy(false)
              setIndex((i) => Math.max(0, i - 1))
            })
          }
          return true
        }
        case 'back':
          onClose()
          return true
        default:
          return true // modal: swallow everything else
      }
    },
    200,
    open,
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Manage YouTube channels"
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Channels</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rows on the YouTube screen come from these subscriptions
          </p>
        </header>

        <div className="no-scrollbar flex-1 overflow-y-auto p-3">
          {/* Add entry */}
          <div
            ref={(el) => {
              if (el) rowRefs.current.set(0, el)
              else rowRefs.current.delete(0)
            }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-150 ${
              safeIndex === 0 ? 'bg-secondary text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className="flex size-8 items-center justify-center rounded-lg border border-border">
              <Plus className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">Add channel — @handle, URL, or channel ID</span>
          </div>

          {isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
          ) : (
            channels.map((c, i) => {
              const focused = safeIndex === i + 1
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(i + 1, el)
                    else rowRefs.current.delete(i + 1)
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-150 ${
                    focused ? 'bg-secondary' : ''
                  }`}
                >
                  <span className="flex size-8 items-center justify-center rounded-lg border border-border">
                    <Tv className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  {focused ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Trash2 className="size-3.5" aria-hidden="true" /> X to remove
                    </span>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span aria-live="polite">{busy ? 'Working…' : (status ?? `${channels.length} subscribed`)}</span>
          <span>A Select · X Remove · B Close</span>
        </footer>
      </div>
    </div>
  )
}
