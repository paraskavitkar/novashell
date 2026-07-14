'use client'

import { useCallback, useRef, useState } from 'react'
import { useInputLoop, type InputFrame } from '@/hooks/use-input'
import { DEFAULT_STICK_SETTINGS, type StickSettings } from '@/lib/input'
import { SpiralKeyboard } from '@/components/spiral-keyboard'
import { CursorPlayground } from '@/components/cursor-playground'
import { cn } from '@/lib/utils'

type Mode = 'spiral' | 'cursor'

export function Demo() {
  const [mode, setMode] = useState<Mode>('spiral')
  const [connected, setConnected] = useState(false)
  const [settings, setSettings] = useState<StickSettings>(DEFAULT_STICK_SETTINGS)
  const [maxSpeed, setMaxSpeed] = useState(900)

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const connectedRef = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const frameHandler = useRef<((f: InputFrame) => void) | null>(null)
  const registerFrameHandler = useCallback((h: ((f: InputFrame) => void) | null) => {
    frameHandler.current = h
  }, [])

  useInputLoop(settingsRef, (f) => {
    if (f.connected !== connectedRef.current) {
      connectedRef.current = f.connected
      setConnected(f.connected)
    }
    // Y button (3) or X button (2) toggles mode
    if (f.justPressed[3]) {
      setMode(modeRef.current === 'spiral' ? 'cursor' : 'spiral')
      return
    }
    frameHandler.current?.(f)
  })

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-balance">Spiral Input Lab</h1>
            <p className="text-sm text-muted-foreground">
              Analog-stick text entry and cursor control, tuned for cheap controllers.
            </p>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              connected
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-secondary text-muted-foreground',
            )}
            data-testid="pad-status"
          >
            <span
              className={cn('size-2 rounded-full', connected ? 'bg-primary' : 'bg-muted-foreground/50')}
              aria-hidden="true"
            />
            {connected ? 'Controller connected' : 'No controller \u2014 keyboard fallback active'}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-2" aria-label="Demo mode">
          <TabButton active={mode === 'spiral'} onClick={() => setMode('spiral')}>
            Spiral Keyboard
          </TabButton>
          <TabButton active={mode === 'cursor'} onClick={() => setMode('cursor')}>
            Cursor Playground
          </TabButton>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Press <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">Y</kbd> on
            your pad to switch
          </span>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center">
        {mode === 'spiral' ? (
          <SpiralKeyboard registerFrameHandler={registerFrameHandler} />
        ) : (
          <CursorPlayground
            registerFrameHandler={registerFrameHandler}
            maxSpeed={maxSpeed}
            curve={settings.curve}
          />
        )}
      </main>

      {/* Tuning — the whole point for cheap controllers */}
      <section
        aria-label="Stick tuning"
        className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
      >
        <Slider
          label="Deadzone"
          hint="Raise this if your cursor drifts when the stick is released"
          min={0}
          max={0.45}
          step={0.01}
          value={settings.deadzone}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(deadzone) => setSettings((s) => ({ ...s, deadzone }))}
        />
        <Slider
          label="Smoothing"
          hint="Filters stick noise; higher is steadier but laggier"
          min={0}
          max={150}
          step={5}
          value={settings.smoothing}
          format={(v) => `${v} ms`}
          onChange={(smoothing) => setSettings((s) => ({ ...s, smoothing }))}
        />
        <Slider
          label="Response curve"
          hint="Higher gives finer control at small deflections"
          min={1}
          max={3}
          step={0.1}
          value={settings.curve}
          format={(v) => `${v.toFixed(1)}\u00D7`}
          onChange={(curve) => setSettings((s) => ({ ...s, curve }))}
        />
        <Slider
          label="Cursor speed"
          hint="Top speed at full stick deflection"
          min={300}
          max={2000}
          step={50}
          value={maxSpeed}
          format={(v) => `${v} px/s`}
          onChange={setMaxSpeed}
        />
      </section>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string
  hint: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
        aria-label={label}
      />
      <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
    </label>
  )
}
