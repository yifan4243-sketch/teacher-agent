import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

import { call, routeKey } from './api'
import type { GradeDraft, GradingGeneration } from './grading-api'
import { openGeneration } from './preparation-api'

export function GradingAgent({ route, draft }: { route: PluginProfileRoute; draft: GradeDraft }) {
  const queryClient = useQueryClient()
  const [authorized, setAuthorized] = useState(false)
  const generations = useQuery({ queryKey: [...routeKey(route), 'grading-generations', draft.id], queryFn: () => call<{ items: GradingGeneration[] }>(route, 'grading.generation.list', { id: draft.id }), refetchInterval: query => query.state.data?.items.some(item => ['pending', 'running'].includes(item.task.status)) ? 3000 : false })
  const generationState = generations.data?.items.map(item => `${item.workflow_id}:${item.task.version}`).join('|') ?? ''
  useEffect(() => { void queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'submission', draft.submission_id] }) }, [generationState, draft.submission_id, queryClient, route])
  const begin = useMutation({ mutationFn: async () => {
    const task = await call<GradingGeneration>(route, 'grading.generation.begin', { id: draft.id, allow_model_call: authorized }, crypto.randomUUID())
    await queryClient.invalidateQueries({ queryKey: routeKey(route) })
    await openGeneration(route, task, 'grading.generation.claim')
  }, onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const resume = useMutation({ mutationFn: (task: GradingGeneration) => openGeneration(route, task, 'grading.generation.claim'), onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const cancel = useMutation({ mutationFn: (task: GradingGeneration) => call(route, 'task.cancel', { id: task.workflow_id, version: task.task.version }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  return <section aria-label="主观题辅助批改" className="space-y-3">
    <label className="flex gap-2"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} />已检查本次答案，允许将主观题答案及评分标准发送给模型，可能产生费用</label>
    <Button disabled={!authorized || begin.isPending || draft.version !== draft.latest_version} onClick={() => begin.mutate()}>启动主观题辅助批改</Button>
    {generations.data?.items.map(task => <div key={task.workflow_id} className="flex flex-wrap gap-2"><span>辅助批改任务 · {task.task.status}</span><Button variant="secondary" disabled={resume.isPending || task.task.status === 'cancelled'} onClick={() => resume.mutate(task)}>打开批改会话</Button>{['pending', 'running', 'awaiting_review'].includes(task.task.status) && <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(task)}>取消评分建议保存任务</Button>}</div>)}
    <p>停止模型请求请使用原生会话的停止按钮。</p>
    {[generations.error, begin.error, resume.error, cancel.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
