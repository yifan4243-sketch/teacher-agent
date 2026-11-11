import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import type { ExamGeneration, ExamPaper, ExamPlan, ExamSummary } from './exam-api'
import { ExamAssembly } from './exam-assembly'
import { ExamPaperDetails } from './exam-paper-details'
import { ExamPlanEditor } from './exam-plan-editor'
import { openGeneration } from './preparation-api'
import { QUESTION_KINDS, QUESTION_STATUS } from './question-api'
import type { Page, Textbook } from './textbook-api'

export function ExamsWorkspace({ route }: { route: PluginProfileRoute }) {
  const [courseId, setCourseId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  return <section aria-label="考试命题工作台" className="space-y-4">
    <h2 className="text-xl font-semibold">考试命题</h2>
    <label>命题课程<select aria-label="命题课程" value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    {courseId && <CourseExams key={courseId} route={route} courseId={courseId} />}
    {courses.error && <p role="alert">{courses.error.message}</p>}
  </section>
}

function CourseExams({ route, courseId }: { route: PluginProfileRoute; courseId: string }) {
  const queryClient = useQueryClient()
  const [versionId, setVersionId] = useState('')
  const [planId, setPlanId] = useState('')
  const [paperId, setPaperId] = useState('')
  const [planOffset, setPlanOffset] = useState(0)
  const [paperOffset, setPaperOffset] = useState(0)
  const [editing, setEditing] = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [revisePaper, setRevisePaper] = useState(false)
  const books = useQuery({ queryKey: [...routeKey(route), 'textbooks', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }) })
  const plans = useQuery({ queryKey: [...routeKey(route), 'exam-plans', courseId, planOffset], queryFn: () => call<Page<ExamPlan>>(route, 'exam.plan.list', { course_id: courseId, offset: planOffset, limit: 20 }) })
  const plan = useQuery({ queryKey: [...routeKey(route), 'exam-plan', planId], queryFn: () => call<ExamPlan>(route, 'exam.plan.get', { id: planId }), enabled: !!planId })
  const papers = useQuery({ queryKey: [...routeKey(route), 'exam-papers', courseId, paperOffset], queryFn: () => call<Page<ExamSummary>>(route, 'exam.paper.list', { course_id: courseId, offset: paperOffset, limit: 20 }) })
  const paper = useQuery({ queryKey: [...routeKey(route), 'exam-paper', paperId], queryFn: () => call<ExamPaper>(route, 'exam.paper.get', { id: paperId }), enabled: !!paperId })
  async function savedPlan(value: ExamPlan) { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); setPlanId(value.id); setEditing(false); setAssembling(false) }
  async function savedPaper(value: ExamPaper) { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); setPaperId(value.id); setPlanId(value.plan_id); setAssembling(false); setRevisePaper(false) }
  return <div className="space-y-4">
    <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: routeKey(route) })}>刷新命题记录</Button>
    <label>命题教材版本<select aria-label="命题教材版本" value={versionId} onChange={event => { setVersionId(event.target.value); setPlanId(''); setEditing(false); setAssembling(false) }}><option value="">选择教材版本</option>{books.data?.items.flatMap(book => book.versions.map(version => <option key={version.id} value={version.id}>{book.title} · v{version.version}</option>))}</select></label>
    <Button disabled={!versionId} onClick={() => { setPlanId(''); setEditing(true); setAssembling(false) }}>新建命题方案</Button>
    <label>命题方案版本<select aria-label="命题方案版本" value={planId} onChange={event => { setPlanId(event.target.value); setEditing(false); setAssembling(false) }}><option value="">选择命题方案</option>{plan.data && !plans.data?.items.some(item => item.id === planId) && <option value={planId}>{plan.data.title} · v{plan.data.version}</option>}{plans.data?.items.map(item => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}</select></label>
    <div className="flex gap-2"><Button variant="secondary" disabled={planOffset === 0} onClick={() => setPlanOffset(value => Math.max(0, value - 20))}>上一组命题方案</Button><Button variant="secondary" disabled={plans.data?.next_offset == null} onClick={() => setPlanOffset(plans.data?.next_offset ?? 0)}>下一组命题方案</Button></div>
    {editing && (plan.data || !planId) && <ExamPlanEditor key={planId || versionId} route={route} courseId={courseId} versionId={plan.data?.textbook_version_id ?? versionId} plan={plan.data} onSaved={savedPlan} />}
    {plan.data && !editing && <section className="space-y-3" aria-label="命题方案详情">
      <p>{plan.data.title} · v{plan.data.version} · {plan.data.scope.textbook_title} v{plan.data.scope.textbook_version}</p>
      <p>{plan.data.config.question_types.map(item => `${QUESTION_KINDS[item.kind]}${item.count}题`).join(' · ')} · 满分{(plan.data.config.total_points_centi / 100).toFixed(2)}分 · {plan.data.config.duration_minutes}分钟</p>
      <p>{plan.data.scope.source_ids.length}条教材依据 · {plan.data.scope.knowledge_points.length}个知识点 · 最低覆盖{plan.data.config.coverage_percent}%</p>
      <p>学生学习水平 {plan.data.config.student_level}</p>
      {plan.data.config.completed_only && <p>命题时已授范围快照 · {plan.data.scope.progress_events.length}个课次</p>}
      {plan.data.latest_version === plan.data.version && <Button variant="secondary" onClick={() => setEditing(true)}>修订命题方案</Button>}
      <Button variant="secondary" onClick={() => { setAssembling(true); setRevisePaper(false) }}>从题库组卷</Button>
      <ExamAgent key={plan.data.id} route={route} plan={plan.data} onPaper={setPaperId} />
    </section>}
    {assembling && plan.data && <ExamAssembly key={`${planId}:${revisePaper ? paperId : 'new'}`} route={route} plan={plan.data} paper={revisePaper ? paper.data : undefined} onSaved={savedPaper} />}
    <h3>已保存试卷版本</h3>
    {papers.data?.items.map(item => <Button key={item.id} variant="ghost" onClick={() => { setPaperId(item.id); setAssembling(false) }}>{item.title} · v{item.version} · {QUESTION_STATUS[item.status]}</Button>)}
    <div className="flex gap-2"><Button variant="secondary" disabled={paperOffset === 0} onClick={() => setPaperOffset(value => Math.max(0, value - 20))}>上一组试卷</Button><Button variant="secondary" disabled={papers.data?.next_offset == null} onClick={() => setPaperOffset(papers.data?.next_offset ?? 0)}>下一组试卷</Button></div>
    {paper.data && <ExamPaperDetails key={paperId} route={route} paper={paper.data} onRevise={() => { setPlanId(paper.data.plan_id); setRevisePaper(true); setAssembling(true); setEditing(false) }} />}
    {[books.error, plans.error, plan.error, papers.error, paper.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}

function ExamAgent({ route, plan, onPaper }: { route: PluginProfileRoute; plan: ExamPlan; onPaper: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [authorized, setAuthorized] = useState(false)
  const generations = useQuery({ queryKey: [...routeKey(route), 'exam-generations', plan.id], queryFn: () => call<{ items: ExamGeneration[] }>(route, 'exam.generation.list', { id: plan.id }), refetchInterval: query => query.state.data?.items.some(item => ['pending', 'running'].includes(item.task.status)) ? 3000 : false })
  const generationState = generations.data?.items.map(item => `${item.workflow_id}:${item.task.version}`).join('|') ?? ''
  useEffect(() => { void queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'exam-papers', plan.course_id] }) }, [generationState, plan.course_id, queryClient, route])
  const begin = useMutation({ mutationFn: async () => {
    const generation = await call<ExamGeneration>(route, 'exam.generation.begin', { id: plan.id, allow_model_call: authorized }, crypto.randomUUID())
    await queryClient.invalidateQueries({ queryKey: routeKey(route) })
    await openGeneration(route, generation, 'exam.generation.claim')
  }, onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const resume = useMutation({ mutationFn: (generation: ExamGeneration) => openGeneration(route, generation, 'exam.generation.claim'), onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const cancel = useMutation({ mutationFn: (generation: ExamGeneration) => call(route, 'task.cancel', { id: generation.workflow_id, version: generation.task.version }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  return <div className="space-y-3">
    <label className="flex gap-2"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} />允许本次Hermes Agent命题，可能产生模型费用</label>
    <Button disabled={!authorized || begin.isPending} onClick={() => begin.mutate()}>启动Agent命题</Button>
    {generations.data?.items.map(generation => <div key={generation.workflow_id} className="flex gap-2"><span>命题任务 · {generation.task.status}</span><Button variant="secondary" disabled={resume.isPending || generation.task.status === 'cancelled'} onClick={() => resume.mutate(generation)}>打开命题会话</Button>{generation.paper_id && <Button variant="secondary" onClick={() => onPaper(generation.paper_id!)}>查看生成试卷</Button>}{['pending', 'running', 'awaiting_review', 'failed'].includes(generation.task.status) && <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(generation)}>取消试卷保存任务</Button>}</div>)}
    <p>如需停止正在执行的模型请求，请在原生命题会话中使用停止按钮。</p>
    {[generations.error, begin.error, resume.error, cancel.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}
