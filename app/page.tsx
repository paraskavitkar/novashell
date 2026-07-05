import { GamepadProvider } from '@/components/shell/gamepad-context'
import { Shell } from '@/components/shell/shell'

export default function Home() {
  return (
    <main className="h-dvh">
      <GamepadProvider>
        <Shell />
      </GamepadProvider>
    </main>
  )
}
