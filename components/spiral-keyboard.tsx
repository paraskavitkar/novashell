'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InputFrame } from '@/hooks/use-input'
import { shortestAngleDelta } from '@/lib/input'
import { cn } from '@/lib/utils'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const ITEMS: { label: string; glyph: string; action: 'char' | 'space' | 'del' }[] = [
  ...LETTERS.map((l) => ({ label: l, glyph: l, action: 'char' as const })),
  { label: 'Space', glyph: '\u2423', action: 'space' },
  { label: 'Delete', glyph: '\u232B', action: 'del' },
]
const N = ITEMS.length
const DEG_PER_ITEM = 360 / N

/**
 * Rotation-seek tuning.
 * ENGAGE/RELEASE magnitudes form a hysteresis band so a noisy stick near the
 * threshold can't rapidly toggle seek mode. STEP is how much rotation moves
 * the selection one glyph — one full circle scrolls ~10 letters.
 */
const ENGAGE_MAG = 0.5
const RELEASE_MAG = 0.3
const STEP_RAD = (Math.PI * 2) / 10

interface SpiralKeyboardProps {
  registerFrameHandler: (h: ((f: InputFrame) => void) | null) => void
}

export function SpiralKeyboard({ registerFrameHandler }: SpiralKeyboardProps) {
  const [text, setText] = useState('')
  // Cumulative (un-wrapped) step count so the ring animates continuously
  // across the A<->Delete boundary instead of spinning backwards.
  const [cumSteps, setCumSteps] = useState(0)
  const [stickAngle, setStickAngle] = useState<number | null>(null)

  const engaged = useRef(false)
  const lastAngle = useRef(0)
  const acc = useRef(0)
  const stepsRef = useRef(0)
  stepsRef.current = cumSteps

  const index = ((cumSteps % N) + N) % N

  const handleFrame = useCallback((f: InputFrame) => {
    // --- rotation seek ---
    if (!engaged.current && f.stick.mag > ENGAGE_MAG) {
      engaged.current = true
      lastAngle.current = f.stick.angle
      acc.current = 0
    } else if (engaged.current && f.stick.mag < RELEASE_MAG) {
      engaged.current = false
      acc.current = 0
    }

    if (engaged.current) {
      const d = shortestAngleDelta(lastAngle.current, f.stick.angle)
      lastAngle.current = f.stick.angle
      acc.current += d

      let moved = 0
      while (acc.current > STEP_RAD) {
        acc.current -= STEP_RAD
        moved += 1
      }
      while (acc.current < -STEP_RAD) {
        acc.current += STEP_RAD
        moved -= 1
      }
      if (moved !== 0) {
        stepsRef.current += moved
        setCumSteps(stepsRef.current)
        f.rumble(15, 0.15)
      }
      setStickAngle(f.stick.angle)
    } else {
      setStickAngle((a) => (a === null ? a : null))
    }

    // --- typing ---
    if (f.justPressed[0]) {
      const i = ((stepsRef.current % N) + N) % N
      const item = ITEMS[i]
      setText((t) => {
        if (item.action === 'del') return t.slice(0, -1)
        if (item.action === 'space') return t + ' '
        return t + item.glyph
      })
      f.rumble(50, 0.5)
    }
    if (f.justPressed[1]) {
      setText((t) => t.slice(0, -1))
    }
  }, [])

  // Register with the page-level input loop
  useRegister(registerFrameHandler, handleFrame)

  const ringRotation = -cumSteps * DEG_PER_ITEM
  const selected = ITEMS[index]

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Text field */}
      <div className="flex min-h-14 w-full max-w-lg items-center rounded-lg border border-border bg-card px-5 py-3">
        <span className="font-mono text-xl tracking-wide" data-testid="typed-text">
          {text || <span className="text-muted-foreground">{'Type with the spiral\u2026'}</span>}
        </span>
        <span aria-hidden="true" className="ml-0.5 inline-block h-6 w-0.5 animate-pulse bg-primary" />
      </div>

      {/* Ring */}
      <div className="relative size-80 select-none md:size-96">
        {/* Selection marker at 12 o'clock */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2 text-primary"
        >
          <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor">
            <path d="M7 8 0 0h14L7 8Z" />
          </svg>
        </div>

        <div
          className="absolute inset-0 transition-transform duration-200 ease-out"
          style={{ transform: `rotate(${ringRotation}deg)` }}
        >
          {ITEMS.map((item, i) => {
            const isSelected = i === index
            return (
              <div
                key={item.label}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `rotate(${i * DEG_PER_ITEM}deg) translateY(calc(-1 * var(--ring-r, 9.5rem)))`,
                }}
              >
                <div
                  className={cn(
                    'flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-sm transition-all duration-200',
                    isSelected
                      ? 'scale-150 bg-primary font-bold text-primary-foreground shadow-lg'
                      : 'text-muted-foreground',
                  )}
                  style={{ transform: `rotate(${-i * DEG_PER_ITEM - ringRotation}deg)` }}
                >
                  {item.glyph}
                </div>
              </div>
            )
          })}
        </div>

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="font-mono text-6xl font-bold" data-testid="selected-glyph">
            {selected.glyph}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {selected.label}
          </span>
          {/* Live stick direction dot */}
          <div className="relative mt-2 size-10 rounded-full border border-border">
            {stickAngle !== null && (
              <div
                className="absolute left-1/2 top-1/2 size-2 rounded-full bg-primary"
                style={{
                  transform: `translate(-50%, -50%) translate(${Math.cos(stickAngle) * 14}px, ${Math.sin(stickAngle) * 14}px)`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <p className="max-w-md text-center text-sm leading-relaxed text-muted-foreground text-pretty">
        Circle the left stick clockwise to seek forward, counter-clockwise to go back. Press{' '}
        <Hint>A</Hint> / <Hint>Enter</Hint> to type the selected glyph, <Hint>B</Hint> /{' '}
        <Hint>Esc</Hint> to delete.
      </p>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  )
}

function useRegister(
  register: (h: ((f: InputFrame) => void) | null) => void,
  handler: (f: InputFrame) => void,
) {
  useEffect(() => {
    register(handler)
    return () => register(null)
  }, [register, handler])
}
