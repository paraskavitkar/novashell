'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  BTN,
  KEY_TO_ACTION,
  REPEAT_DELAY,
  REPEAT_INTERVAL,
  applyDeadzone,
  type ActionHandler,
  type ShellAction,
  type StickState,
} from '@/lib/gamepad'

interface RegisteredHandler {
  id: number
  priority: number
  handler: ActionHandler
}

interface GamepadContextValue {
  /** Register an action handler. Higher priority receives actions first. Returns unregister fn. */
  register: (handler: ActionHandler, priority: number) => () => void
  /** Live analog stick / trigger values, updated every frame. Read inside rAF loops. */
  sticks: RefObject<StickState>
  connected: boolean
  padName: string | null
}

const GamepadContext = createContext<GamepadContextValue | null>(null)

export function useGamepad() {
  const ctx = useContext(GamepadContext)
  if (!ctx) throw new Error('useGamepad must be used within GamepadProvider')
  return ctx
}

/** Register a shell input handler while mounted (or while `active`). */
export function useShellInput(handler: ActionHandler, priority: number, active = true) {
  const { register } = useGamepad()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    return register((a) => handlerRef.current(a), priority)
  }, [register, priority, active])
}

// Buttons that dispatch one action per press (no auto-repeat)
const PRESS_ACTIONS: Array<[number, ShellAction]> = [
  [BTN.A, 'accept'],
  [BTN.B, 'back'],
  [BTN.X, 'x'],
  [BTN.Y, 'y'],
  [BTN.LB, 'lb'],
  [BTN.RB, 'rb'],
  [BTN.START, 'start'],
  [BTN.BACK, 'select'],
  [BTN.GUIDE, 'guide'],
]

// Directions auto-repeat while held (dpad or left stick)
const DIRECTIONS: ShellAction[] = ['up', 'down', 'left', 'right']

export function GamepadProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<RegisteredHandler[]>([])
  const idRef = useRef(0)
  const sticks = useRef<StickState>({ lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 })
  const [connected, setConnected] = useState(false)
  const [padName, setPadName] = useState<string | null>(null)

  const dispatch = useCallback((action: ShellAction) => {
    const sorted = [...handlersRef.current].sort((a, b) => b.priority - a.priority)
    for (const h of sorted) {
      if (h.handler(action)) return
    }
  }, [])

  const register = useCallback((handler: ActionHandler, priority: number) => {
    const id = ++idRef.current
    handlersRef.current.push({ id, priority, handler })
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h.id !== id)
    }
  }, [])

  // Gamepad polling loop
  useEffect(() => {
    let raf = 0
    const prevButtons: boolean[] = []
    // held-direction repeat state
    const dirState: Record<string, { heldAt: number; lastFire: number } | null> = {
      up: null,
      down: null,
      left: null,
      right: null,
    }
    let wasConnected = false

    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      const pad = Array.from(pads).find((p) => p && p.connected) ?? null

      if (!!pad !== wasConnected) {
        wasConnected = !!pad
        setConnected(!!pad)
        setPadName(pad ? pad.id : null)
      }

      if (pad) {
        // analog values
        sticks.current.lx = applyDeadzone(pad.axes[0] ?? 0)
        sticks.current.ly = applyDeadzone(pad.axes[1] ?? 0)
        sticks.current.rx = applyDeadzone(pad.axes[2] ?? 0)
        sticks.current.ry = applyDeadzone(pad.axes[3] ?? 0)
        sticks.current.lt = pad.buttons[BTN.LT]?.value ?? 0
        sticks.current.rt = pad.buttons[BTN.RT]?.value ?? 0

        // edge-detected button presses
        for (const [idx, action] of PRESS_ACTIONS) {
          const pressed = pad.buttons[idx]?.pressed ?? false
          if (pressed && !prevButtons[idx]) dispatch(action)
          prevButtons[idx] = pressed
        }

        // directional input: dpad OR left stick past threshold
        const now = performance.now()
        const dirHeld: Record<string, boolean> = {
          up: (pad.buttons[BTN.UP]?.pressed ?? false) || sticks.current.ly < -0.55,
          down: (pad.buttons[BTN.DOWN]?.pressed ?? false) || sticks.current.ly > 0.55,
          left: (pad.buttons[BTN.LEFT]?.pressed ?? false) || sticks.current.lx < -0.55,
          right: (pad.buttons[BTN.RIGHT]?.pressed ?? false) || sticks.current.lx > 0.55,
        }

        for (const dir of DIRECTIONS) {
          if (dirHeld[dir]) {
            const st = dirState[dir]
            if (!st) {
              dirState[dir] = { heldAt: now, lastFire: now }
              dispatch(dir)
            } else if (
              now - st.heldAt > REPEAT_DELAY &&
              now - st.lastFire > REPEAT_INTERVAL
            ) {
              st.lastFire = now
              dispatch(dir)
            }
          } else {
            dirState[dir] = null
          }
        }
      } else {
        sticks.current.lx = 0
        sticks.current.ly = 0
        sticks.current.rx = 0
        sticks.current.ry = 0
        sticks.current.lt = 0
        sticks.current.rt = 0
      }

      raf = requestAnimationFrame(poll)
    }

    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [dispatch])

  // Keyboard fallback for testing without a controller
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEY_TO_ACTION[e.key]
      if (!action) return
      // let native repeat drive held arrows, block everything else repeating
      if (e.repeat && !['up', 'down', 'left', 'right'].includes(action)) return
      e.preventDefault()
      dispatch(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  return (
    <GamepadContext.Provider value={{ register, sticks, connected, padName }}>
      {children}
    </GamepadContext.Provider>
  )
}
