'use client'

import {
  AppWindow,
  Clapperboard,
  FileCode2,
  Folder,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Library,
  LogOut,
  MessageCircle,
  Monitor,
  MousePointer2,
  Music,
  Play,
  Settings,
  Settings2,
  ShoppingBag,
  Tv,
} from 'lucide-react'

const ICONS = {
  'app-window': AppWindow,
  clapperboard: Clapperboard,
  'file-code-2': FileCode2,
  folder: Folder,
  'gamepad-2': Gamepad2,
  globe: Globe,
  image: ImageIcon,
  library: Library,
  'log-out': LogOut,
  message: MessageCircle,
  monitor: Monitor,
  'mouse-pointer-2': MousePointer2,
  music: Music,
  play: Play,
  settings: Settings,
  'settings-2': Settings2,
  bag: ShoppingBag,
  tv: Tv,
} as const

export function TileIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Monitor
  return <Icon className={className} aria-hidden="true" />
}
