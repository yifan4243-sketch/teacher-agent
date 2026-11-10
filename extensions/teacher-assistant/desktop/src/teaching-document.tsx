import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { downloadDocument, type PlanContent, type ScriptContent, type Segment, type TeachingDocument } from './preparation-api'

const PLAN_FIELDS = [
  ['title', '教案课题'], ['objectives', '教学目标'], ['key_points', '教学重点'], ['difficulties', '教学难点'],
  ['preparation', '课前准备'], ['summary', '课堂总结'], ['values_education', '课程思政'], ['homework', '作业布置'],
  ['blackboard', '板书设计'], ['teaching_week', '预授课周'], ['lesson_numbers', '课程课时序号'],
] as const

interface Props {
  route: PluginProfileRoute
  documentId: string
  onVersion: (id: string) => void
}

export function DocumentEditor({ route, documentId, onVersion }: Props) {
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const document = useQuery({ queryKey: [...routeKey(route), 'document', documentId], queryFn: () => call<TeachingDocument>(route, 'document.get', { id: documentId }) })
  const write = useMutation({
    mutationFn: ({ operation, data }: { operation: string; data: object }) => call<TeachingDocument>(route, operation, data, crypto.randomUUID()),
    onSuccess: async saved => { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); onVersion(saved.id) },
  })
  const download = useMutation({ mutationFn: () => downloadDocument(route, documentId) })
  const saved = document.data
  function reviseSegment(event: FormEvent<HTMLFormElement>, segment: Segment, unitIndex: number, segmentIndex: number) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    write.mutate({ operation: 'document.revise_segment', data: { id: documentId, unit_index: unitIndex, segment_index: segmentIndex, segment: {
      ...segment, title: String(form.get('title')), spoken_text: String(form.get('spoken_text')),
      teacher_actions: String(form.get('teacher_actions')).split('\n').filter(line => line.trim()),
      student_activity: String(form.get('student_activity')), blackboard: String(form.get('blackboard')),
      activity_minutes: Number(form.get('activity_minutes')),
    } } })
  }
  function revisePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saved) return
    const content = structuredClone(saved.content as PlanContent)
    const form = new FormData(event.currentTarget)
    for (const [key] of PLAN_FIELDS) content[key] = String(form.get(key))
    content.session_number = Number(form.get('session_number'))
    content.total_lessons = String(form.get('total_lessons')) ? Number(form.get('total_lessons')) : null
    content.activities = content.activities.map((activity, index) => ({ ...activity, teacher_activity: String(form.get(`teacher-${index}`)), student_activity: String(form.get(`student-${index}`)), methods: String(form.get(`methods-${index}`)) }))
    write.mutate({ operation: 'document.save', data: { lesson_id: saved.lesson_id, kind: saved.kind, expected_version: saved.version, script_id: saved.script_id, content } })
  }
  return <article className="space-y-5" aria-label="教学文档正文与审核">
    {saved && <>
      <h3 className="text-lg font-semibold">{saved.content.title} · v{saved.version} · {saved.status === 'approved' ? '教师已审核' : saved.status === 'rejected' ? '已退回' : '待审核草稿'}</h3>
      {saved.timing && <div aria-label="授课时间估算"><p>两单元估算用时 {saved.timing.estimated_units_minutes.join(' / ')} 分钟</p><p>{saved.timing.method}</p>{saved.timing.warnings.map(warning => <p role="alert" key={warning}>{warning}</p>)}</div>}
      {saved.kind === 'script' ? <>
        {(saved.content as ScriptContent).units.map((unit, unitIndex) => <section key={unitIndex} className="space-y-4">
          {unitIndex === 1 && <h4 className="font-semibold">课间休息10分钟，不计入80分钟教学</h4>}
          <h4 className="font-semibold">第{unitIndex + 1}单元 {unit.title} · 40分钟</h4>
          {unit.segments.map((segment, segmentIndex) => <details key={segmentIndex} className="rounded border border-(--ui-border) p-3"><summary>{segment.title} · {segment.minutes}分钟</summary>
            <form className="mt-3 grid gap-3" onSubmit={event => reviseSegment(event, segment, unitIndex, segmentIndex)}>
              <label>环节标题<input aria-label={`环节标题 ${unitIndex}-${segmentIndex}`} name="title" defaultValue={segment.title} required /></label>
              <label>可朗读正文<textarea aria-label={`可朗读正文 ${unitIndex}-${segmentIndex}`} name="spoken_text" defaultValue={segment.spoken_text} className="min-h-72 w-full rounded border border-(--ui-border) p-3" required minLength={200} /></label>
              <label>教师动作<textarea name="teacher_actions" aria-label={`教师动作 ${unitIndex}-${segmentIndex}`} defaultValue={segment.teacher_actions.join('\n')} className="w-full rounded border border-(--ui-border) p-2" /></label>
              <label>学生活动<textarea name="student_activity" aria-label={`学生活动 ${unitIndex}-${segmentIndex}`} defaultValue={segment.student_activity} className="w-full rounded border border-(--ui-border) p-2" /></label>
              <label>独立活动分钟<input aria-label={`独立活动分钟 ${unitIndex}-${segmentIndex}`} name="activity_minutes" type="number" min={0} max={segment.minutes - 0.1} step="0.1" defaultValue={segment.activity_minutes} /></label>
              <label>板书<textarea name="blackboard" aria-label={`板书 ${unitIndex}-${segmentIndex}`} defaultValue={segment.blackboard} className="w-full rounded border border-(--ui-border) p-2" /></label>
              <p className="text-sm">教材来源ID {segment.source_ids.join('、')}</p>
              <Button type="submit" disabled={write.isPending}>保存此环节为新版本</Button>
            </form>
          </details>)}
        </section>)}
        <h4 className="font-semibold">课后作业</h4><ol>{(saved.content as ScriptContent).homework.map((item, index) => <li key={index}>{item}</li>)}</ol>
      </> : <form onSubmit={revisePlan} className="grid gap-4">
        {PLAN_FIELDS.map(([key, label]) => <label key={key}>{label}<textarea aria-label={`教案${label}`} name={key} defaultValue={(saved.content as PlanContent)[key]} className="min-h-20 w-full rounded border border-(--ui-border) p-2" /></label>)}
        <label>第几次课<input aria-label="第几次课" name="session_number" type="number" min={1} required defaultValue={(saved.content as PlanContent).session_number} /></label>
        <label>课程总课时<input aria-label="课程总课时" name="total_lessons" type="number" min={1} defaultValue={(saved.content as PlanContent).total_lessons ?? ''} /></label>
        {(saved.content as PlanContent).activities.map((activity, index) => <fieldset key={index} className="space-y-2 rounded border border-(--ui-border) p-3"><legend>第{activity.unit_index + 1}单元第{activity.segment_index + 1}环节</legend>
          <label className="block">教师活动<textarea aria-label={`教案教师活动 ${index}`} name={`teacher-${index}`} defaultValue={activity.teacher_activity} className="w-full" required minLength={20} /></label>
          <label className="block">学生活动<textarea aria-label={`教案学生活动 ${index}`} name={`student-${index}`} defaultValue={activity.student_activity} className="w-full" required /></label>
          <label className="block">教学方法<input aria-label={`教案教学方法 ${index}`} name={`methods-${index}`} defaultValue={activity.methods} required /></label>
        </fieldset>)}
        <p>关联授课稿 {saved.script_id} · 教学反思由教师课后据实填写。</p>
        <Button type="submit" disabled={write.isPending}>保存教案修订版</Button>
      </form>}
      {saved.status === 'draft' && <div className="space-y-3 rounded border border-(--ui-border) p-4">
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我已核对完整正文、教材依据和时间分配</label>
        <Button disabled={!confirmed || write.isPending || !!saved.timing?.warnings.length} onClick={() => write.mutate({ operation: 'document.review', data: { id: documentId, decision: 'approved' } })}>审核通过此版本</Button>
        <Button variant="secondary" disabled={write.isPending} onClick={() => write.mutate({ operation: 'document.review', data: { id: documentId, decision: 'rejected' } })}>退回此版本</Button>
      </div>}
      {saved.status === 'approved' && <Button disabled={download.isPending} onClick={() => download.mutate()}>下载正式DOCX</Button>}
    </>}
    {[document.error, write.error, download.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </article>
}
