'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createApp,
  deleteApp,
  updateApp,
  useLibrary,
  type ShellApp,
} from '@/lib/client'
import { useShellInput } from './gamepad-context'
import { TileIcon } from './tile-icon'
import { ButtonHints } from './button-hints'
import { Pin, Plus, Trash2 } from 'lucide-react'

const CATEGORIES = ['games', 'media', 'apps'] as const
const SOURCES = ['steam', 'epic', 'exe', 'browser', 'custom'] as const
const ACCENTS = ['#22d3ee', '#4ade80', '#fb923c', '#ef4444', '#38bdf8', '#f59e0b', '#e2e8f0'] as const
const ICON_CHOICES = ['gamepad-2', 'play', 'tv', 'music', 'globe', 'clapperboard', 'app-window', 'library', 'file-code-2'] as const

type FieldKey = 'name' | 'category' | 'source' | 'launch_target' | 'description' | 'accent' | 'icon' | 'pinned'

interface Field {
  key: FieldKey
  label: string
  kind: 'text' | 'cycle' | 'toggle'
  options?: readonly string[]
}

const FIELDS: Field[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'category', label: 'Category', kind: 'cycle', options: CATEGORIES },
  { key: 'source', label: 'Source', kind: 'cycle', options: SOURCES },
  { key: 'launch_target', label: 'Launch target', kind: 'text' },
  { key: 'description', label: 'Description', kind: 'text' },
  { key: 'icon', label: 'Icon', kind: 'cycle', options: ICON_CHOICES },
  { key: 'accent', label: 'Accent color', kind: 'cycle', options: ACCENTS },
  { key: 'pinned', label: 'Pinned', kind: 'toggle' },
]

type Draft = Record<FieldKey, string | boolean>

function draftFrom(app: ShellApp | null): Draft {
  return {
    name: app?.name ?? '',
    category: app?.category ?? 'games',
    source: app?.source ?? 'steam',
    launch_target: app?.launch_target ?? '',
    description: app?.description ?? '',
    accent: app?.accent ?? ACCENTS[0],
    icon: app?.icon ?? 'gamepad-2',
    pinned: !!app?.pinned,
  }
}

export function LibraryManager({
  active,
  onBack,
  requestText,
}: {
  active: boolean
  onBack: () => void
  requestText: (label: string, initial: string, onCommit: (v: string) => void) => void
}) {
  const { apps } = useLibrary()
  const editable = useMemo(() => apps.filter((a) => a.source !== 'builtin'), [apps])

  const [listIndex, setListIndex] = useState(0)
  const [pane, setPane] = useState<'list' | 'form'>('list')
  const [fieldIndex, setFieldIndex] = useState(0)
  const [editing, setEditing] = useState<ShellApp | null>(null) // null + form pane = creating
  const [draft, setDraft] = useState<Draft>(draftFrom(null))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const safeIndex = Math.min(listIndex, Math.max(0, editable.length - 1))
  const selected = editable[safeIndex]
  const listRef = useRef<HTMLDivElement>(null)

  // keep the focused row visible as the selection moves
  useEffect(() => {
    if (pane !== 'list') return
    const el = listRef.current?.children[safeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [safeIndex, pane])

  function openForm(app: ShellApp | null) {
    setEditing(app)
    setDraft(draftFrom(app))
    setFieldIndex(0)
    setPane('form')
  }

  function cycleField(field: Field, dir: 1 | -1) {
    if (field.kind === 'toggle') {
      setDraft((d) => ({ ...d, [field.key]: !d[field.key] }))
      return
    }
    const opts = field.options!
    setDraft((d) => {
      const cur = opts.indexOf(String(d[field.key]))
      const next = (cur + dir + opts.length) % opts.length
      return { ...d, [field.key]: opts[next] }
    })
  }

  async function save() {
    if (!String(draft.name).trim() || saving) return
    setSaving(true)
    const payload = {
      name: String(draft.name).trim(),
      category: String(draft.category) as ShellApp['category'],
      source: String(draft.source),
      launch_target: String(draft.launch_target),
      description: String(draft.description),
      accent: String(draft.accent),
      icon: String(draft.icon),
      pinned: !!draft.pinned,
    }
    if (editing) await updateApp(editing.id, payload)
    else await createApp(payload)
    setSaving(false)
    setPane('list')
  }

  useShellInput(
    (action) => {
      if (confirmDelete) {
        if (action === 'accept') {
          if (selected) deleteApp(selected.id)
          setConfirmDelete(false)
          return true
        }
        if (action === 'back') {
          setConfirmDelete(false)
          return true
        }
        return true
      }

      if (pane === 'form') {
        const field = FIELDS[fieldIndex]
        switch (action) {
          case 'up':
            setFieldIndex((i) => Math.max(0, i - 1))
            return true
          case 'down':
            setFieldIndex((i) => Math.min(FIELDS.length - 1, i + 1))
            return true
          case 'left':
            if (field.kind !== 'text') cycleField(field, -1)
            return true
          case 'right':
            if (field.kind !== 'text') cycleField(field, 1)
            return true
          case 'accept':
            if (field.kind === 'text') {
              requestText(field.label, String(draft[field.key]), (v) =>
                setDraft((d) => ({ ...d, [field.key]: v })),
              )
            } else {
              cycleField(field, 1)
            }
            return true
          case 'start':
            save()
            return true
          case 'back':
            setPane('list')
            return true
          default:
            return false
        }
      }

      // list pane
      switch (action) {
        case 'up':
          setListIndex((i) => Math.max(0, i - 1))
          return true
        case 'down':
          setListIndex((i) => Math.min(editable.length - 1, i + 1))
          return true
        case 'accept':
          if (selected) openForm(selected)
          return true
        case 'y':
          openForm(null)
          return true
        case 'x':
          if (selected) setConfirmDelete(true)
          return true
        case 'back':
          onBack()
          return true
        default:
          return false
      }
    },
    20,
    active,
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="px-10 pb-2 pt-6 md:px-14">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-primary">System</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Manage Library</h1>
        <p className="mt-1.5 text-muted-foreground">
          Add, edit, and remove the games and apps on your home screen.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 gap-6 px-10 pb-6 pt-4 md:px-14">
        {/* app list */}
        <div ref={listRef} className="no-scrollbar flex w-full max-w-md flex-col gap-1.5 overflow-y-auto">
          {editable.map((app, i) => {
            const isFocused = pane === 'list' && i === safeIndex
            return (
              <button
                key={app.id}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setListIndex(i)
                  openForm(app)
                }}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
                  isFocused ? 'tile-glow bg-card' : 'bg-card/40 opacity-70 hover:opacity-100'
                }`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'color-mix(in oklab, ' + app.accent + ' 25%, oklch(0.17 0.015 260))' }}
                >
                  <TileIcon name={app.icon} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{app.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {app.category} · {app.source}
                  </span>
                </span>
                {app.pinned ? <Pin className="size-4 shrink-0 text-primary" aria-label="Pinned" /> : null}
              </button>
            )
          })}
          {editable.length === 0 ? (
            <p className="p-4 text-muted-foreground">No custom apps yet. Press Y to add one.</p>
          ) : null}
        </div>

        {/* form pane */}
        <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-card/50 p-6">
          {pane === 'form' ? (
            <>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                {editing ? `Edit ${editing.name}` : (
                  <>
                    <Plus className="size-5 text-primary" aria-hidden="true" /> Add new app
                  </>
                )}
              </h2>
              <div className="flex flex-col gap-1.5">
                {FIELDS.map((f, i) => {
                  const isFocused = i === fieldIndex
                  const value = draft[f.key]
                  return (
                    <div
                      key={f.key}
                      className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 transition-all ${
                        isFocused ? 'tile-glow bg-secondary' : 'bg-transparent'
                      }`}
                    >
                      <span className="text-sm font-medium text-muted-foreground">{f.label}</span>
                      <span className="flex min-w-0 items-center gap-2 font-semibold">
                        {f.key === 'accent' ? (
                          <span
                            className="size-4 rounded-full"
                            style={{ backgroundColor: String(value) }}
                            aria-hidden="true"
                          />
                        ) : null}
                        {f.key === 'icon' ? <TileIcon name={String(value)} className="size-4" /> : null}
                        <span className="truncate">
                          {f.kind === 'toggle' ? (value ? 'Yes' : 'No') : String(value) || '—'}
                        </span>
                        {f.kind !== 'text' ? (
                          <span className="text-xs text-muted-foreground">◂ ▸</span>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-auto pt-4 text-sm text-muted-foreground">
                {saving ? 'Saving…' : 'Press Start / S to save · B to cancel'}
              </p>
            </>
          ) : selected ? (
            <>
              <h2 className="mb-1 text-lg font-bold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.description || 'No description'}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{selected.category}</dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium">{selected.source}</dd>
                <dt className="text-muted-foreground">Launch target</dt>
                <dd className="truncate font-mono text-xs">{selected.launch_target || '—'}</dd>
              </dl>
              <p className="mt-auto pt-4 text-sm text-muted-foreground">
                A to edit · X to delete · Y to add new
              </p>
            </>
          ) : (
            <p className="m-auto text-muted-foreground">Press Y to add your first app.</p>
          )}
        </div>
      </div>

      {/* delete confirm */}
      {confirmDelete && selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label={`Delete ${selected.name}?`}
        >
          <div className="tile-glow flex flex-col items-center gap-4 rounded-xl bg-card p-8">
            <Trash2 className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-lg font-bold">{`Remove "${selected.name}" from your library?`}</p>
            <p className="text-sm text-muted-foreground">A to confirm · B to cancel</p>
          </div>
        </div>
      ) : null}

      <ButtonHints
        hints={
          pane === 'form'
            ? [
                { glyph: 'A', label: 'Edit field', color: 'oklch(0.75 0.17 145)' },
                { glyph: 'B', label: 'Cancel', color: 'oklch(0.65 0.2 25)' },
                { glyph: '≡', label: 'Save' },
              ]
            : [
                { glyph: 'A', label: 'Edit', color: 'oklch(0.75 0.17 145)' },
                { glyph: 'B', label: 'Home', color: 'oklch(0.65 0.2 25)' },
                { glyph: 'X', label: 'Delete', color: 'oklch(0.65 0.15 250)' },
                { glyph: 'Y', label: 'Add app', color: 'oklch(0.8 0.16 85)' },
              ]
        }
      />
    </div>
  )
}
