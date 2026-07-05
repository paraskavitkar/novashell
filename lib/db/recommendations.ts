import { listApps, type AppRow } from './apps'
import { usageStats, feedbackStats } from './usage'

export type Recommendation = {
  app: AppRow
  score: number
  reason: string
}

/**
 * Learning recommendation engine.
 *
 * score = frequency (recency-decayed) + time-of-day affinity + day-of-week affinity
 *         - rejection penalty (learned from "don't suggest" feedback, decays over ~2 weeks per dismissal)
 *
 * All signals come from real in-shell usage tracked in SQLite. Nothing hardcoded.
 */
export function getRecommendations(now: { hour: number; dow: number; ts: number }, limit = 3): Recommendation[] {
  const apps = listApps().filter((a) => a.category !== 'system')
  const usage = new Map(usageStats().map((u) => [u.app_id, u]))
  const feedback = new Map(feedbackStats().map((f) => [f.app_id, f]))

  const DAY = 86400

  const scored: Recommendation[] = apps.map((app) => {
    const u = usage.get(app.id)
    const f = feedback.get(app.id)

    let score = 0
    let reason = 'New in your library'

    if (u) {
      // Frequency with recency decay (half-life ~7 days)
      const age = Math.max(0, now.ts - u.last_ts)
      const recency = Math.pow(0.5, age / (7 * DAY))
      const freq = Math.min(1, u.launches / 20)
      score += freq * 2 + recency * 1.5

      // Time-of-day affinity: circular distance between now.hour and historical launch hours
      const hours: number[] = JSON.parse(u.hours)
      const dows: number[] = JSON.parse(u.dows)
      const hourAffinity =
        hours.reduce((acc, h) => {
          const d = Math.min(Math.abs(h - now.hour), 24 - Math.abs(h - now.hour))
          return acc + Math.max(0, 1 - d / 4) // within ±4h window
        }, 0) / hours.length
      const dowAffinity = dows.filter((d) => d === now.dow).length / dows.length
      score += hourAffinity * 2 + dowAffinity * 1

      if (hourAffinity > 0.5) {
        reason = `You usually open ${app.name} around this time`
      } else if (dowAffinity > 0.4) {
        reason = `Part of your ${DOW[now.dow]} routine`
      } else if (recency > 0.7) {
        reason = 'Jump back in'
      } else {
        reason = `You've opened this ${u.launches} time${u.launches === 1 ? '' : 's'}`
      }
    } else {
      // Small exploration bonus for pinned but never-opened items
      score += app.pinned ? 0.4 : 0.15
    }

    if (f) {
      // Each dismissal applies a penalty that decays with a 14-day half-life from the
      // most recent dismissal. Repeated dismissals compound — the engine learns "no".
      const dismissAge = Math.max(0, now.ts - f.last_dismissed_ts)
      const decay = Math.pow(0.5, dismissAge / (14 * DAY))
      score -= f.dismissed * 1.5 * decay
      // Accepting a suggestion reinforces it
      score += Math.min(1, f.opened * 0.3)
    }

    return { app, score, reason }
  })

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
