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

/* ---------- data sync (native-only sources) ---------- */

interface BraveHistoryEntry {
  url: string
  title: string
  visited_at: number
}

/**
 * Read the local Brave profile's history (streaming domains only) and import
 * it into the shell DB. Runs on shell startup in the native build; a no-op in
 * the web preview (there the pipeline is exercised via the API directly).
 * Returns number of newly imported entries, or null if not native.
 */
export async function nativeSyncBraveHistory(): Promise<number | null> {
  const t = tauri()
  if (!t) return null
  try {
    const entries = (await t.core.invoke('read_brave_history', {
      limit: 2000,
    })) as BraveHistoryEntry[]
    if (!entries?.length) return 0
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    const json = (await res.json()) as { imported?: number }
    return json.imported ?? 0
  } catch (err) {
    console.log('[v0] Brave history sync failed:', err)
    return 0
  }
}

export interface InstalledGame {
  id: string
  name: string
  source: 'steam' | 'epic'
  launch_target: string
}

/** Scan Steam + Epic manifests for installed games. Native-only (null on web). */
export async function nativeScanInstalledGames(): Promise<InstalledGame[] | null> {
  const t = tauri()
  if (!t) return null
  try {
    return (await t.core.invoke('scan_installed_games')) as InstalledGame[]
  } catch (err) {
    console.log('[v0] Game scan failed:', err)
    return []
  }
}

/**
 * Subscribe to the global Guide-button hook (fires even when another app has
 * focus — Rust brings the shell window forward first). Returns unsubscribe.
 */
export function onGuideButton(handler: () => void): () => void {
  const w = window as unknown as {
    __TAURI__?: TauriGlobal & {
      event?: { listen: (name: string, cb: () => void) => Promise<() => void> }
    }
  }
  const listen = w.__TAURI__?.event?.listen
  if (!listen) return () => {}
  let unlisten: (() => void) | null = null
  listen('guide-button', handler).then((fn) => {
    unlisten = fn
  })
  return () => unlisten?.()
}
