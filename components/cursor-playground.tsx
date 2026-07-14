'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InputFrame } from '@/hooks/use-input'
import { applyCurve } from '@/lib/input'

const TARGET_R = 28 // px
const CURSOR_R = 6 // px

interface Target {
  id: number
  x: number // 0..1 fraction of arena
  y: number
}

interface CursorPlaygroundProps {
  registerFrameHandler: (h: ((f: InputFrame) => void) | null) => void
  maxSpeed: number // px per second at full deflection
  curve: number
}

let nextId = 10

function randomTarget(): Target {
  return { id: nextId++, x: 0.08 + Math.random() * 0.84, y: 0.1 + Math.random() * 0.8 }
}

export function CursorPlayground({ registerFrameHandler, maxSpeed, curve }: CursorPlaygroundProps) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const rawDotRef = useRef<HTMLDivElement>(null)
  const filteredDotRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0.5, y: 0.5 }) // fraction of arena

  const [targets, setTargets] = useState<Target[]>(() => [
    { id: 1, x: 0.2, y: 0.25 },
    { id: 2, x: 0.75, y: 0.2 },
    { id: 3, x: 0.5, y: 0.7 },
    { id: 4, x: 0.85, y: 0.65 },
  ])
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [stats, setStats] = useState({ hits: 0, clicks: 0 })
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null)

  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const hoveredRef = useRef(hoveredId)
  hoveredRef.current = hoveredId
  const speedRef = useRef(maxSpeed)
  speedRef.current = maxSpeed
  const curveRef = useRef(curve)
  curveRef.current = curve

  const handleFrame = useCallback((f: InputFrame) => {
    const arena = arenaRef.current
    if (!arena) return
    const rect = arena.getBoundingClientRect()

    // Velocity from curved magnitude: fine control near center, fast at rim.
    const curved = applyCurve(f.stick, curveRef.current)
    const dt = f.dtMs / 1000
    pos.current.x = clamp01(pos.current.x + (curved.x * speedRef.current * dt) / rect.width)
    pos.current.y = clamp01(pos.current.y + (curved.y * speedRef.current * dt) / rect.height)

    const px = pos.current.x * rect.width
    const py = pos.current.y * rect.height
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${px - CURSOR_R}px, ${py - CURSOR_R}px)`
    }

    // Stick visualizer dots (direct DOM writes; runs at frame rate)
    if (rawDotRef.current) {
      rawDotRef.current.style.transform = `translate(${f.raw.x * 34}px, ${f.raw.y * 34}px)`
    }
    if (filteredDotRef.current) {
      filteredDotRef.current.style.transform = `translate(${f.stick.x * 34}px, ${f.stick.y * 34}px)`
    }

    // Hover detection
    let hover: number | null = null
    for (const t of targetsRef.current) {
      const dx = t.x * rect.width - px
      const dy = t.y * rect.height - py
      if (Math.hypot(dx, dy) <= TARGET_R) {
        hover = t.id
        break
      }
    }
    if (hover !== hoveredRef.current) setHoveredId(hover)

    // Click
    if (f.justPressed[0]) {
      setRipple({ x: px, y: py, key: Date.now() })
      if (hover !== null) {
        f.rumble(60, 0.6)
        setStats((s) => ({ hits: s.hits + 1, clicks: s.clicks + 1 }))
        setTargets((ts) => ts.map((t) => (t.id === hover ? randomTarget() : t)))
      } else {
        setStats((s) => ({ ...s, clicks: s.clicks + 1 }))
      }
    }
  }, [])

  useEffect(() => {
    registerFrameHandler(handleFrame)
    return () => registerFrameHandler(null)
  }, [registerFrameHandler, handleFrame])

  const accuracy = stats.clicks === 0 ? null : Math.round((stats.hits / stats.clicks) * 100)

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full max-w-3xl items-center justify-between gap-4">
        {/* Stick visualizer: raw vs filtered */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="relative size-20 rounded-full border border-border">
            <div className="absolute inset-0 m-auto size-px" aria-hidden="true">
              <div
                ref={rawDotRef}
                className="absolute -left-1 -top-1 size-2 rounded-full bg-muted-foreground/50"
              />
              <div ref={filteredDotRef} className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-primary" />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" /> raw
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" /> filtered
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-5 py-3 font-mono text-sm">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold" data-testid="stat-hits">
              {stats.hits}
            </span>
            <span className="text-xs text-muted-foreground">hits</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">{stats.clicks}</span>
            <span className="text-xs text-muted-foreground">clicks</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">{accuracy === null ? '\u2013' : `${accuracy}%`}</span>
            <span className="text-xs text-muted-foreground">accuracy</span>
          </div>
        </div>
      </div>

      {/* Arena */}
      <div
        ref={arenaRef}
        className="relative h-96 w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card"
        role="application"
        aria-label="Cursor playground arena"
      >
        {targets.map((t) => (
          <div
            key={t.id}
            className={`absolute flex items-center justify-center rounded-full border-2 transition-colors duration-150 ${
              t.id === hoveredId
                ? 'border-primary bg-primary/20'
                : 'border-border bg-secondary/60'
            }`}
            style={{
              width: TARGET_R * 2,
              height: TARGET_R * 2,
              left: `calc(${t.x * 100}% - ${TARGET_R}px)`,
              top: `calc(${t.y * 100}% - ${TARGET_R}px)`,
            }}
          >
            <div
              className={`size-1.5 rounded-full ${t.id === hoveredId ? 'bg-primary' : 'bg-muted-foreground/40'}`}
            />
          </div>
        ))}

        {ripple && (
          <div
            key={ripple.key}
            className="click-ripple pointer-events-none absolute size-10 rounded-full border-2 border-primary"
            style={{ left: ripple.x, top: ripple.y }}
          />
        )}

        <div
          ref={cursorRef}
          className="absolute left-0 top-0 z-10 rounded-full bg-foreground shadow-md"
          style={{ width: CURSOR_R * 2, height: CURSOR_R * 2 }}
        />
      </div>

      <p className="max-w-md text-center text-sm leading-relaxed text-muted-foreground text-pretty">
        Move the cursor with the left stick and press <Hint>A</Hint> / <Hint>Enter</Hint> to click
        targets. Small deflections move slowly for precision; full tilt is fast.
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}
