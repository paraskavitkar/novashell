'use client'

export function Glyph({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="flex size-6 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold"
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      {label}
    </span>
  )
}

export interface Hint {
  glyph: string
  label: string
  color?: string
}

export function ButtonHints({ hints }: { hints: Hint[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-8 py-4 text-sm text-muted-foreground">
      {hints.map((h) => (
        <span key={h.glyph + h.label} className="flex items-center gap-2">
          <Glyph label={h.glyph} color={h.color} />
          {h.label}
        </span>
      ))}
    </div>
  )
}
