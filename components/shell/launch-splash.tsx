'use client'

import { useEffect, useState } from 'react'
import type { TileItem } from '@/lib/apps-data'
import { useShellInput } from './gamepad-context'
import { TileIcon } from './tile-icon'
import { Glyph } from './button-hints'

export function LaunchSplash({
  item,
  onClose,
}: {
  item: TileItem
  onClose: () => void
}) {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRunning(true), 1800)
    return () => clearTimeout(t)
  }, [])

  useShellInput(
    (action) => {
      if (action === 'back' || action === 'guide') {
        onClose()
        return true
      }
      return true // modal
    },
    180,
    true,
  )

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Launching ${item.title}`}
    >
      {item.image ? (
        <img
          src={item.image || "/placeholder.svg"}
          alt=""
          className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-25 blur-xl"
        />
      ) : null}
      <div className="launch-zoom relative flex flex-col items-center gap-8 px-6 text-center">
        <div className="overflow-hidden rounded-2xl shadow-2xl">
          {item.image ? (
            <img src={item.image || "/placeholder.svg"} alt="" className="h-56 w-96 object-cover md:h-64 md:w-[28rem]" />
          ) : (
            <div
              className="flex h-56 w-96 items-center justify-center md:h-64 md:w-[28rem]"
              style={{ backgroundColor: item.tint }}
            >
              <TileIcon name={item.icon ?? 'monitor'} className="size-20 text-foreground" />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-balance text-4xl font-bold tracking-tight">{item.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {running ? 'Now running' : 'Launching…'}
          </p>
        </div>

        {running ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Glyph label="B" color="oklch(0.65 0.2 25)" /> Close and return home
          </p>
        ) : (
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="glow-pulse size-2 rounded-full bg-primary" />
            <span className="glow-pulse size-2 rounded-full bg-primary [animation-delay:0.3s]" />
            <span className="glow-pulse size-2 rounded-full bg-primary [animation-delay:0.6s]" />
          </div>
        )}
      </div>
    </div>
  )
}
