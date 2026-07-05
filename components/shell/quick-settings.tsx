'use client'

import { useState } from 'react'
import {
  Keyboard,
  Monitor,
  Moon,
  Power,
  Sun,
  Volume2,
  X,
} from 'lucide-react'
import { useShellInput } from './gamepad-context'
import { Glyph } from './button-hints'

interface QuickSettingsProps {
  open: boolean
  volume: number
  onVolumeChange: (v: number) => void
  onClose: () => void
  onDesktopMode: () => void
  onOpenKeyboard: () => void
}

export function QuickSettings({
  open,
  volume,
  onVolumeChange,
  onClose,
  onDesktopMode,
  onOpenKeyboard,
}: QuickSettingsProps) {
  const [index, setIndex] = useState(0)
  const [brightness, setBrightness] = useState(80)
  const [nightMode, setNightMode] = useState(false)

  const items = [
    { id: 'volume', label: 'Volume', icon: Volume2, type: 'slider' as const },
    { id: 'brightness', label: 'Brightness', icon: Sun, type: 'slider' as const },
    { id: 'night', label: 'Night Mode', icon: Moon, type: 'toggle' as const },
    { id: 'keyboard', label: 'On-Screen Keyboard', icon: Keyboard, type: 'action' as const },
    { id: 'desktop', label: 'Desktop Mode (Virtual Mouse)', icon: Monitor, type: 'action' as const },
    { id: 'exit', label: 'Exit to Windows', icon: Power, type: 'action' as const },
    { id: 'close', label: 'Close', icon: X, type: 'action' as const },
  ]

  useShellInput(
    (action) => {
      const item = items[index]
      switch (action) {
        case 'up':
          setIndex((i) => Math.max(0, i - 1))
          return true
        case 'down':
          setIndex((i) => Math.min(items.length - 1, i + 1))
          return true
        case 'left':
          if (item.id === 'volume') onVolumeChange(Math.max(0, volume - 5))
          if (item.id === 'brightness') setBrightness((b) => Math.max(10, b - 5))
          return true
        case 'right':
          if (item.id === 'volume') onVolumeChange(Math.min(100, volume + 5))
          if (item.id === 'brightness') setBrightness((b) => Math.min(100, b + 5))
          return true
        case 'accept':
          if (item.id === 'night') setNightMode((n) => !n)
          if (item.id === 'keyboard') {
            onClose()
            onOpenKeyboard()
          }
          if (item.id === 'desktop' || item.id === 'exit') {
            onClose()
            onDesktopMode()
          }
          if (item.id === 'close') onClose()
          return true
        case 'back':
        case 'start':
          onClose()
          return true
        default:
          return true // modal: consume everything below volume/guide priority
      }
    },
    150,
    open,
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-background/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quick settings"
    >
      <aside className="shell-fade-up flex w-full max-w-md flex-col border-l border-border bg-popover p-8">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Quick Settings</h2>

        <ul className="flex flex-col gap-2">
          {items.map((item, i) => {
            const focused = i === index
            const Icon = item.icon
            return (
              <li
                key={item.id}
                className={`flex items-center gap-4 rounded-lg px-4 py-3.5 transition-all duration-150 ${
                  focused
                    ? 'bg-secondary ring-2 ring-ring'
                    : 'opacity-70'
                }`}
              >
                <Icon
                  className={`size-5 shrink-0 ${focused ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 font-medium">{item.label}</span>

                {item.type === 'slider' ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${item.id === 'volume' ? volume : brightness}%`,
                        }}
                      />
                    </div>
                    <span className="min-w-7 text-right text-sm tabular-nums text-muted-foreground">
                      {item.id === 'volume' ? volume : brightness}
                    </span>
                  </div>
                ) : null}

                {item.type === 'toggle' ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      nightMode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {nightMode ? 'ON' : 'OFF'}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>

        <div className="mt-auto flex items-center gap-6 pt-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Glyph label="A" color="oklch(0.75 0.17 145)" /> Select
          </span>
          <span className="flex items-center gap-2">
            <Glyph label="B" color="oklch(0.65 0.2 25)" /> Close
          </span>
          <span className="flex items-center gap-2">
            <Glyph label="◄►" /> Adjust
          </span>
        </div>
      </aside>
    </div>
  )
}
