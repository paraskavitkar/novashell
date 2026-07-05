'use client'

import {
  Folder,
  Globe,
  Image as ImageIcon,
  MessageCircle,
  Monitor,
  Music,
  Play,
  Settings,
  ShoppingBag,
} from 'lucide-react'

const ICONS = {
  play: Play,
  music: Music,
  globe: Globe,
  image: ImageIcon,
  message: MessageCircle,
  monitor: Monitor,
  settings: Settings,
  bag: ShoppingBag,
  folder: Folder,
} as const

export function TileIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Monitor
  return <Icon className={className} aria-hidden="true" />
}
