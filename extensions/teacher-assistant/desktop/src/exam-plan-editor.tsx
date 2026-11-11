import { Button, useMutation, useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { ExamConfig, ExamPlan } from './exam-api'
import { DIFFICULTIES, QUESTION_KINDS, scoreCenti } from './question-api'
import type { BookVersion, KnowledgePoint, Page } from './textbook-api'

interface Props { route: PluginProfileRoute; courseId: string; versionId: string; plan?: ExamPlan; onSaved: (plan: ExamPlan) => void }

export function ExamPlanEditor({ route, courseId, versionId, plan, onSaved }: Props) {
  const [pointIds, setPointIds] = useState(plan?.config.knowledge_point_ids ?? [])
  const [offset, setOffset] = useState(0)
  const book = useQuery({ queryKey: [...routeKey(route), 'book-version', versionId], queryFn: () => call<BookVersion>(route, 'textbook.version', { id: versionId }) })
  const knowledge = useQuery({ queryKey: [...routeKey(route), 'exam-knowledge', versionId, offset], queryFn: () => call<Page<KnowledgePoint>>(route, 'knowledge.list', { version_id: versionId, offset, limit: 50 }) })
  const write = useMutation({ mutationFn: (data: object) => call<ExamPlan>(route, 'exam.plan.save', data, crypto.randomUUID()), onSuccess: onSaved })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const config: ExamConfig = {
      chapter_ids: form.getAll('chapter').map(String), knowledge_point_ids: pointIds, completed_only: form.has('completed_only'),
      question_types: Object.keys(QUESTION_KINDS).map(kind => ({ kind: kind as keyof typeof QUESTION_KINDS, count: Number(form.get(kind)) })).filter(item => item.count > 0),
      difficulties: Object.keys(DIFFICULTIES).map(difficulty => ({ difficulty, count: Number(form.get(difficulty)) })).filter(item => item.count > 0),
      total_points_centi: scoreCenti(String(form.get('points'))), duration_minutes: Number(form.get('duration')),
      coverage_percent: Number(form.get('coverage')), student_level: String(form.get('level')),
    }
    write.mutate({ course_id: courseId, textbook_version_id: versionId, title: String(form.get('title')), config, root_id: plan?.root_id ?? null, expected_version: plan?.version ?? 0 })
  }
  return <section aria-label="命题方案编辑" className="space-y-3 rounded border border-(--ui-border) p-4">
    <form onSubmit={save} className="space-y-4">
      <label>试卷名称<input name="title" aria-label="试卷名称" required maxLength={200} defaultValue={plan?.title ?? ''} /></label>
      <fieldset><legend>章节范围（留空使用全教材）</legend>{book.data?.chapters.map(chapter => <label className="mr-4 inline-flex gap-2" key={chapter.id}><input type="checkbox" name="chapter" value={chapter.id} defaultChecked={plan?.config.chapter_ids.includes(chapter.id)} />{chapter.title}</label>)}</fieldset>
      <label className="flex gap-2"><input type="checkbox" name="completed_only" defaultChecked={plan?.config.completed_only} />仅使用已登记授课进度的范围</label>
      <fieldset><legend>知识点范围（留空使用命题范围内全部知识点）</legend>
        <p>已选{pointIds.length}个知识点</p>
        {knowledge.data?.items.map(point => <label className="mr-4 inline-flex gap-2" key={point.id}><input type="checkbox" checked={pointIds.includes(point.id)} onChange={event => setPointIds(values => event.target.checked ? [...values, point.id] : values.filter(id => id !== point.id))} />{point.title}</label>)}
        <div className="flex gap-2"><Button type="button" variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>上一页知识点</Button><Button type="button" variant="secondary" disabled={knowledge.data?.next_offset == null} onClick={() => setOffset(knowledge.data?.next_offset ?? 0)}>下一页知识点</Button><Button type="button" variant="ghost" disabled={!pointIds.length} onClick={() => setPointIds([])}>清空知识点选择</Button></div>
      </fieldset>
      <fieldset className="flex flex-wrap gap-3"><legend>题型数量</legend>{Object.entries(QUESTION_KINDS).map(([kind, label]) => <label key={kind}>{label}数量<input aria-label={`${label}数量`} type="number" name={kind} min={0} max={200} required defaultValue={plan?.config.question_types.find(item => item.kind === kind)?.count ?? 0} /></label>)}</fieldset>
      <fieldset className="flex flex-wrap gap-3"><legend>难度数量（全部为0时由命题选择）</legend>{Object.entries(DIFFICULTIES).map(([difficulty, label]) => <label key={difficulty}>{label}题数<input aria-label={`${label}题数`} type="number" name={difficulty} min={0} max={200} required defaultValue={plan?.config.difficulties.find(item => item.difficulty === difficulty)?.count ?? 0} /></label>)}</fieldset>
      <div className="flex flex-wrap gap-3">
        <label>试卷总分<input aria-label="试卷总分" name="points" type="number" min="0.01" step="0.01" max="10000" required defaultValue={(plan?.config.total_points_centi ?? 10000) / 100} /></label>
        <label>考试时长（分钟）<input aria-label="考试时长" name="duration" type="number" min={1} max={360} required defaultValue={plan?.config.duration_minutes ?? 90} /></label>
        <label>最低知识点覆盖率（%）<input aria-label="最低知识点覆盖率" name="coverage" type="number" min={0} max={100} required defaultValue={plan?.config.coverage_percent ?? 0} /></label>
      </div>
      <label className="block">学生学习水平<textarea aria-label="学生学习水平" name="level" required maxLength={1000} defaultValue={plan?.config.student_level ?? ''} /></label>
      <Button type="submit" disabled={write.isPending || book.isPending}>保存命题方案</Button>
    </form>
    {[book.error, knowledge.error, write.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
