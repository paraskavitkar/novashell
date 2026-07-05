'use client'

/**
 * Discovery banner — full-bleed auto-rotating carousel of trending
 * shows/movies matched to the user's learned taste. Android-TV style:
 * cinematic image, quiet copy block, thin segment progress indicators.
 * Rotation pauses while the banner row is focused.
 */

import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentItem } from '@/lib/client'

const ROTATE_MS = 8000

export function DiscoveryBanner({
  items,
  focused,
  index,
  onIndexChange,
}: {
  items: ContentItem[]
  /** the banner row currently holds shell focus */
  focused: boolean
  index: number
  onIndexChange: (next: number) => void
}) {
  const [tick, setTick] = useState(0) // remounts segment animation
  const indexRef = useRef(index)
  indexRef.current = index

  // auto-rotate (paused while focused so the user can read/decide)
  useEffect(() => {
    if (focused || items.length < 2) return
    const t = setInterval(() => {
      onIndexChange((indexRef.current + 1) % items.length)
      setTick((n) => n + 1)
    }, ROTATE_MS)
    return () => clearInterval(t)
  }, [focused, items.length, onIndexChange])

  // manual moves also restart the segment fill
  useEffect(() => {
    setTick((n) => n + 1)
  }, [index])

  if (items.length === 0) return null
  const active = items[Math.min(index, items.length - 1)]

  return (
    <section
      aria-label="Trending for you"
      className="relative h-[62vh] w-full shrink-0 overflow-hidden"
    >
      {/* image stack: active image cross-fades in over the previous one */}
      {items.map((item, i) => (
        <div
          key={item.id}
          aria-hidden={i !== index}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-out',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image || '/placeholder.svg'}
            alt=""
            className={cn('h-full w-full object-cover object-top', i === index && 'ken-burns')}
            crossOrigin="anonymous"
          />
        </div>
      ))}

      {/* scrims for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

      {/* copy block */}
      <div key={active.id} className="hero-copy-in absolute bottom-14 left-14 max-w-xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
            {active.serviceLabel}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {active.reason}
          </span>
        </div>
        <h2 className="text-balance font-sans text-5xl font-semibold leading-tight text-foreground">
          {active.title}
        </h2>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          {active.rating ? (
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {active.rating.toFixed(1)}
            </span>
          ) : null}
          {active.genres.length > 0 ? <span>{active.genres.slice(0, 3).join(' · ')}</span> : null}
        </div>
        {active.summary ? (
          <p className="mt-3 line-clamp-2 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
            {active.summary}
          </p>
        ) : null}
      </div>

      {/* focus affordance: hairline frame when the banner row is focused */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-3 rounded-2xl border transition-all duration-300',
          focused ? 'border-foreground/80' : 'border-transparent',
        )}
      />

      {/* thin segment indicators */}
      <div className="absolute bottom-6 left-14 flex items-center gap-1.5">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="h-0.5 w-10 overflow-hidden rounded-full bg-foreground/15"
          >
            {i === index ? (
              <div
                key={tick}
                className={cn('segment-fill h-full w-full bg-foreground/85', focused && '[animation-play-state:paused]')}
                style={{ ['--segment-ms' as string]: `${ROTATE_MS}ms` }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
