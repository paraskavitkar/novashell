'use client'

import { useEffect, useRef, useState } from 'react'
import { Delete, Space } from 'lucide-react'
import { useGamepad, useShellInput } from './gamepad-context'
import { Glyph } from './button-hints'

// 8 sectors x 4 characters, daisy-wheel style.
// Petal positions: [top(Y), left(X), right(B), bottom(A)]
const SECTORS: string[][] = [
  ['a', 'b', 'c', 'd'],
  ['e', 'f', 'g', 'h'],
  ['i', 'j', 'k', 'l'],
  ['m', 'n', 'o', 'p'],
  ['q', 'r', 's', 't'],
  ['u', 'v', 'w', 'x'],
  ['y', 'z', '.', ','],
  ['?', '!', "'", '@'],
]

const BUTTON_COLORS = {
  y: 'oklch(0.8 0.15 90)', // yellow
  x: 'oklch(0.65 0.13 240)', // blue
  b: 'oklch(0.65 0.2 25)', // red
  a: 'oklch(0.75 0.17 145)', // green
}

interface SpiralKeyboardProps {
  open: boolean
  label?: string
  text: string
  onType: (char: string) => void
  onBackspace: () => void
  onDone: () => void
}

export function SpiralKeyboard({ open, label, text, onType, onBackspace, onDone }: SpiralKeyboardProps) {
  const { sticks } = useGamepad()
  const [sector, setSector] = useState<number | null>(null)
  const sectorRef = useRef<number | null>(null)
  sectorRef.current = sector
  // true when the current sector was chosen by the stick (so idle stick may clear it);
  // D-pad selections stick around until typed or changed
  const stickOwnedRef = useRef(false)

  // read stick angle every frame to pick the active sector
  useEffect(() => {
    if (!open) return
    let raf = 0
    const loop = () => {
      const s = sticks.current
      let x = 0
      let y = 0
      if (s) {
        // prefer right stick, fall back to left
        if (Math.hypot(s.rx, s.ry) > 0.45) {
          x = s.rx
          y = s.ry
        } else if (Math.hypot(s.lx, s.ly) > 0.45) {
          x = s.lx
          y = s.ly
        }
      }
      if (x !== 0 || y !== 0) {
        const angle = Math.atan2(y, x) * (180 / Math.PI) // -180..180, 0 = right
        const idx = Math.round((angle + 90 + 360) / 45) % 8 // 0 = top, clockwise
        stickOwnedRef.current = true
        if (sectorRef.current !== idx) setSector(idx)
      } else if (sectorRef.current !== null && stickOwnedRef.current) {
        // only clear stick-driven selections; keep D-pad selections
        stickOwnedRef.current = false
        setSector(null)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [open, sticks])

  useShellInput(
    (action) => {
      const s = sectorRef.current
      switch (action) {
        case 'y':
          if (s !== null) onType(SECTORS[s][0])
          return true
        case 'x':
          if (s !== null) onType(SECTORS[s][1])
          return true
        case 'back': // B
          if (s !== null) onType(SECTORS[s][2])
          else onDone() // B with no sector = close
          return true
        case 'accept': // A
          if (s !== null) onType(SECTORS[s][3])
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
        // dpad rotates sector for keyboard users
        case 'left':
        case 'up':
          stickOwnedRef.current = false
          setSector((cur) => (cur === null ? 0 : (cur + 7) % 8))
          return true
        case 'right':
        case 'down':
          stickOwnedRef.current = false
          setSector((cur) => (cur === null ? 0 : (cur + 1) % 8))
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

  return <SpiralKeyboardBody label={label} text={text} sector={sector} />
}

/**
 * Rendering body, split out so layout hooks only run while open.
 * The wheel has a fixed internal coordinate system (base px) and is scaled
 * down as a whole to fit the space left over by label + field + hints, so
 * no element can ever overlap another regardless of viewport height.
 */
function SpiralKeyboardBody({
  label,
  text,
  sector,
}: {
  label?: string
  text: string
  sector: number | null
}) {
  const R = 190 // wheel radius (base coordinate system)
  const base = R * 2 + 140 // full wheel bounding box incl. petal overhang

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
          {text || <span className="text-muted-foreground">Type with the wheel…</span>}
        </span>
        <span className="glow-pulse h-6 w-0.5 bg-primary" aria-hidden="true" />
      </div>

      {/* Daisy wheel — outer box reserves the SCALED footprint so flex layout
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
        {SECTORS.map((chars, i) => {
          const angle = (i * 45 - 90) * (Math.PI / 180)
          const cx = Math.cos(angle) * R
          const cy = Math.sin(angle) * R
          const selected = sector === i
          return (
            <div
              key={i}
              className={`absolute left-1/2 top-1/2 flex size-28 items-center justify-center rounded-full border transition-all duration-150 ${
                selected ? 'tile-glow z-10 border-primary bg-secondary' : 'border-border bg-card/80'
              }`}
              style={{
                // scale must come AFTER translate in the transform list —
                // the Tailwind scale-125 utility uses the CSS `scale`
                // property, which applies BEFORE `transform` and would
                // multiply the petal's radial offset, pushing it out of
                // the wheel (the overlap bug)
                transform: `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${selected ? 1.25 : 1})`,
              }}
            >
              {/* 4 letters in petal positions */}
              <span
                className="absolute top-1.5 text-lg font-bold"
                style={selected ? { color: BUTTON_COLORS.y } : undefined}
              >
                {chars[0]}
              </span>
              <span
                className="absolute left-3 text-lg font-bold"
                style={selected ? { color: BUTTON_COLORS.x } : undefined}
              >
                {chars[1]}
              </span>
              <span
                className="absolute right-3 text-lg font-bold"
                style={selected ? { color: BUTTON_COLORS.b } : undefined}
              >
                {chars[2]}
              </span>
              <span
                className="absolute bottom-1.5 text-lg font-bold"
                style={selected ? { color: BUTTON_COLORS.a } : undefined}
              >
                {chars[3]}
              </span>
            </div>
          )
        })}

        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-popover text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Aim
          </span>
          <span className="text-xs text-muted-foreground">stick</span>
        </div>
        </div>
      </div>

      {/* Hints */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Glyph label="Y" color={BUTTON_COLORS.y} />
          <Glyph label="X" color={BUTTON_COLORS.x} />
          <Glyph label="B" color={BUTTON_COLORS.b} />
          <Glyph label="A" color={BUTTON_COLORS.a} />
          Type letter
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="RB" />
          <Space className="size-4" aria-hidden="true" /> Space
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="LB" />
          <Delete className="size-4" aria-hidden="true" /> Backspace
        </span>
        <span className="flex items-center gap-2">
          <Glyph label="≡" /> Done
        </span>
      </div>
    </div>
  )
}
