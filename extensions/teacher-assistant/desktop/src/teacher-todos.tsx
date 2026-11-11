import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { TODO_KINDS, TODO_STATES, type Page, type TeacherTodo } from './reminder-api'

interface Props { route: PluginProfileRoute }
interface EditorProps extends Props { todo?: TeacherTodo; onSaved: () => void }

function TodoEditor({ route, todo, onSaved }: EditorProps) {
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (data: object) => call<TeacherTodo>(route, todo ? 'todo.update' : 'todo.create', data, crypto.randomUUID()),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = { title: form.get('title'), details: form.get('details'), kind: form.get('kind'), course_id: form.get('course_id') || null,
      due_at: form.get('due_at'), lead_minutes: Number(form.get('lead_minutes')) }
    save.mutate(todo ? { ...data, id: todo.id, version: todo.version, status: form.get('status') } : data)
  }
  return <form aria-label="待办编辑" onSubmit={submit} className="grid max-w-3xl gap-3 rounded border border-(--ui-border) p-4">
    <h3>{todo ? '修改待办' : '新建待办'}</h3>
    <label>待办标题<input name="title" aria-label="待办标题" defaultValue={todo?.title ?? ''} maxLength={200} required /></label>
    <label>待办类型<select name="kind" aria-label="待办类型" defaultValue={todo?.kind ?? 'personal'}>{Object.entries(TODO_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>待办课程<select name="course_id" aria-label="待办课程" defaultValue={todo?.course_id ?? ''}><option value="">个人事务</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    <label>截止时间（北京时间）<input type="datetime-local" name="due_at" aria-label="待办截止时间" defaultValue={todo?.due_at.slice(0, 16) ?? ''} required /></label>
    <label>提前提醒分钟<input type="number" name="lead_minutes" aria-label="待办提前分钟" min={0} max={10080} defaultValue={todo?.lead_minutes ?? 15} required /></label>
    <label>待办说明<textarea name="details" aria-label="待办说明" maxLength={4000} defaultValue={todo?.details ?? ''} /></label>
    {todo && <label>待办状态<select name="status" aria-label="待办状态" defaultValue={todo.status}>{Object.entries(TODO_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <Button type="submit" disabled={save.isPending}>保存待办</Button>
    {[courses.error, save.error].filter(Boolean).map((error, index) => <p key={index} role="alert">{error?.message}</p>)}
  </form>
}

export function TeacherTodos({ route }: Props) {
  const [status, setStatus] = useState('pending')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<TeacherTodo>()
  const [revision, setRevision] = useState(0)
  const todos = useQuery({ queryKey: [...routeKey(route), 'todos', status, offset], queryFn: () => call<Page<TeacherTodo>>(route, 'todo.list', { status: status || null, offset, limit: 20 }) })
  return <section aria-label="教师待办" className="space-y-3">
    <h2 className="text-xl font-semibold">待办</h2>
    <p>截止时间使用北京时间。作业、考试、备课和个人事务均保存在当前教师配置。</p>
    <label>待办筛选<select aria-label="待办筛选" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="">全部</option>{Object.entries(TODO_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Button variant="secondary" onClick={() => { setSelected(undefined); setRevision(value => value + 1) }}>新建待办</Button>
    {todos.data?.items.map(todo => <article key={todo.id} className="rounded border border-(--ui-border) p-3"><Button variant="ghost" onClick={() => setSelected(todo)}>{todo.title}</Button><p>{TODO_KINDS[todo.kind]} · {todo.due_at.replace('T', ' ')} · {TODO_STATES[todo.status]}</p><p>{todo.details}</p></article>)}
    {todos.data?.total === 0 && <p>当前筛选没有待办。</p>}
    <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页待办</Button><Button variant="secondary" disabled={todos.data?.next_offset == null} onClick={() => setOffset(todos.data?.next_offset ?? 0)}>下一页待办</Button></div>
    <TodoEditor key={`${selected?.id ?? 'new'}:${selected?.version ?? revision}`} route={route} todo={selected} onSaved={() => { setSelected(undefined); setRevision(value => value + 1) }} />
    {todos.isPending && <p role="status">正在读取待办</p>}
    {todos.error && <p role="alert">{todos.error.message}</p>}
  </section>
}
