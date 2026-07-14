'use client'

import { useEffect, useRef, useState } from 'react'
import { Delete, Space } from 'lucide-react'
import { useGamepad, useShellInput } from './gamepad-context'
import { Glyph } from './button-hints'

// Jog-dial spiral keyboard (PS1 name-entry style):
// spin the LEFT analog stick in circles to scrub the cursor along a
// spiral tape of characters, press A to type the selected one.

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789.,-'!?@&".split('')

// degrees of stick rotation per character step — one full circle ≈ 10 chars
const DEG_PER_STEP = 36
// stick must be pushed this far out for rotation to register
const RING_THRESHOLD = 0.45

const A_GREEN = 'oklch(0.75 0.17 145)'
const B_RED = 'oklch(0.65 0.2 25)'

interface SpiralKeyboardProps {
  open: boolean
  label?: string
  text: string
  onType: (char: string) => void
  onBackspace: () => void
  onDone: () => void
}

/** smallest signed angular difference a→b in degrees (-180..180) */
function angleDelta(a: number, b: number): number {
  let d = b - a
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

export function SpiralKeyboard({ open, label, text, onType, onBackspace, onDone }: SpiralKeyboardProps) {
  const { sticks } = useGamepad()
  const [cursor, setCursor] = useState(0)
  const cursorRef = useRef(0)
  cursorRef.current = cursor
  // live stick angle for the needle indicator (null when stick is centered)
  const [stickAngle, setStickAngle] = useState<number | null>(null)

  // reset cursor whenever the keyboard is summoned
  useEffect(() => {
    if (open) setCursor(0)
  }, [open])

  // rAF loop: accumulate signed rotation of the left stick, step the cursor
  useEffect(() => {
    if (!open) return
    let raf = 0
    let lastAngle: number | null = null
    let acc = 0

    const loop = () => {
      const s = sticks.current
      let x = 0
      let y = 0
      if (s) {
        // left stick is the spiral dial; right stick works too as a fallback
        if (Math.hypot(s.lx, s.ly) > RING_THRESHOLD) {
          x = s.lx
          y = s.ly
        } else if (Math.hypot(s.rx, s.ry) > RING_THRESHOLD) {
          x = s.rx
          y = s.ry
        }
      }

      if (x !== 0 || y !== 0) {
        const angle = Math.atan2(y, x) * (180 / Math.PI)
        setStickAngle(angle)
        if (lastAngle !== null) {
          acc += angleDelta(lastAngle, angle)
          // clockwise (positive) = forward through the tape
          const steps = Math.trunc(acc / DEG_PER_STEP)
          if (steps !== 0) {
            acc -= steps * DEG_PER_STEP
            setCursor((c) => (((c + steps) % CHARS.length) + CHARS.length) % CHARS.length)
          }
        }
        lastAngle = angle
      } else {
        // stick released: forget angle so re-entry doesn't cause a jump
        lastAngle = null
        acc = 0
        setStickAngle(null)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [open, sticks])

  useShellInput(
    (action) => {
      switch (action) {
        case 'accept': // A — the one face button: type selected char
          onType(CHARS[cursorRef.current])
          return true
        case 'back': // B
          if (text.length > 0) onBackspace()
          else onDone()
          return true
        case 'lb':
          onBackspace()
          return true
        case 'rb':
          onType(' ')
          return true
        case 'start':
        case 'select':
          onDone()
          return true
        // D-pad / keyboard fallback: step the tape without a stick
        case 'left':
          setCursor((c) => (c + CHARS.length - 1) % CHARS.length)
          return true
        case 'right':
          setCursor((c) => (c + 1) % CHARS.length)
          return true
        case 'up':
          setCursor((c) => (c + CHARS.length - 5) % CHARS.length)
          return true
        case 'down':
          setCursor((c) => (c + 5) % CHARS.length)
          return true
        default:
          return true // modal
      }
    },
    // 300: the keyboard can be summoned ON TOP of other modals (e.g. the
    // channel manager, also priority 200) — it must always win input
    300,
    open,
  )

  if (!open) return null

  return <SpiralKeyboardBody label={label} text={text} cursor={cursor} stickAngle={stickAngle} />
}

/**
 * Rendering body, split out so layout hooks only run while open.
 * Characters are laid out along an Archimedean spiral in a fixed base
 * coordinate system, then the whole thing is scaled to fit the viewport.
 */
function SpiralKeyboardBody({
  label,
  text,
  cursor,
  stickAngle,
}: {
  label?: string
  text: string
  cursor: number
  stickAngle: number | null
}) {
  const R_MAX = 210 // outermost character radius (base coordinate system)
  const R_MIN = 78 // innermost character radius (leaves room for the hub)
  const TURNS = 2.5 // how many revolutions the tape makes
  const base = R_MAX * 2 + 72 // full bounding box incl. char overhang

  // precompute spiral positions: char 0 innermost, growing outward clockwise
  const positions = CHARS.map((_, i) => {
    const t = i / (CHARS.length - 1)
    const theta = (-90 + t * TURNS * 360) * (Math.PI / 180) // start at top
    const r = R_MIN + t * (R_MAX - R_MIN)
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r }
  })

  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // vertical space consumed by label, text field, hints, and breathing room
  const RESERVED_V = 240
  const scale =
    viewport.h === 0
      ? 1
      : Math.max(
          0.45,
          Math.min(1, (viewport.h - RESERVED_V) / base, (viewport.w - 48) / base),
        )
  const size = Math.round(base * scale)

  // smooth SVG path through the spiral for the tape line
  const path = positions
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x + base / 2).toFixed(1)} ${(p.y + base / 2).toFixed(1)}`)
    .join(' ')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 py-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Spiral keyboard"
    >
      {/* Label + text preview */}
      {label ? (
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary text-balance">
          {label}
        </p>
      ) : null}
      <div className="hud-pop mb-5 flex min-w-80 max-w-2xl items-center gap-3 rounded-xl border border-border bg-popover px-6 py-3">
        <span className="font-mono text-xl">
          {text || <span className="text-muted-foreground">Spin the stick…</span>}
        </span>
        <span className="glow-pulse h-6 w-0.5 bg-primary" aria-hidden="true" />
      </div>

      {/* Spiral tape — outer box reserves the SCALED footprint so flex layout
          accounts for the true rendered size; inner keeps base coordinates */}
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: base,
            height: base,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {/* tape line */}
          <svg
            className="absolute inset-0"
            width={base}
            height={base}
            viewBox={`0 0 ${base} ${base}`}
            aria-hidden="true"
          >
            <path d={path} fill="none" className="stroke-border" strokeWidth={2} />
          </svg>

          {/* characters along the spiral */}
          {CHARS.map((ch, i) => {
            const { x, y } = positions[i]
            const selected = i === cursor
            const dist = Math.min(
              Math.abs(i - cursor),
              CHARS.length - Math.abs(i - cursor),
            )
            const near = dist === 1
            return (
              <div
                key={i}
                className={`absolute left-1/2 top-1/2 flex items-center justify-center rounded-full border font-bold transition-all duration-100 ${
                  selected
                    ? 'tile-glow z-10 size-14 border-primary bg-secondary text-2xl text-primary'
                    : near
                      ? 'size-10 border-border bg-card text-base'
                      : 'size-8 border-transparent bg-card/60 text-sm text-muted-foreground'
                }`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {ch}
              </div>
            )
          })}

          {/* Center hub: big preview of the selected char + stick needle */}
          <div className="absolute left-1/2 top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-popover text-center">
            <span className="font-mono text-4xl font-bold text-primary">
              {CHARS[cursor]}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              spin to seek
            </span>
            {/* needle showing live stick angle */}
            {stickAngle !== null ? (
              <span
                className="absolute left-1/2 top-1/2 h-0.5 w-12 origin-left bg-primary/70"
                style={{ transform: `rotate(${stickAngle}deg)` }}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Hints */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Glyph label="A" color={A_GREEN} /> Type letter
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="B" color={B_RED} />
          <Delete className="size-4" aria-hidden="true" /> Backspace
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="RB" />
          <Space className="size-4" aria-hidden="true" /> Space
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="≡" /> Done
        </span>
      </div>
    </div>
  )
}
