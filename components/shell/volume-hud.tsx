'use client'

import { Volume2, VolumeX } from 'lucide-react'

export function VolumeHud({ volume, visible }: { volume: number; visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="hud-pop fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-popover/95 px-6 py-3 backdrop-blur-md"
      role="status"
      aria-label={`Volume ${volume}`}
    >
      {volume === 0 ? (
        <VolumeX className="size-5 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Volume2 className="size-5 text-primary" aria-hidden="true" />
      )}
      <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-150"
          style={{ width: `${volume}%` }}
        />
      </div>
      <span className="min-w-8 text-right text-sm font-semibold tabular-nums">{volume}</span>
    </div>
  )
}
