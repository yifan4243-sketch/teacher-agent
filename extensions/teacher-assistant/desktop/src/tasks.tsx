import { Button, Input, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey, type TeachingTask } from './api'

const STATUS: Record<string, string> = {
  pending: '待执行', running: '执行中', awaiting_review: '待教师审核', completed: '已完成', failed: '失败', cancelled: '已取消',
}

export function Tasks({ route }: { route: PluginProfileRoute }) {
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()
  const tasks = useQuery({ queryKey: [...routeKey(route), 'tasks'], queryFn: () => call<{ items: TeachingTask[] }>(route, 'task.list') })
  const mutation = useMutation({
    mutationFn: ({ operation, data }: { operation: string; data: object }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  return <section className="space-y-5" aria-label="任务与审批">
    <h2 className="text-lg font-semibold">任务与教师审批</h2>
    <form className="flex max-w-2xl gap-3" onSubmit={event => { event.preventDefault(); mutation.mutate({ operation: 'task.create', data: { kind: 'course_setup', course: { title } } }) }}>
      <Input aria-label="新任务课程名称" required value={title} onChange={event => setTitle(event.target.value)} placeholder="课程名称" />
      <Button type="submit" disabled={mutation.isPending}>建立课程任务</Button>
    </form>
    {tasks.isPending && <p role="status">正在读取任务…</p>}
    {tasks.data?.items.length === 0 && <p>暂无任务。Agent 创建的任务也会出现在这里。</p>}
    <ul className="space-y-6">
      {tasks.data?.items.map(task => <li key={task.id} className="space-y-2">
        <h3 className="font-medium">{task.input.title} · {STATUS[task.status] ?? task.status}</h3>
        <p className="text-sm text-(--ui-text-tertiary)">{task.id} · 版本{task.version}</p>
        <p>已持久保存步骤 · {task.steps.map(step => step.step_key).join('、') || '暂无'}</p>
        {task.error && <p role="alert">{task.error}</p>}
        <div className="flex flex-wrap gap-3">
          {task.status === 'pending' && task.kind === 'course_setup' && <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ operation: 'task.run', data: { id: task.id } })}>执行任务</Button>}
          {task.status === 'failed' && <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ operation: 'task.retry', data: { id: task.id, version: task.version } })}>准备重试</Button>}
          {task.status === 'awaiting_review' && task.kind === 'course_setup' && <>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ operation: 'task.review', data: { id: task.id, version: task.version, decision: 'approved' } })}>教师批准</Button>
            <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ operation: 'task.review', data: { id: task.id, version: task.version, decision: 'rejected' } })}>退回任务</Button>
          </>}
          {task.kind === 'document_generation' && <p>请在“授课稿与教案”或“课件页面蓝图”查看对应的Agent会话与审核版本。</p>}
          {['pending', 'failed', 'awaiting_review'].includes(task.status) && <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ operation: 'task.cancel', data: { id: task.id, version: task.version } })}>取消任务</Button>}
        </div>
      </li>)}
    </ul>
    {[tasks.error, mutation.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
