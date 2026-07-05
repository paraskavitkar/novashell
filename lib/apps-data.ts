export interface TileItem {
  id: string
  title: string
  subtitle: string
  kind: 'game' | 'media' | 'system'
  image?: string
  icon?: string // lucide icon name key
  tint?: string // css color for icon tiles
  action?: 'windows' | 'quick' | 'launch'
}

export interface TileRowData {
  id: string
  label: string
  items: TileItem[]
}

export const ROWS: TileRowData[] = [
  {
    id: 'recent',
    label: 'Recently Played',
    items: [
      {
        id: 'neon-drift',
        title: 'Neon Drift',
        subtitle: 'Steam · 34 hrs played',
        kind: 'game',
        image: '/games/neon-drift.png',
        action: 'launch',
      },
      {
        id: 'starfall',
        title: 'Starfall Odyssey',
        subtitle: 'Epic Games · 12 hrs played',
        kind: 'game',
        image: '/games/starfall.png',
        action: 'launch',
      },
      {
        id: 'emberkeep',
        title: 'Emberkeep',
        subtitle: 'Steam · 58 hrs played',
        kind: 'game',
        image: '/games/emberkeep.png',
        action: 'launch',
      },
      {
        id: 'skybound',
        title: 'Skybound',
        subtitle: 'Xbox App · 6 hrs played',
        kind: 'game',
        image: '/games/skybound.png',
        action: 'launch',
      },
      {
        id: 'vanguard',
        title: 'Vanguard Protocol',
        subtitle: 'Steam · 21 hrs played',
        kind: 'game',
        image: '/games/vanguard.png',
        action: 'launch',
      },
      {
        id: 'apex-league',
        title: 'Apex League 26',
        subtitle: 'EA App · 44 hrs played',
        kind: 'game',
        image: '/games/apex-league.png',
        action: 'launch',
      },
    ],
  },
  {
    id: 'media',
    label: 'Apps & Media',
    items: [
      {
        id: 'youtube',
        title: 'YouTube',
        subtitle: 'Watch videos in TV mode',
        kind: 'media',
        icon: 'play',
        tint: 'oklch(0.55 0.2 25)',
        action: 'launch',
      },
      {
        id: 'music',
        title: 'Music',
        subtitle: 'Your library and playlists',
        kind: 'media',
        icon: 'music',
        tint: 'oklch(0.6 0.15 150)',
        action: 'launch',
      },
      {
        id: 'browser',
        title: 'Browser',
        subtitle: 'Browse with virtual mouse',
        kind: 'media',
        icon: 'globe',
        tint: 'oklch(0.55 0.13 240)',
        action: 'windows',
      },
      {
        id: 'photos',
        title: 'Photos',
        subtitle: 'Screenshots and captures',
        kind: 'media',
        icon: 'image',
        tint: 'oklch(0.6 0.12 300)',
        action: 'launch',
      },
      {
        id: 'discord',
        title: 'Discord',
        subtitle: 'Voice and chat',
        kind: 'media',
        icon: 'message',
        tint: 'oklch(0.5 0.12 270)',
        action: 'launch',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'desktop',
        title: 'Desktop Mode',
        subtitle: 'Virtual mouse + keyboard',
        kind: 'system',
        icon: 'monitor',
        tint: 'oklch(0.4 0.02 260)',
        action: 'windows',
      },
      {
        id: 'quick-settings',
        title: 'Quick Settings',
        subtitle: 'Volume, display, power',
        kind: 'system',
        icon: 'settings',
        tint: 'oklch(0.4 0.02 260)',
        action: 'quick',
      },
      {
        id: 'store',
        title: 'Store',
        subtitle: 'Browse and install',
        kind: 'system',
        icon: 'bag',
        tint: 'oklch(0.4 0.02 260)',
        action: 'launch',
      },
      {
        id: 'files',
        title: 'Files',
        subtitle: 'File explorer',
        kind: 'system',
        icon: 'folder',
        tint: 'oklch(0.4 0.02 260)',
        action: 'launch',
      },
    ],
  },
]
