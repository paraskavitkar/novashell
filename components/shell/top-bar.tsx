'use client'

import { useEffect, useState } from 'react'
import { Gamepad2, Volume2, VolumeX, Wifi } from 'lucide-react'
import { useGamepad } from './gamepad-context'

export function TopBar({ volume }: { volume: number }) {
  const { connected, padName } = useGamepad()
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      )
    update()
    const t = setInterval(update, 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="flex items-center justify-between px-10 pt-6 md:px-14">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Gamepad2 className="size-5" aria-hidden="true" />
        </div>
        <span className="text-lg font-semibold tracking-widest text-foreground">
          NOVA<span className="text-primary">SHELL</span>
        </span>
      </div>

      <div className="flex items-center gap-5 text-muted-foreground">
        <div
          className={`flex items-center gap-2 text-sm ${connected ? 'text-primary' : ''}`}
          title={padName ?? 'No controller'}
        >
          <Gamepad2 className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">
            {connected ? 'Controller connected' : 'Keyboard mode'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {volume === 0 ? (
            <VolumeX className="size-4" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
          <span>{volume}</span>
        </div>
        <Wifi className="size-4" aria-hidden="true" />
        <span className="min-w-16 text-right text-sm tabular-nums text-foreground">
          {time ?? ''}
        </span>
      </div>
    </header>
  )
}
