'use client'

import { useEffect, useRef, useState } from 'react'
import { FileCode2, Gamepad2, MousePointer2, Search, X } from 'lucide-react'
import { isNative, nativeClick, nativeMoveCursor, nativeScroll } from '@/lib/native'
import { useGamepad, useShellInput } from './gamepad-context'
import { ButtonHints } from './button-hints'

const CURSOR_MAX_SPEED = 1100 // px per second at full deflection
const SCROLL_SPEED = 1000 // px per second at full deflection

const CODE_LINES = [
  'import { useGamepad } from "@/hooks/use-gamepad"',
  '',
  'export function VirtualMouse() {',
  '  // The left stick drives the OS cursor through',
  '  // the native input layer (Tauri command).',
  '  const { sticks } = useGamepad()',
  '',
  '  useFrame((dt) => {',
  '    const vx = expo(sticks.lx) * MAX_SPEED * dt',
  '    const vy = expo(sticks.ly) * MAX_SPEED * dt',
  '    invoke("move_cursor", { vx, vy })',
  '  })',
  '',
  '  // Right stick scrolls the window under the cursor',
  '  useFrame((dt) => {',
  '    invoke("scroll", { dy: sticks.ry * SCROLL_SPEED * dt })',
  '  })',
  '',
  '  return null',
  '}',
  '',
  '// A button  -> left click',
  '// X button  -> right click',
  '// Y button  -> spiral keyboard overlay',
  '// Guide/Xbox -> back to NovaShell home',
  '',
  'function expo(v: number) {',
  '  // response curve: precise near center, fast at edges',
  '  return Math.sign(v) * Math.pow(Math.abs(v), 1.7)',
  '}',
  '',
  'export const config = {',
  '  deadzone: 0.18,',
  '  pollHz: 120,',
  '  scrollTaper: "smooth",',
  '}',
]

interface Ripple {
  id: number
  x: number
  y: number
}

export function DesktopMode({
  active,
  visible = active,
  typedText,
  onOpenKeyboard,
}: {
  /** input + cursor loops enabled */
  active: boolean
  /** rendered on screen (stays visible under the keyboard overlay) */
  visible?: boolean
  typedText: string
  onOpenKeyboard: () => void
}) {
  const { sticks, connected } = useGamepad()
  const cursorRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })
  const [ripples, setRipples] = useState<Ripple[]>([])
  const rippleId = useRef(0)
  const [activeTab, setActiveTab] = useState('virtual-mouse.tsx')

  // center cursor on mount
  useEffect(() => {
    if (!active) return
    pos.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }, [active])

  const doClick = () => {
    const { x, y } = pos.current
    setRipples((r) => [...r.slice(-4), { id: ++rippleId.current, x, y }])
    // Native build: real OS click at the real cursor position
    if (isNative()) {
      nativeClick('left')
      return
    }
    // Web preview: hit-test and dispatch a DOM click
    const cursor = cursorRef.current
    if (cursor) cursor.style.pointerEvents = 'none'
    const el = document.elementFromPoint(x, y)
    if (el instanceof HTMLElement) el.click()
  }

  useShellInput(
    (action) => {
      switch (action) {
        case 'accept':
          doClick()
          return true
        case 'y':
          onOpenKeyboard()
          return true
        // dpad/arrow nudges for keyboard users
        case 'up':
          pos.current.y -= 24
          return true
        case 'down':
          pos.current.y += 24
          return true
        case 'left':
          pos.current.x -= 24
          return true
        case 'right':
          pos.current.x += 24
          return true
        case 'lb':
          if (scrollRef.current) scrollRef.current.scrollTop -= 120
          return true
        case 'rb':
          if (scrollRef.current) scrollRef.current.scrollTop += 120
          return true
        default:
          return false
      }
    },
    100,
    active,
  )

  // analog cursor + scroll loop
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()

    const expo = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.7)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = sticks.current

      if (s) {
        const dx = expo(s.lx) * CURSOR_MAX_SPEED * dt
        const dy = expo(s.ly) * CURSOR_MAX_SPEED * dt

        if (isNative()) {
          // Drive the REAL Windows cursor + wheel through the Rust core
          if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) nativeMoveCursor(dx, dy)
          if (Math.abs(s.ry) > 0.05) nativeScroll(-expo(s.ry) * 3)
        }

        pos.current.x += dx
        pos.current.y += dy
        pos.current.x = Math.max(0, Math.min(window.innerWidth - 2, pos.current.x))
        pos.current.y = Math.max(0, Math.min(window.innerHeight - 2, pos.current.y))

        if (!isNative() && scrollRef.current && Math.abs(s.ry) > 0.05) {
          scrollRef.current.scrollTop += expo(s.ry) * SCROLL_SPEED * dt
        }
      }

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, sticks])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* Fake desktop workspace */}
      <div className="flex min-h-0 flex-1 flex-col p-6 md:p-10">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Window title bar */}
          <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2.5">
            <div className="flex items-center gap-3">
              <FileCode2 className="size-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">Cursor — nova-shell</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-muted" aria-hidden="true" />
              <span className="size-3 rounded-full bg-muted" aria-hidden="true" />
              <span className="size-3 rounded-full bg-destructive" aria-hidden="true" />
            </div>
          </div>

          {/* Tabs — clickable with the virtual cursor */}
          <div className="flex items-center gap-1 border-b border-border bg-card px-2 pt-2">
            {['virtual-mouse.tsx', 'shell.tsx', 'keyboard.tsx'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-t-md px-4 py-2 font-mono text-xs transition-colors ${
                  activeTab === tab
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {activeTab === tab ? <X className="size-3" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>

          {/* Search field — filled by the spiral keyboard */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className={`font-mono text-sm ${typedText ? 'text-foreground' : 'text-muted-foreground'}`}>
              {typedText || 'Press Y to type with the spiral keyboard…'}
            </span>
            <span className="glow-pulse h-4 w-0.5 bg-primary" aria-hidden="true" />
          </div>

          {/* Scrollable editor body — right stick scrolls this */}
          <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col py-4">
              {[...CODE_LINES, ...CODE_LINES, ...CODE_LINES].map((line, i) => (
                <div key={i} className="flex gap-6 px-4 font-mono text-sm leading-7">
                  <span className="w-8 select-none text-right text-muted-foreground/50">
                    {i + 1}
                  </span>
                  <span className={line.startsWith('//') || line.trim().startsWith('//') ? 'text-muted-foreground' : 'text-foreground/90'}>
                    {line || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Taskbar */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <MousePointer2 className="size-4 text-primary" aria-hidden="true" />
            Virtual mouse active
            {!connected ? ' — connect a controller or use arrow keys' : ''}
          </div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Gamepad2 className="size-4" aria-hidden="true" />
            <span>Press Guide (Xbox) or G to return to NovaShell</span>
          </div>
        </div>
      </div>

      <ButtonHints
        hints={[
          { glyph: 'LS', label: 'Move cursor' },
          { glyph: 'RS', label: 'Scroll' },
          { glyph: 'A', label: 'Click', color: 'oklch(0.75 0.17 145)' },
          { glyph: 'Y', label: 'Spiral keyboard', color: 'oklch(0.8 0.15 90)' },
          { glyph: 'ⓖ', label: 'Home' },
        ]}
      />

      {/* Click ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="click-ripple pointer-events-none fixed z-50 size-12 rounded-full border-2 border-primary"
          style={{ left: r.x, top: r.y }}
          aria-hidden="true"
        />
      ))}

      {/* Virtual cursor */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-50"
        aria-hidden="true"
      >
        <MousePointer2
          className="size-7 fill-primary text-primary-foreground drop-shadow-[0_0_10px_oklch(0.82_0.13_195_/_60%)]"
        />
      </div>
    </div>
  )
}
