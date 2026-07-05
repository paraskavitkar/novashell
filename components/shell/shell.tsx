'use client'

import { useCallback, useRef, useState } from 'react'
import type { ContentItem, ShellApp } from '@/lib/client'
import { isNative, nativeExit, nativeLaunch, nativeSetVolume, nativeTypeText } from '@/lib/native'
import { useShellInput } from './gamepad-context'
import { TopBar } from './top-bar'
import { HomeScreen } from './home-screen'
import { QuickSettings } from './quick-settings'
import { VolumeHud } from './volume-hud'
import { LaunchSplash } from './launch-splash'
import { DesktopMode } from './desktop-mode'
import { SpiralKeyboard } from './spiral-keyboard'
import { LibraryManager } from './library-manager'
import { YouTubeTv } from './youtube-tv'

type Mode = 'console' | 'desktop' | 'library' | 'youtube'

interface KeyboardRequest {
  label: string
  value: string
  onCommit: (v: string) => void
}

export function Shell() {
  const [mode, setMode] = useState<Mode>('console')
  const [quickOpen, setQuickOpen] = useState(false)
  const [launching, setLaunching] = useState<ShellApp | null>(null)
  const [keyboard, setKeyboard] = useState<KeyboardRequest | null>(null)

  const [desktopText, setDesktopText] = useState('')
  const [volume, setVolume] = useState(65)
  const [volumeVisible, setVolumeVisible] = useState(false)
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showVolume = useCallback((v: number) => {
    setVolume(v)
    setVolumeVisible(true)
    nativeSetVolume(v) // real system volume in the desktop build; no-op on web
    if (volumeTimer.current) clearTimeout(volumeTimer.current)
    volumeTimer.current = setTimeout(() => setVolumeVisible(false), 1600)
  }, [])

  const requestText = useCallback(
    (label: string, initial: string, onCommit: (v: string) => void) => {
      setKeyboard({ label, value: initial, onCommit })
    },
    [],
  )

  const handleLaunch = useCallback((app: ShellApp) => {
    const target = app.launch_target
    if (target === 'builtin:desktop') {
      setMode('desktop')
      return
    }
    if (target === 'builtin:library') {
      setMode('library')
      return
    }
    if (target === 'builtin:youtube-tv') {
      setMode('youtube')
      return
    }
    if (target === 'builtin:exit') {
      // Native build: close the shell window (back to Windows). Web: splash.
      if (isNative()) {
        nativeExit()
        return
      }
      setLaunching(app)
      return
    }
    // Native build: real launch (steam://, epic://, exe, Brave app mode).
    // Web preview: splash stands in for the launch handoff.
    if (isNative()) {
      nativeLaunch(target)
      setLaunching(app)
      setTimeout(() => setLaunching(null), 2200)
      return
    }
    setLaunching(app)
  }, [])

  // Content from the discovery banner opens in the matching service.
  // Native build: Brave app-mode window. Web preview: new tab.
  const handleOpenContent = useCallback((item: ContentItem) => {
    if (item.url) nativeLaunch(item.url)
  }, [])

  // Highest priority: Guide (Xbox) button toggles console <-> desktop from anywhere.
  // In the native build this maps to the physical Xbox button / a global hotkey.
  useShellInput(
    (action) => {
      if (action === 'guide') {
        setQuickOpen(false)
        setKeyboard(null)
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
    mode !== 'desktop' && !keyboard,
  )

  const homeActive = mode === 'console' && !quickOpen && !keyboard && !launching

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {mode === 'console' ? (
        <>
          <TopBar volume={volume} />
          <HomeScreen
            active={homeActive}
            onLaunch={handleLaunch}
            onOpenContent={handleOpenContent}
            onOpenQuick={() => setQuickOpen(true)}
          />
        </>
      ) : null}

      {mode === 'library' ? (
        <LibraryManager
          active={!keyboard && !quickOpen}
          onBack={() => setMode('console')}
          requestText={requestText}
        />
      ) : null}

      {mode === 'youtube' ? (
        <YouTubeTv
          active={!keyboard && !quickOpen}
          onBack={() => setMode('console')}
          onOpenSearch={() =>
            requestText('Search YouTube', '', (q) => {
              if (q.trim()) {
                window.open(
                  `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`,
                  '_blank',
                  'noopener',
                )
              }
            })
          }
        />
      ) : null}

      <DesktopMode
        active={mode === 'desktop' && !keyboard}
        visible={mode === 'desktop'}
        typedText={desktopText}
        onOpenKeyboard={() => requestText('Type into the app', desktopText, setDesktopText)}
      />

      {launching ? <LaunchSplash app={launching} onClose={() => setLaunching(null)} /> : null}

      <QuickSettings
        open={quickOpen}
        volume={volume}
        onVolumeChange={showVolume}
        onClose={() => setQuickOpen(false)}
        onDesktopMode={() => {
          setQuickOpen(false)
          setMode('desktop')
        }}
        onOpenKeyboard={() => {
          setQuickOpen(false)
          requestText('Type into the app', desktopText, setDesktopText)
        }}
      />

      <SpiralKeyboard
        open={!!keyboard}
        label={keyboard?.label}
        text={keyboard?.value ?? ''}
        onType={(c) => setKeyboard((k) => (k ? { ...k, value: k.value + c } : k))}
        onBackspace={() => setKeyboard((k) => (k ? { ...k, value: k.value.slice(0, -1) } : k))}
        onDone={() => {
          if (keyboard) keyboard.onCommit(keyboard.value)
          setKeyboard(null)
        }}
      />

      {/* Quick Settings already shows a volume slider — suppress the floating HUD to avoid overlap */}
      <VolumeHud volume={volume} visible={volumeVisible && !quickOpen} />
    </div>
  )
}
