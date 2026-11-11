import { Button, useMutation, useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey } from './api'
import type { ExamPaper, ExamPlan } from './exam-api'
import { DIFFICULTIES, QUESTION_KINDS, QUESTION_STATUS, type Question, type QuestionSummary } from './question-api'
import type { Page } from './textbook-api'

interface Props { route: PluginProfileRoute; plan: ExamPlan; paper?: ExamPaper; onSaved: (paper: ExamPaper) => void }

export function ExamAssembly({ route, plan, paper, onSaved }: Props) {
  const [selected, setSelected] = useState<Question[]>(paper?.questions ?? [])
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('approved')
  const [title, setTitle] = useState(paper?.title ?? plan.title)
  const bank = useQuery({ queryKey: [...routeKey(route), 'exam-bank', plan.id, search, status, offset], queryFn: () => call<Page<QuestionSummary>>(route, 'question.list', { course_id: plan.course_id, textbook_version_id: plan.textbook_version_id, search, status: status || null, limit: 20, offset }) })
  const add = useMutation({ mutationFn: (id: string) => call<Question>(route, 'question.get', { id }), onSuccess: question => setSelected(values => values.some(item => item.id === question.id) ? values : [...values, question]) })
  const write = useMutation({ mutationFn: () => call<ExamPaper>(route, 'exam.paper.save', { plan_id: plan.id, title, question_ids: selected.map(question => question.id), root_id: paper?.root_id ?? null, expected_version: paper?.version ?? 0 }, crypto.randomUUID()), onSuccess: onSaved })
  function move(index: number, delta: number) {
    setSelected(values => {
      const reordered = [...values]
      ;[reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]]
      return reordered
    })
  }
  return <section aria-label="题库组卷" className="space-y-3 rounded border border-(--ui-border) p-4">
    <h3>选择题库版本组卷</h3>
    <label>组卷名称<input aria-label="组卷名称" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <p>已选{selected.length}题 · 合计{(selected.reduce((total, question) => total + question.points_centi, 0) / 100).toFixed(2)}分</p>
    <ol>{selected.map((question, index) => <li key={question.id} className="my-2 space-x-2">{index + 1} · {question.prompt} · v{question.version}<Button variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>上移</Button><Button variant="ghost" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>下移</Button><Button variant="ghost" onClick={() => setSelected(values => values.filter(item => item.id !== question.id))}>移除</Button></li>)}</ol>
    <label>组卷题干查询<input aria-label="组卷题干查询" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setOffset(0) }} /></label>
    <label>组卷题目审核筛选<select aria-label="组卷题目审核筛选" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="approved">最近已通过版本</option><option value="">最新题目版本</option><option value="draft">最近草稿版本</option></select></label>
    {bank.data?.items.map(question => <article key={question.id} className="flex items-center gap-3"><p className="flex-1">{question.prompt} · {QUESTION_KINDS[question.kind]} · {DIFFICULTIES[question.difficulty]} · {(question.points_centi / 100).toFixed(2)}分 · v{question.version} · {QUESTION_STATUS[question.status]}</p><Button variant="secondary" disabled={add.isPending || selected.some(item => item.root_id === question.root_id) || question.status === 'rejected'} onClick={() => add.mutate(question.id)}>加入试卷</Button></article>)}
    {bank.data?.total === 0 && <p>当前教材题库没有匹配题目。</p>}
    <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页组卷题目</Button><Button variant="secondary" disabled={bank.data?.next_offset == null} onClick={() => setOffset(bank.data?.next_offset ?? 0)}>下一页组卷题目</Button></div>
    <Button disabled={write.isPending || !selected.length || !title.trim()} onClick={() => write.mutate()}>保存试卷版本</Button>
    {[bank.error, add.error, write.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
