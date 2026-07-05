'use client'

import { useEffect, useRef, useState } from 'react'
import { ROWS, type TileItem } from '@/lib/apps-data'
import { useShellInput } from './gamepad-context'
import { TileIcon } from './tile-icon'
import { ButtonHints } from './button-hints'

interface HomeScreenProps {
  active: boolean
  onLaunch: (item: TileItem) => void
  onOpenQuick: () => void
  onDesktopMode: () => void
}

export function HomeScreen({ active, onLaunch, onOpenQuick, onDesktopMode }: HomeScreenProps) {
  const [rowIndex, setRowIndex] = useState(0)
  const [colIndexes, setColIndexes] = useState<number[]>(() => ROWS.map(() => 0))
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const focused = ROWS[rowIndex].items[colIndexes[rowIndex]]

  useShellInput(
    (action) => {
      switch (action) {
        case 'up':
          setRowIndex((r) => Math.max(0, r - 1))
          return true
        case 'down':
          setRowIndex((r) => Math.min(ROWS.length - 1, r + 1))
          return true
        case 'left':
          setColIndexes((cols) => {
            const next = [...cols]
            next[rowIndex] = Math.max(0, next[rowIndex] - 1)
            return next
          })
          return true
        case 'right':
          setColIndexes((cols) => {
            const next = [...cols]
            next[rowIndex] = Math.min(ROWS[rowIndex].items.length - 1, next[rowIndex] + 1)
            return next
          })
          return true
        case 'accept':
          activate(focused)
          return true
        case 'start':
          onOpenQuick()
          return true
        default:
          return false
      }
    },
    10,
    active,
  )

  function activate(item: TileItem) {
    if (item.action === 'quick') onOpenQuick()
    else if (item.action === 'windows') onDesktopMode()
    else onLaunch(item)
  }

  // keep focused tile in view
  useEffect(() => {
    const el = tileRefs.current.get(focused.id)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
  }, [focused.id])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cinematic backdrop from the focused game */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {focused.image ? (
          <img
            key={focused.image}
            src={focused.image || "/placeholder.svg"}
            alt=""
            className="size-full scale-110 object-cover opacity-30 blur-2xl transition-opacity duration-700"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Hero — focused item */}
      <section className="px-10 pb-6 pt-8 md:px-14" aria-live="polite">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-primary">
          {focused.kind === 'game' ? 'Game' : focused.kind === 'media' ? 'App' : 'System'}
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          {focused.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{focused.subtitle}</p>
      </section>

      {/* Tile rows */}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-10 pb-8 md:px-14">
        {ROWS.map((row, r) => {
          const rowFocused = r === rowIndex
          return (
            <section key={row.id}>
              <h2
                className={`mb-3 text-sm font-semibold uppercase tracking-widest transition-colors ${
                  rowFocused ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {row.label}
              </h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto py-3 pl-1">
                {row.items.map((item, c) => {
                  const isFocused = rowFocused && c === colIndexes[r]
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        if (el) tileRefs.current.set(item.id, el)
                        else tileRefs.current.delete(item.id)
                      }}
                      type="button"
                      tabIndex={-1}
                      aria-label={`${item.title} — ${item.subtitle}`}
                      onClick={() => {
                        setRowIndex(r)
                        setColIndexes((cols) => {
                          const next = [...cols]
                          next[r] = c
                          return next
                        })
                        activate(item)
                      }}
                      className={`group relative shrink-0 overflow-hidden rounded-xl bg-card text-left transition-all duration-200 ease-out ${
                        item.kind === 'game' ? 'h-36 w-64 md:h-40 md:w-72' : 'size-32 md:size-36'
                      } ${
                        isFocused
                          ? 'tile-glow z-10 scale-105'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {item.image ? (
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex size-full flex-col items-center justify-center gap-3"
                          style={{ backgroundColor: item.tint }}
                        >
                          <TileIcon name={item.icon ?? 'monitor'} className="size-10 text-foreground" />
                          <span className="text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                        </div>
                      )}
                      {item.image ? (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                          <span className="text-sm font-semibold text-white">{item.title}</span>
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <ButtonHints
        hints={[
          { glyph: 'A', label: 'Launch', color: 'oklch(0.75 0.17 145)' },
          { glyph: 'B', label: 'Back', color: 'oklch(0.65 0.2 25)' },
          { glyph: '≡', label: 'Quick Settings' },
          { glyph: 'LB', label: 'Vol −' },
          { glyph: 'RB', label: 'Vol +' },
          { glyph: 'ⓖ', label: 'Desktop Mode' },
        ]}
      />
    </div>
  )
}
