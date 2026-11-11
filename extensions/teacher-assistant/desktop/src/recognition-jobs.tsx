import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { ExamPaper } from './exam-api'
import type { Submission } from './grading-api'
import type { AnswerFile, RecognitionCosts, RecognitionJob, RecognitionProposal } from './recognition-api'
import { RecognitionReview } from './recognition-review'
import type { Page } from './textbook-api'

interface Props { route: PluginProfileRoute; file: AnswerFile; paper: ExamPaper; onSaved: (value: Submission) => void }

const STATES = { queued: '已排队', running: '执行中', succeeded: '成功', failed: '失败', cancelled: '已取消' }

export function RecognitionJobs({ route, file, paper, onSaved }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [proposal, setProposal] = useState<RecognitionProposal | null>(null)
  const [acknowledgeCost, setAcknowledgeCost] = useState(false)
  const [pageError, setPageError] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'recognition'] })
  const jobs = useQuery({ queryKey: [...routeKey(route), 'recognition', 'jobs', file.id, offset], queryFn: () => call<Page<RecognitionJob>>(route, 'recognition.list', { id: file.id, offset, limit: 20 }), refetchInterval: 3000 })
  const costs = useQuery({ queryKey: [...routeKey(route), 'recognition', 'budget', file.id], queryFn: () => call<RecognitionCosts>(route, 'recognition.budget', { id: file.id }), refetchInterval: 3000 })
  const budget = useMutation({ mutationFn: (value: number) => call(route, 'recognition.set_budget', { id: file.id, budget_micro_usd: value }, crypto.randomUUID()), onSuccess: refresh })
  const reserve = useMutation({
    mutationFn: (data: object) => call<{ items: RecognitionJob[] }>(route, 'recognition.reserve', { id: file.id, ...data }, crypto.randomUUID()),
    onSuccess: async result => { setSelected(result.items.map(job => job.id)); setProposal(null); setOffset(0); await refresh() },
  })
  const run = useMutation({ mutationFn: async () => {
    for (const id of selected) {
      const result = await call<RecognitionJob>(route, 'recognition.run', { id }, id)
      await refresh()
      if (result.state === 'failed') throw new Error(`第${result.page_number}页识别失败 · ${result.error_code}`)
    }
  }, onSettled: refresh })
  const cancel = useMutation({ mutationFn: (id: string) => call(route, 'recognition.cancel', { id, acknowledge_possible_cost: acknowledgeCost }, crypto.randomUUID()), onSuccess: refresh })
  const compose = useMutation({ mutationFn: () => call<RecognitionProposal>(route, 'recognition.compose', { id: file.id, job_ids: selected }), onSuccess: setProposal })
  function setBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    budget.mutate(Math.round(Number(new FormData(event.currentTarget).get('budget')) * 1_000_000))
  }
  function queue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const first = Number(data.get('first'))
    const last = Number(data.get('last'))
    if (last < first) { setPageError('识别结束页不能小于起始页'); return }
    setPageError('')
    reserve.mutate({ pages: Array.from({ length: last - first + 1 }, (_, index) => first + index), estimated_micro_usd: Math.round(Number(data.get('estimate')) * 1_000_000), allow_model_call: data.has('authorize'), force_regenerate: data.has('regenerate') })
  }
  function toggle(id: string) { setSelected(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]); setProposal(null) }
  return <section aria-label="答卷识别任务" className="space-y-4">
    {costs.data && <><p>预算 ${(costs.data.budget_micro_usd / 1e6).toFixed(6)} · 预留 ${(costs.data.reserved_micro_usd / 1e6).toFixed(6)} · 已记录 ${(costs.data.spent_micro_usd / 1e6).toFixed(6)}</p><p>{costs.data.cost_basis}</p></>}
    <form onSubmit={setBudget} className="flex flex-wrap gap-2"><label>识别预算（美元）<input name="budget" aria-label="识别预算（美元）" type="number" min="0" max="1000000" step="0.000001" required /></label><Button type="submit" disabled={budget.isPending}>保存识别预算</Button></form>
    <form onSubmit={queue} className="grid gap-2">
      <label>识别起始页<input name="first" aria-label="识别起始页" type="number" min={1} max={file.page_count} defaultValue={1} required /></label>
      <label>识别结束页<input name="last" aria-label="识别结束页" type="number" min={1} max={file.page_count} defaultValue={file.page_count} required /></label>
      <label>每页估算（美元）<input name="estimate" aria-label="每页估算（美元）" type="number" min="0.000001" max="1000" step="0.000001" required /></label>
      <label><input name="authorize" type="checkbox" required />允许将所选学生答卷页面发送给已配置的批改视觉模型，并接受估算费用</label>
      <label><input name="regenerate" type="checkbox" />为所选页重新识别并另计费用</label>
      <Button type="submit" disabled={reserve.isPending || run.isPending}>预留识别任务</Button>
      {pageError && <p role="alert">{pageError}</p>}
    </form>
    <p>已选 {selected.length} 个任务</p>
    {jobs.data?.items.map(job => <article key={job.id} className="space-y-2 rounded border border-(--ui-border) p-3">
      <label><input type="checkbox" checked={selected.includes(job.id)} disabled={run.isPending} onChange={() => toggle(job.id)} />第{job.page_number}页 · {STATES[job.state]} · {job.id.slice(0, 8)}</label>
      <p>{job.model.provider || '默认服务商'} · {job.model.model || '默认模型'} · {job.reported_micro_usd == null ? `估算 $${(job.estimated_micro_usd / 1e6).toFixed(6)}` : `回执 $${(job.reported_micro_usd / 1e6).toFixed(6)}`}</p>
      {job.error_code && <p role="status">{job.error_code}</p>}
      {['queued', 'running'].includes(job.state) && <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(job.id)}>取消第{job.page_number}页任务</Button>}
    </article>)}
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页识别任务</Button><Button variant="secondary" disabled={jobs.data?.next_offset == null} onClick={() => setOffset(jobs.data?.next_offset ?? 0)}>下一页识别任务</Button></div>
    <label><input type="checkbox" checked={acknowledgeCost} onChange={event => setAcknowledgeCost(event.target.checked)} />取消执行中请求时，确认服务商仍可能计费</label>
    <div className="flex gap-2"><Button disabled={!selected.length || run.isPending} onClick={() => run.mutate()}>运行已选识别任务</Button><Button variant="secondary" disabled={!selected.length || compose.isPending || run.isPending} onClick={() => compose.mutate()}>合并已选结果并校对</Button></div>
    {run.isPending && <p role="status">正在按页识别答卷，任务状态与费用会持续保存</p>}
    {proposal && <RecognitionReview key={JSON.stringify(proposal.source_jobs)} route={route} paper={paper} proposal={proposal} onSaved={value => { setProposal(null); onSaved(value) }} />}
    {[jobs.error, costs.error, budget.error, reserve.error, run.error, cancel.error, compose.error].filter(Boolean).map((error, index) => <p key={index} role="alert">{error?.message}</p>)}
  </section>
}
