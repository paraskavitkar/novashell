'use client'

import { useEffect, useRef } from 'react'
import {
  StickFilter,
  type StickSample,
  type StickSettings,
} from '@/lib/input'

export interface InputFrame {
  connected: boolean
  usingKeyboard: boolean
  /** Raw left stick, pre-filter (for the visualizer) */
  raw: { x: number; y: number }
  /** Filtered left stick */
  stick: StickSample
  /** Buttons currently held (standard mapping: 0=A 1=B 2=X 3=Y) */
  held: boolean[]
  /** Buttons that went down this frame */
  justPressed: boolean[]
  dtMs: number
  rumble: (durationMs?: number, magnitude?: number) => void
}

const BUTTON_COUNT = 16

/**
 * Single rAF input loop. Polls the first connected gamepad; falls back to a
 * keyboard simulation (arrows/WASD steer a virtual stick, Enter = A,
 * Escape = B) so everything is testable without a controller.
 */
export function useInputLoop(
  settingsRef: React.RefObject<StickSettings>,
  onFrame: (frame: InputFrame) => void,
) {
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    const filter = new StickFilter()
    const prevHeld = new Array<boolean>(BUTTON_COUNT).fill(false)
    const keys = new Set<string>()
    let raf = 0
    let lastT = performance.now()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      keys.add(e.key)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const tick = (t: number) => {
      const dtMs = Math.min(50, t - lastT)
      lastT = t

      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      let pad: Gamepad | null = null
      for (const p of pads) {
        if (p && p.connected) {
          pad = p
          break
        }
      }

      let rawX = 0
      let rawY = 0
      const held = new Array<boolean>(BUTTON_COUNT).fill(false)
      let usingKeyboard = false

      if (pad) {
        rawX = pad.axes[0] ?? 0
        rawY = pad.axes[1] ?? 0
        for (let i = 0; i < Math.min(BUTTON_COUNT, pad.buttons.length); i++) {
          held[i] = pad.buttons[i]?.pressed ?? false
        }
      }

      // Keyboard fallback / augmentation
      const kx =
        (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) -
        (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0)
      const ky =
        (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) -
        (keys.has('ArrowUp') || keys.has('w') ? 1 : 0)
      if (kx !== 0 || ky !== 0) {
        const m = Math.hypot(kx, ky)
        rawX = kx / m
        rawY = ky / m
        usingKeyboard = true
      }
      if (keys.has('Enter')) {
        held[0] = true
        usingKeyboard = usingKeyboard || !pad
      }
      if (keys.has('Escape')) {
        held[1] = true
        usingKeyboard = usingKeyboard || !pad
      }

      const justPressed = new Array<boolean>(BUTTON_COUNT).fill(false)
      for (let i = 0; i < BUTTON_COUNT; i++) {
        justPressed[i] = held[i] && !prevHeld[i]
        prevHeld[i] = held[i]
      }

      const stick = filter.update(rawX, rawY, dtMs, settingsRef.current)

      onFrameRef.current({
        connected: !!pad,
        usingKeyboard,
        raw: { x: rawX, y: rawY },
        stick,
        held,
        justPressed,
        dtMs,
        rumble: (durationMs = 40, magnitude = 0.4) => {
          const actuator = (pad as Gamepad | null)?.vibrationActuator
          actuator
            ?.playEffect('dual-rumble', {
              duration: durationMs,
              weakMagnitude: magnitude,
              strongMagnitude: magnitude * 0.5,
            })
            .catch(() => {})
        },
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [settingsRef])
}
