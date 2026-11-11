import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { Lesson } from './preparation-api'
import { EVENT_STATUS, PERIOD_KIND, type CalendarEvent } from './timetable-api'

interface Props { route: PluginProfileRoute; event: CalendarEvent; onMoved: (event: CalendarEvent) => void }
interface History { items: { sequence: number; action: string; actor: string; created_at: string; before: CalendarEvent; after: CalendarEvent }[] }

export function CalendarEventEditor({ route, event, onMoved }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(event.status)
  const [showHistory, setShowHistory] = useState(false)
  const lessons = useQuery({ queryKey: [...routeKey(route), 'lessons', event.course_id], queryFn: () => call<{ items: Lesson[] }>(route, 'lesson.list', { course_id: event.course_id }) })
  const history = useQuery({ queryKey: [...routeKey(route), 'calendar-history', event.id, event.version], queryFn: () => call<History>(route, 'calendar.history', { id: event.id }), enabled: showHistory })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  const move = useMutation({ mutationFn: (data: object) => call<CalendarEvent>(route, 'calendar.move', { ...data, id: event.id, version: event.version, publication_id: event.active_publication_id }, crypto.randomUUID()), onSuccess: async updated => { onMoved(updated); await invalidate() } })
  const progress = useMutation({ mutationFn: (data: object) => call<CalendarEvent>(route, 'calendar.progress', { ...data, id: event.id, version: event.version, publication_id: event.active_publication_id }, crypto.randomUUID()), onSuccess: invalidate })
  function reschedule(submit: FormEvent<HTMLFormElement>) { submit.preventDefault(); const form = new FormData(submit.currentTarget); move.mutate({ starts_at: form.get('starts_at'), note: form.get('note') }) }
  function record(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault()
    const form = new FormData(submit.currentTarget)
    progress.mutate({ status, actual_minutes: status === 'completed' ? Number(form.get('actual_minutes')) : null,
      lesson_id: String(form.get('lesson_id')) || null, note: form.get('note') })
  }
  const minutes = event.kind === 'exam' ? event.assessment_minutes : event.instruction_minutes
  return <section aria-label="课次调课与进度" className="space-y-3 rounded border border-(--ui-border) p-4">
    <h3>{event.course_title} · 第{event.ordinal}次课 · {event.title}</h3>
    <p>{event.starts_at.replace('T', ' ')}–{event.ends_at.slice(11)} · {EVENT_STATUS[event.status]}</p>
    <p>{event.periods.map(part => `${PERIOD_KIND[part.kind]} ${part.start.slice(11, 16)}–${part.end.slice(11, 16)}`).join(' · ')}</p>
    {event.status === 'scheduled' && <form onSubmit={reschedule} className="grid max-w-3xl gap-2">
      <label>调课开始时间<input name="starts_at" aria-label="调课开始时间" type="datetime-local" defaultValue={event.starts_at.slice(0, 16)} required /></label>
      <label>调课原因<input name="note" aria-label="调课原因" maxLength={4000} required /></label>
      <Button type="submit" disabled={move.isPending}>保存调课</Button>
    </form>}
    <form onSubmit={record} className="grid max-w-3xl gap-2">
      <label>授课进度状态<select aria-label="授课进度状态" value={status} onChange={change => setStatus(change.target.value as CalendarEvent['status'])}>{Object.entries(EVENT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {status === 'completed' && <label>{event.kind === 'exam' ? '实际考核分钟' : '实际教学分钟'}<input name="actual_minutes" aria-label="实际完成分钟" type="number" min="0" max={minutes} defaultValue={event.actual_minutes ?? minutes} required /></label>}
      <label>关联备课课次<select name="lesson_id" aria-label="关联备课课次" defaultValue={event.lesson_id ?? ''}><option value="">暂不关联</option>{lessons.data?.items.filter(lesson => lesson.version_id === event.textbook_version_id).map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
      <label>授课进度说明<input name="note" aria-label="授课进度说明" maxLength={4000} required /></label>
      <Button type="submit" disabled={progress.isPending}>保存授课进度</Button>
    </form>
    <Button variant="secondary" onClick={() => setShowHistory(value => !value)}>{showHistory ? '收起课次修改记录' : '查看课次修改记录'}</Button>
    {showHistory && history.data?.items.map(item => <article key={item.sequence}><p>{item.created_at} · {item.actor.startsWith('desktop:') ? '教师操作' : 'Agent操作'} · {item.action === 'reschedule' ? '调课' : '进度记录'}</p>
      <p>修改前 {item.before.starts_at.replace('T', ' ')} · {EVENT_STATUS[item.before.status]} · 实际{item.before.actual_minutes ?? '未登记'}分钟</p>
      <p>修改后 {item.after.starts_at.replace('T', ' ')} · {EVENT_STATUS[item.after.status]} · 实际{item.after.actual_minutes ?? '未登记'}分钟</p>
      <p>说明：{item.after.note}</p>
    </article>)}
    {showHistory && history.data?.items.length === 0 && <p>此课次尚无调课或进度修改记录。</p>}
    {[lessons.error, history.error, move.error, progress.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
