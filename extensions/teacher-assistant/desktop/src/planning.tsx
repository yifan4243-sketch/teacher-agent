import { Button, captureGatewayFileDownload, host, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import type { BookVersion, Textbook } from './textbook-api'
import { PlanPublication } from './plan-publication'
import type { PublicationLink } from './timetable-api'

interface Slot { weekday: number; start_time: string }
interface ChapterWeight { chapter_id: string; difficulty: number }
interface Config {
  title: string; start_date: string; end_date: string; weekly_slots: Slot[]; excluded_dates: string[]; chapters: ChapterWeight[]
  practice_sessions: number; review_sessions: number; exam_sessions: number; exam_minutes: number
}
interface Session {
  id: string; ordinal: number; title: string; kind: string; starts_at: string; ends_at: string; instruction_minutes: number; assessment_minutes: number
  periods: { kind: string; start: string; end: string }[]
}
interface Plan {
  id: string; title: string; version: number; textbook_version_id: string; config: Config; sessions: Session[]
  latest_version: number; publication: PublicationLink | null
  weeks: Record<string, string[]>; months: Record<string, string[]>
  totals: { sessions: number; instruction_minutes: number; assessment_minutes: number; calendar_minutes: number }
}
interface Summary { id: string; title: string; version: number; textbook_version_id: string }
interface PlanningProps { route: PluginProfileRoute }
interface PlanFormProps extends PlanningProps { courseId: string; book: BookVersion; plan?: Plan; onSaved: (plan: Plan) => void }
interface PlanResultsProps extends PlanningProps { plan: Plan }
const KINDS: Record<string, string> = { teaching: '教学', practice: '练习', review: '复习', exam: '考核', assessment: '考核', break: '休息' }

function PlanForm({ route, courseId, book, plan, onSaved }: PlanFormProps) {
  const config = plan?.config
  const [slots, setSlots] = useState<Slot[]>(config?.weekly_slots ?? [{ weekday: 0, start_time: '' }])
  const save = useMutation({ mutationFn: (data: object) => call<Plan>(route, 'plan.save', data, crypto.randomUUID()), onSuccess: onSaved })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({ course_id: courseId, textbook_version_id: book.id, title: String(form.get('title')), start_date: form.get('start_date'), end_date: form.get('end_date'),
      weekly_slots: slots, excluded_dates: String(form.get('excluded_dates')).split(/[\s,，]+/).filter(Boolean),
      chapters: book.chapters.filter(chapter => form.has(`chapter-${chapter.id}`)).map(chapter => ({ chapter_id: chapter.id, difficulty: Number(form.get(`weight-${chapter.id}`)) })),
      practice_sessions: Number(form.get('practice_sessions')), review_sessions: Number(form.get('review_sessions')), exam_sessions: Number(form.get('exam_sessions')),
      exam_minutes: Number(form.get('exam_minutes')), parent_id: plan?.id ?? null })
  }
  return <form onSubmit={submit} className="grid max-w-4xl gap-3">
    <label>学期计划名称<input name="title" aria-label="学期计划名称" defaultValue={config?.title} maxLength={200} required /></label>
    <label>学期开始日期<input type="date" name="start_date" aria-label="学期开始日期" defaultValue={config?.start_date} required /></label>
    <label>学期结束日期<input type="date" name="end_date" aria-label="学期结束日期" defaultValue={config?.end_date} required /></label>
    <fieldset className="grid gap-2"><legend>每周授课时段 · 北京时间</legend>{slots.map((slot, index) => <div className="flex flex-wrap gap-2" key={index}>
      <label>星期<select aria-label={`授课星期 ${index + 1}`} value={slot.weekday} onChange={event => setSlots(slots.map((item, i) => i === index ? { ...item, weekday: Number(event.target.value) } : item))}>{['一', '二', '三', '四', '五', '六', '日'].map((day, i) => <option value={i} key={i}>星期{day}</option>)}</select></label>
      <label>开始时间<input type="time" aria-label={`授课开始时间 ${index + 1}`} value={slot.start_time} onChange={event => setSlots(slots.map((item, i) => i === index ? { ...item, start_time: event.target.value } : item))} required /></label>
      <Button type="button" variant="secondary" disabled={slots.length === 1} onClick={() => setSlots(slots.filter((_, i) => i !== index))}>移除此授课时段</Button>
    </div>)}<Button type="button" variant="secondary" disabled={slots.length >= 30} onClick={() => setSlots([...slots, { weekday: 0, start_time: '' }])}>增加每周授课时段</Button></fieldset>
    <label>停课日期（每行一个YYYY-MM-DD）<textarea name="excluded_dates" aria-label="停课日期" defaultValue={config?.excluded_dates.join('\n')} /></label>
    <fieldset className="grid gap-2"><legend>章节与难度权重 · 请勿同时选父章节和子章节</legend>{book.chapters.map(chapter => <div className="flex flex-wrap gap-2" key={chapter.id}>
      <label><input type="checkbox" name={`chapter-${chapter.id}`} defaultChecked={config?.chapters.length ? config.chapters.some(item => item.chapter_id === chapter.id) : !chapter.parent_id} />{chapter.title}</label>
      <label>难度<input type="number" aria-label={`章节难度 ${chapter.title}`} name={`weight-${chapter.id}`} min="1" max="10" defaultValue={config?.chapters.find(item => item.chapter_id === chapter.id)?.difficulty ?? 1} required /></label>
    </div>)}</fieldset>
    {([['practice_sessions', '综合练习课次'], ['review_sessions', '复习课次'], ['exam_sessions', '考核课次']] as const).map(([field, label]) => <label key={field}>{label}<input type="number" name={field} aria-label={label} min="0" max={field === 'exam_sessions' ? 20 : 100} defaultValue={config?.[field] ?? 0} required /></label>)}
    <label>每次考核时长（分钟）<input type="number" name="exam_minutes" aria-label="每次考核时长（分钟）" min="1" max="480" defaultValue={config?.exam_minutes ?? 90} required /></label>
    <Button type="submit" disabled={save.isPending}>{plan ? '重新计算并保存新版本' : '计算并保存学期计划'}</Button>
    {save.error && <p role="alert">{save.error.message}</p>}
  </form>
}

function PlanResults({ route, plan }: PlanResultsProps) {
  const [group, setGroup] = useState('all')
  const [format, setFormat] = useState('docx')
  const download = useMutation({ mutationFn: async () => {
    const save = captureGatewayFileDownload()
    const release = await host.retainProfile(route, { spawnPriority: 'foreground' })
    try {
      const scope = group === 'all' ? 'semester' : group.startsWith('month:') ? 'month' : 'week'
      const key = scope === 'semester' ? null : group.slice(scope === 'month' ? 6 : 5)
      const exported = await call<{ id: string }>(route, 'plan.export', { id: plan.id, format, scope, key }, crypto.randomUUID())
      const file = await call<{ stored_path: string; filename: string }>(route, 'plan.export.file', { id: exported.id })
      await save(file.stored_path, file.filename)
    } finally { release() }
  } })
  const allowed = group === 'all' ? null : (group.startsWith('month:') ? plan.months[group.slice(6)] : plan.weeks[group.slice(5)])
  return <section aria-label="学期计划计算结果" className="space-y-3">
    <h3>{plan.title} · v{plan.version}</h3>
    <p role="status">课次{plan.totals.sessions} · 实际教学{plan.totals.instruction_minutes}分钟 · 日历占用{plan.totals.calendar_minutes}分钟 · 考核{plan.totals.assessment_minutes}分钟</p>
    <label>计划范围<select aria-label="计划范围" value={group} onChange={event => setGroup(event.target.value)}><option value="all">全学期</option>{Object.keys(plan.months).map(month => <option key={month} value={`month:${month}`}>月度 {month}</option>)}{Object.keys(plan.weeks).map(week => <option key={week} value={`week:${week}`}>每周 {week}</option>)}</select></label>
    <p>按当前所选范围导出计划版本，实际调课和授课进度以课表为准。</p>
    <label>计划导出格式<select aria-label="计划导出格式" value={format} onChange={event => setFormat(event.target.value)}><option value="docx">DOCX</option><option value="xlsx">XLSX</option><option value="pdf">PDF</option></select></label>
    <Button disabled={download.isPending} onClick={() => download.mutate()}>导出所选范围计划</Button>
    {download.error && <p role="alert">{download.error.message}</p>}
    <table><thead><tr><th>课次</th><th>开始/结束</th><th>内容</th><th>教学与休息</th></tr></thead><tbody>{plan.sessions.filter(session => !allowed || allowed.includes(session.id)).map(session => <tr key={session.id}>
      <td>{session.ordinal}</td><td>{session.starts_at.replace('T', ' ')}<br />{session.ends_at.replace('T', ' ')}</td><td>{KINDS[session.kind]} · {session.title}</td>
      <td>{session.periods.map((part, index) => <p key={index}>{KINDS[part.kind]} {part.start.slice(11, 16)}–{part.end.slice(11, 16)}</p>)}</td>
    </tr>)}</tbody></table>
  </section>
}

export function Planning({ route }: PlanningProps) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [bookId, setBookId] = useState('')
  const [planId, setPlanId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const books = useQuery({ queryKey: [...routeKey(route), 'books', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }), enabled: !!courseId })
  const plans = useQuery({ queryKey: [...routeKey(route), 'semester-plans', courseId], queryFn: () => call<{ items: Summary[] }>(route, 'plan.list', { course_id: courseId }), enabled: !!courseId })
  const plan = useQuery({ queryKey: [...routeKey(route), 'semester-plan', planId], queryFn: () => call<Plan>(route, 'plan.get', { id: planId }), enabled: !!planId })
  const book = useQuery({ queryKey: [...routeKey(route), 'book-version', bookId], queryFn: () => call<BookVersion>(route, 'textbook.version', { id: bookId }), enabled: !!bookId })
  function selectPlan(id: string) { setPlanId(id); if (id) setBookId(plans.data?.items.find(item => item.id === id)?.textbook_version_id ?? '') }
  async function saved(updated: Plan) { await queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'semester-plans'] }); setPlanId(updated.id) }
  return <section aria-label="教学计划" className="space-y-4">
    <h2 className="text-xl font-semibold">学期、月度与每周教学计划</h2>
    <p>依据实际日期与停课安排计算，课程教学和课间分开计时。重新计算保留旧版本，核对发布后进入实际课表。</p>
    <label>计划所属课程<select aria-label="计划所属课程" value={courseId} onChange={event => { setCourseId(event.target.value); setBookId(''); setPlanId('') }}><option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    <label>计划版本<select aria-label="计划版本" value={planId} onChange={event => selectPlan(event.target.value)}><option value="">建立新计划</option>{plans.data?.items.map(item => <option value={item.id} key={item.id}>{item.title} · v{item.version}</option>)}</select></label>
    <label>计划教材版本<select aria-label="计划教材版本" value={bookId} onChange={event => setBookId(event.target.value)}><option value="">选择教材版本</option>{books.data?.items.flatMap(book => book.versions.map(version => <option key={version.id} value={version.id}>{book.title} · v{version.version}</option>))}</select></label>
    {planId && plan.isPending && <p role="status">正在读取计划版本</p>}
    {book.data && (!planId || plan.data) && <PlanForm key={`${planId}:${bookId}`} route={route} courseId={courseId} book={book.data} plan={plan.data} onSaved={saved} />}
    {plan.data && <PlanResults key={`results:${planId}`} route={route} plan={plan.data} />}
    {plan.data && <PlanPublication key={`publication:${planId}`} route={route} planId={planId} latest={plan.data.version === plan.data.latest_version} current={plan.data.publication} />}
    {[courses.error, books.error, plans.error, plan.error, book.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
