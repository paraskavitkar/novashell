// Standard gamepad (XInput) button indices — matches Cosmic Byte Ares Pro in XInput mode
export const BTN = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  LS: 10,
  RS: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
  GUIDE: 16,
} as const

// Abstract actions dispatched through the shell input stack
export type ShellAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'accept' // A
  | 'back' // B
  | 'x' // X
  | 'y' // Y
  | 'lb'
  | 'rb'
  | 'start' // Menu
  | 'select' // View/Back button
  | 'guide' // Xbox button

// Handler returns true if it consumed the action
export type ActionHandler = (action: ShellAction) => boolean

export interface StickState {
  lx: number
  ly: number
  rx: number
  ry: number
  lt: number
  rt: number
}

export const DEADZONE = 0.18

export function applyDeadzone(v: number): number {
  const a = Math.abs(v)
  if (a < DEADZONE) return 0
  const sign = v < 0 ? -1 : 1
  // rescale so movement starts smoothly at the deadzone edge
  return sign * ((a - DEADZONE) / (1 - DEADZONE))
}

// Keyboard fallback mapping (for testing without a controller)
export const KEY_TO_ACTION: Record<string, ShellAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'accept',
  Escape: 'back',
  Backspace: 'back',
  x: 'x',
  X: 'x',
  c: 'y',
  C: 'y',
  q: 'lb',
  Q: 'lb',
  e: 'rb',
  E: 'rb',
  Tab: 'start',
  g: 'guide',
  G: 'guide',
  Home: 'guide',
}

// Repeat timing for held directions (ms)
export const REPEAT_DELAY = 340
export const REPEAT_INTERVAL = 110
