import type { PluginProfileRoute } from '@hermes/plugin-sdk'
import { call } from './api'

export interface CalendarEvent {
  id: string; active_publication_id: string | null; version: number; ordinal: number; course_id: string; course_title: string
  title: string; kind: string; starts_at: string; ends_at: string; status: 'scheduled' | 'completed' | 'cancelled'
  actual_minutes: number | null; instruction_minutes: number; assessment_minutes: number; lesson_id: string | null; note: string; textbook_version_id: string
  periods: { kind: string; start: string; end: string }[]
}
export interface Progress {
  total_sessions: number; completed_sessions: number; cancelled_sessions: number; overdue_sessions: number
  actual_instruction_minutes: number; completed_planned_instruction_minutes: number; instruction_variance_minutes: number
  actual_assessment_minutes: number; remaining_instruction_minutes: number; as_of: string
}
export interface Publication { id: string; active: number; plan_id: string; events: CalendarEvent[]; progress: Progress }
export interface PublicationLink { id: string; plan_id: string }
export interface CalendarResult { items: CalendarEvent[]; progress: Progress }
export const EVENT_STATUS = { scheduled: '待授课', completed: '已完成', cancelled: '已取消' }
export const PERIOD_KIND: Record<string, string> = { teaching: '教学', break: '休息', assessment: '考核' }

export function calendarRange(anchor: string, view: string) {
  if (!anchor) return null
  const start = new Date(`${anchor}T12:00:00Z`)
  const end = new Date(start)
  if (view === 'week') { start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6) }
  if (view === 'month') { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0) }
  return { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) }
}

export function calendarDays(start: string, end: string, pad: boolean) {
  const current = new Date(`${start}T12:00:00Z`)
  const result: (string | null)[] = pad ? Array.from({ length: (current.getUTCDay() + 6) % 7 }, () => null) : []
  while (current.toISOString().slice(0, 10) <= end) { result.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1) }
  return result
}

export function publishPlan(route: PluginProfileRoute, id: string, replaces: string | null, note: string) {
  return call<Publication>(route, 'plan.publish', { id, replaces_publication_id: replaces, review_note: note }, crypto.randomUUID())
}
