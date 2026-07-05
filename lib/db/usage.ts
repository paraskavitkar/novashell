import { getDb } from './index'

export function recordUsage(input: {
  app_id: string
  action?: string
  hour: number
  dow: number
  session_seconds?: number
}) {
  getDb()
    .prepare(
      `INSERT INTO usage_events (app_id, action, hour, dow, session_seconds)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.app_id, input.action ?? 'launch', input.hour, input.dow, input.session_seconds ?? 0)
}

export function recordFeedback(input: { app_id: string; verdict: 'dismissed' | 'opened' }) {
  getDb()
    .prepare('INSERT INTO suggestion_feedback (app_id, verdict) VALUES (?, ?)')
    .run(input.app_id, input.verdict)
}

export type UsageStat = {
  app_id: string
  launches: number
  last_ts: number
  hours: string // JSON array of hours
  dows: string
}

export function usageStats(): UsageStat[] {
  return getDb()
    .prepare(
      `SELECT app_id,
              COUNT(*) AS launches,
              MAX(ts) AS last_ts,
              json_group_array(hour) AS hours,
              json_group_array(dow) AS dows
       FROM usage_events
       WHERE action = 'launch'
       GROUP BY app_id`
    )
    .all() as UsageStat[]
}

export type FeedbackStat = { app_id: string; dismissed: number; opened: number; last_dismissed_ts: number }

export function feedbackStats(): FeedbackStat[] {
  return getDb()
    .prepare(
      `SELECT app_id,
              SUM(CASE WHEN verdict = 'dismissed' THEN 1 ELSE 0 END) AS dismissed,
              SUM(CASE WHEN verdict = 'opened' THEN 1 ELSE 0 END) AS opened,
              MAX(CASE WHEN verdict = 'dismissed' THEN ts ELSE 0 END) AS last_dismissed_ts
       FROM suggestion_feedback
       GROUP BY app_id`
    )
    .all() as FeedbackStat[]
}

export function recentActivity(limit = 20) {
  return getDb()
    .prepare(
      `SELECT u.app_id, u.action, u.ts, u.hour, u.dow, a.name
       FROM usage_events u JOIN apps a ON a.id = u.app_id
       ORDER BY u.ts DESC LIMIT ?`
    )
    .all(limit)
}
