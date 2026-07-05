'use client'

import { useCallback, useRef, useState } from 'react'
import type { TileItem } from '@/lib/apps-data'
import { useShellInput } from './gamepad-context'
import { TopBar } from './top-bar'
import { HomeScreen } from './home-screen'
import { QuickSettings } from './quick-settings'
import { VolumeHud } from './volume-hud'
import { LaunchSplash } from './launch-splash'
import { DesktopMode } from './desktop-mode'
import { SpiralKeyboard } from './spiral-keyboard'

type Mode = 'console' | 'desktop'

export function Shell() {
  const [mode, setMode] = useState<Mode>('console')
  const [quickOpen, setQuickOpen] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [launching, setLaunching] = useState<TileItem | null>(null)

  const [volume, setVolume] = useState(65)
  const [volumeVisible, setVolumeVisible] = useState(false)
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [typedText, setTypedText] = useState('')

  const showVolume = useCallback((v: number) => {
    setVolume(v)
    setVolumeVisible(true)
    if (volumeTimer.current) clearTimeout(volumeTimer.current)
    volumeTimer.current = setTimeout(() => setVolumeVisible(false), 1600)
  }, [])

  // Highest priority: Guide (Xbox) button toggles console <-> desktop from anywhere.
  // In the native build this maps to the physical Xbox button / a global hotkey.
  useShellInput(
    (action) => {
      if (action === 'guide') {
        setQuickOpen(false)
        setKeyboardOpen(false)
        setLaunching(null)
        setMode((m) => (m === 'console' ? 'desktop' : 'console'))
        return true
      }
      return false
    },
    300,
    true,
  )

  // Global volume on LB/RB (sits below modals, above screens)
  useShellInput(
    (action) => {
      if (action === 'lb') {
        showVolume(Math.max(0, volume - 5))
        return true
      }
      if (action === 'rb') {
        showVolume(Math.min(100, volume + 5))
        return true
      }
      return false
    },
    90,
    mode === 'console' && !keyboardOpen,
  )

  const homeActive = mode === 'console' && !quickOpen && !keyboardOpen && !launching

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {mode === 'console' ? (
        <>
          <TopBar volume={volume} />
          <HomeScreen
            active={homeActive}
            onLaunch={setLaunching}
            onOpenQuick={() => setQuickOpen(true)}
            onDesktopMode={() => setMode('desktop')}
          />
        </>
      ) : null}

      <DesktopMode
        active={mode === 'desktop' && !keyboardOpen}
        visible={mode === 'desktop'}
        typedText={typedText}
        onOpenKeyboard={() => setKeyboardOpen(true)}
      />

      {launching ? (
        <LaunchSplash item={launching} onClose={() => setLaunching(null)} />
      ) : null}

      <QuickSettings
        open={quickOpen}
        volume={volume}
        onVolumeChange={showVolume}
        onClose={() => setQuickOpen(false)}
        onDesktopMode={() => setMode('desktop')}
        onOpenKeyboard={() => setKeyboardOpen(true)}
      />

      <SpiralKeyboard
        open={keyboardOpen}
        text={typedText}
        onType={(c) => setTypedText((t) => t + c)}
        onBackspace={() => setTypedText((t) => t.slice(0, -1))}
        onDone={() => setKeyboardOpen(false)}
      />

      <VolumeHud volume={volume} visible={volumeVisible} />
    </div>
  )
}
