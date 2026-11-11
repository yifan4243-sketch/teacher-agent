import { Button, useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { CalendarEventEditor } from './calendar-event-editor'
import { calendarDays, calendarRange, EVENT_STATUS, type CalendarEvent, type CalendarResult } from './timetable-api'

interface Props { route: PluginProfileRoute }

export function Timetable({ route }: Props) {
  const [anchor, setAnchor] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()))
  const [view, setView] = useState('week')
  const [courseId, setCourseId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const range = calendarRange(anchor, view)
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const calendar = useQuery({ queryKey: [...routeKey(route), 'calendar', range, courseId], queryFn: () => call<CalendarResult>(route, 'calendar.list', { ...range, course_id: courseId || null }), enabled: !!range })
  const events = calendar.data?.items ?? []
  const selected = events.find(event => event.id === selectedId)
  const days = range ? calendarDays(range.start_date, range.end_date, view === 'month') : []
  const byDate = new Map<string, CalendarEvent[]>()
  for (const event of events) { const key = event.starts_at.slice(0, 10); const items = byDate.get(key) ?? []; items.push(event); byDate.set(key, items) }
  function moved(event: CalendarEvent) { setAnchor(event.starts_at.slice(0, 10)); setSelectedId(event.id) }
  const totals = calendar.data?.progress
  return <section aria-label="实际课表与教学进度" className="space-y-4">
    <h2 className="text-xl font-semibold">课表与教学进度</h2>
    <p>仅显示教师已发布的实际课表，时间为北京时间。一次大课合并显示，课间包含在该课次内。</p>
    <div className="flex flex-wrap gap-3">
      <label>课表日期<input aria-label="课表日期" type="date" value={anchor} onChange={event => { setAnchor(event.target.value); setSelectedId('') }} /></label>
      <label>课表视图<select aria-label="课表视图" value={view} onChange={event => setView(event.target.value)}><option value="day">日课表</option><option value="week">周课表</option><option value="month">月历</option></select></label>
      <label>课表课程<select aria-label="课表课程" value={courseId} onChange={event => { setCourseId(event.target.value); setSelectedId('') }}><option value="">全部课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    </div>
    {totals && <p role="status">本范围{totals.total_sessions}课次 · 已完成{totals.completed_sessions} · 已取消{totals.cancelled_sessions} · 逾期未登记{totals.overdue_sessions} · 实际教学{totals.actual_instruction_minutes}分钟 · 已完成课次教学偏差{totals.instruction_variance_minutes}分钟</p>}
    {calendar.isPending && range && <p role="status">正在读取已发布课表</p>}
    {calendar.data && <div aria-label="课程日历" className="grid gap-2" style={{ gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, minmax(0, 1fr))' }}>
      {view !== 'day' && ['一', '二', '三', '四', '五', '六', '日'].map(day => <p key={day}>星期{day}</p>)}
      {days.map((day, index) => day ? <article key={day} aria-label={`课表日期 ${day}`} className="min-h-24 space-y-2 rounded border border-(--ui-border) p-2">
        <Button variant="ghost" onClick={() => { setAnchor(day); setView('day') }}>{day.slice(5)}</Button>
        {byDate.get(day)?.map(event => <Button key={event.id} variant="secondary" className="h-auto w-full whitespace-normal text-left" onClick={() => setSelectedId(event.id)}>
          <span>{event.starts_at.slice(11, 16)}–{event.ends_at.slice(11, 16)}<br />{event.course_title} · 第{event.ordinal}次课<br />{event.title}<br />{EVENT_STATUS[event.status]}</span>
        </Button>)}
      </article> : <div key={`pad-${index}`} aria-hidden="true" />)}
    </div>}
    {calendar.data && events.length === 0 && <p>该范围没有已发布课次，可先在教学计划中核对并发布。</p>}
    {selected && <CalendarEventEditor key={`${selected.id}:${selected.version}:${selected.active_publication_id}`} route={route} event={selected} onMoved={moved} />}
    {[courses.error, calendar.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
