'use client'

/**
 * Native bridge — one call surface, two backends.
 *
 * Inside the Tauri desktop build, every action here hits real OS code
 * (src-tauri/src/main.rs): real process launching, real cursor movement,
 * real keyboard injection, real system volume.
 *
 * In the browser preview, each action falls back to the best web equivalent
 * so the whole shell stays testable.
 */

interface TauriGlobal {
  core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }
}

function tauri(): TauriGlobal | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__ ?? null
}

export function isNative(): boolean {
  return tauri() !== null
}

/** steam:// | epic:// | spotify: | exe | https:// (Brave app mode when native) */
export async function nativeLaunch(target: string): Promise<boolean> {
  const t = tauri()
  if (t) {
    await t.core.invoke('launch_target', { target })
    return true
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    window.open(target, '_blank', 'noopener')
    return true
  }
  return false // protocol/exe launches are native-only
}

export async function nativeMoveCursor(dx: number, dy: number): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('move_cursor', { dx: Math.round(dx), dy: Math.round(dy) })
  return true
}

export async function nativeClick(button: 'left' | 'right' | 'middle' = 'left'): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('click', { button })
  return true
}

export async function nativeScroll(dy: number): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('scroll', { dy: Math.round(dy) })
  return true
}

export async function nativeTypeText(text: string): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('type_text', { text })
  return true
}

export async function nativeSetVolume(level: number): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('set_volume', { level: Math.max(0, Math.min(100, Math.round(level))) })
  return true
}

export async function nativeExit(): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  await t.core.invoke('exit_to_windows')
  return true
}
