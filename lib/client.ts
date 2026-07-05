'use client'

import useSWR, { mutate as globalMutate } from 'swr'

/** Client-side mirror of the DB row (see lib/db/apps.ts) */
export interface ShellApp {
  id: string
  name: string
  category: 'games' | 'media' | 'apps' | 'system'
  source: string
  launch_target: string
  image: string
  icon: string
  accent: string
  description: string
  pinned: number
  sort_order: number
  hidden: number
}

export interface Recommendation {
  app: ShellApp
  score: number
  reason: string
}

export interface YouTubeVideo {
  id: string
  title: string
  channel: string
  channelId: string
  thumbnail: string
  published: string
}

export interface YouTubeRow {
  channel: string
  channelId: string
  videos: YouTubeVideo[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useLibrary() {
  const { data, error, isLoading } = useSWR<ShellApp[]>('/api/library', fetcher)
  return { apps: data ?? [], error, isLoading }
}

export function useRecommendations() {
  const now = new Date()
  const key = `/api/recommendations?hour=${now.getHours()}&dow=${now.getDay()}`
  const { data, isLoading } = useSWR<Recommendation[]>(key, fetcher, {
    refreshInterval: 5 * 60_000,
  })
  return { recommendations: data ?? [], isLoading, key }
}

export function useYouTubeFeed() {
  const { data, isLoading, error } = useSWR<{ rows: YouTubeRow[] }>('/api/youtube', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  })
  return { rows: data?.rows ?? [], isLoading, error }
}

/* ---------- mutations ---------- */

export async function recordUsage(appId: string, action: 'launch' | 'focus' = 'launch') {
  const now = new Date()
  await fetch('/api/usage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: appId, action, hour: now.getHours(), dow: now.getDay() }),
  })
}

export async function sendSuggestionFeedback(appId: string, verdict: 'dismissed' | 'opened') {
  await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: appId, verdict }),
  })
  await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/recommendations'))
}

/** Input for create/update — accepts booleans; the server normalizes to 0/1. */
export type AppInput = Partial<Omit<ShellApp, 'pinned' | 'hidden'>> & {
  pinned?: boolean
  hidden?: boolean
}

export async function createApp(input: AppInput) {
  const res = await fetch('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  await globalMutate('/api/library')
  return res.json()
}

export async function updateApp(id: string, patch: AppInput) {
  const res = await fetch(`/api/library/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  await globalMutate('/api/library')
  return res.json()
}

export async function deleteApp(id: string) {
  const res = await fetch(`/api/library/${id}`, { method: 'DELETE' })
  await globalMutate('/api/library')
  return res.json()
}
