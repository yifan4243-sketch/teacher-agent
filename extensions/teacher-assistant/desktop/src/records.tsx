import { Button, Input, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'

interface Field {
  name: string
  label: string
  required?: boolean
  numeric?: boolean
  initial?: string
}

const FIELDS: Record<string, Field[]> = {
  course: [
    { name: 'title', label: '课程名称', required: true },
    { name: 'subject', label: '学科' },
    { name: 'level', label: '学生年级与基础' },
    { name: 'objectives', label: '教学目标' },
    { name: 'period_minutes', label: '每小节教学分钟', numeric: true, initial: '40' },
    { name: 'period_count', label: '每课次小节数', numeric: true, initial: '2' },
    { name: 'break_minutes', label: '课次内休息合计分钟', numeric: true, initial: '10' },
  ],
  class: [
    { name: 'name', label: '班级名称', required: true },
    { name: 'academic_year', label: '学年' },
  ],
  student: [
    { name: 'student_number', label: '学号', required: true },
    { name: 'name', label: '学生姓名', required: true },
  ],
}

const TITLES: Record<string, string> = { course: '课程', class: '班级', student: '学生' }

interface Props {
  route: PluginProfileRoute
  entity: 'course' | 'class' | 'student'
}

export function RecordEditor({ route, entity }: Props) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<TeacherRecord | null>(null)
  const [message, setMessage] = useState('')
  const records = useQuery({
    queryKey: [...routeKey(route), entity],
    queryFn: () => call<{ items: TeacherRecord[] }>(route, `${entity}.list`, { include_archived: true }),
  })
  const classes = useQuery({
    queryKey: [...routeKey(route), 'class'],
    queryFn: () => call<{ items: TeacherRecord[] }>(route, 'class.list', { include_archived: true }),
    enabled: entity === 'student',
  })
  const mutation = useMutation({
    mutationFn: ({ operation, data }: { operation: string; data: object }) => call<TeacherRecord>(route, operation, data, crypto.randomUUID()),
    onSuccess: async saved => {
      await queryClient.invalidateQueries({ queryKey: routeKey(route) })
      setSelected(saved)
      setMessage('已保存至本地教学数据库')
    },
  })

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data: Record<string, unknown> = {}
    for (const field of FIELDS[entity]) {
      const value = String(form.get(field.name) ?? '')
      data[field.name] = field.numeric ? Number(value) : value
    }
    if (entity === 'student') data.class_id = String(form.get('class_id') ?? '')
    if (selected) Object.assign(data, { id: selected.id, version: selected.version })
    setMessage('')
    mutation.mutate({ operation: `${entity}.${selected ? 'update' : 'create'}`, data })
  }

  return <section className="space-y-5" aria-label={`${TITLES[entity]}管理`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{TITLES[entity]}管理</h2>
      <Button variant="secondary" onClick={() => { setSelected(null); setMessage(''); mutation.reset() }}>新增{TITLES[entity]}</Button>
    </div>
    {records.isPending && <p role="status">正在读取数据库…</p>}
    {records.error && <p role="alert">{records.error.message}</p>}
    {records.data?.items.length === 0 && <p>还没有{TITLES[entity]}记录。</p>}
    <ul className="space-y-2">
      {records.data?.items.map(record => <li key={record.id} className="flex flex-wrap items-center gap-3">
        <Button variant="text" onClick={() => { setSelected(record); setMessage(''); mutation.reset() }}>
          {record.title ?? record.name}{record.archived ? '（已归档）' : ''}
        </Button>
        {entity === 'course' && <span>{record.period_count}小节 · 教学{record.instruction_minutes}分钟 · 占用{record.session_span_minutes}分钟</span>}
        {entity === 'student' && <span>{record.student_number}</span>}
      </li>)}
    </ul>
    <form key={`${entity}:${selected?.id ?? 'new'}:${selected?.version ?? 0}`} onSubmit={save} className="grid max-w-2xl gap-4">
      <h3 className="font-medium">{selected ? '编辑' : '创建'}{TITLES[entity]}</h3>
      {FIELDS[entity].map(field => <label key={field.name} className="grid gap-1 text-sm">
        {field.label}
        <Input name={field.name} required={field.required || field.numeric} type={field.numeric ? 'number' : 'text'}
          min={field.numeric ? 0 : undefined} defaultValue={String(selected?.[field.name as keyof TeacherRecord] ?? field.initial ?? '')} />
      </label>)}
      {entity === 'student' && <label className="grid gap-1 text-sm">所属班级
        <select aria-label="所属班级" name="class_id" required defaultValue={selected?.class_id ?? ''} className="rounded-md border bg-transparent p-2">
          <option value="">请选择班级</option>
          {classes.data?.items.filter(record => !record.archived || record.id === selected?.class_id).map(record => <option value={record.id} key={record.id}>{record.name}</option>)}
        </select>
      </label>}
      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>保存{TITLES[entity]}</Button>
        {selected && <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({
          operation: `${entity}.update`, data: { id: selected.id, version: selected.version, archived: !selected.archived },
        })}>{selected.archived ? '恢复记录' : '归档记录'}</Button>}
      </div>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  </section>
}

export function CourseRoster({ route }: { route: PluginProfileRoute }) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list', { include_archived: true }) })
  const classes = useQuery({ queryKey: [...routeKey(route), 'class'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'class.list', { include_archived: true }) })
  const students = useQuery({ queryKey: [...routeKey(route), 'student'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'student.list', { include_archived: true }) })
  const enrollment = useQuery({ queryKey: [...routeKey(route), 'enrollment', courseId], queryFn: () => call<{ items: { student_id: string }[] }>(route, 'enrollment.list', { course_id: courseId }), enabled: Boolean(courseId) })
  const linked = useQuery({ queryKey: [...routeKey(route), 'course-classes', courseId], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.classes', { course_id: courseId }), enabled: Boolean(courseId) })
  const mutation = useMutation({
    mutationFn: ({ operation, data }: { operation: string; data: object }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  const selections = [
    { label: '课程', value: courseId, set: setCourseId, items: courses.data?.items },
    { label: '班级', value: classId, set: setClassId, items: classes.data?.items },
    { label: '学生', value: studentId, set: setStudentId, items: students.data?.items },
  ]
  return <section className="space-y-4" aria-label="课程身份关联">
    <h2 className="text-lg font-semibold">课程与学生关联</h2>
    <p>先关联授课班级，再登记学生选课。正式成绩将使用该选课身份。</p>
    <div className="flex flex-wrap gap-4">
      {selections.map(selection => <label key={selection.label} className="grid gap-1">{selection.label}
        <select aria-label={selection.label} value={selection.value} onChange={event => selection.set(event.target.value)} className="rounded-md border bg-transparent p-2">
          <option value="">请选择{selection.label}</option>
          {selection.items?.filter(record => !record.archived).map(record => <option key={record.id} value={record.id}>{record.title ?? record.name}</option>)}
        </select>
      </label>)}
    </div>
    <div className="flex gap-3">
      <Button disabled={!courseId || !classId || mutation.isPending} onClick={() => mutation.mutate({ operation: 'course.assign_class', data: { course_id: courseId, class_id: classId } })}>关联班级</Button>
      <Button disabled={!courseId || !studentId || mutation.isPending} onClick={() => mutation.mutate({ operation: 'enrollment.create', data: { course_id: courseId, student_id: studentId } })}>登记选课</Button>
    </div>
    {linked.data && <p>授课班级 · {linked.data.items.map(record => record.name).join('、') || '暂无关联'}</p>}
    {enrollment.data && <p>已登记 {enrollment.data.items.length} 名学生</p>}
    {[courses.error, classes.error, students.error, enrollment.error, linked.error, mutation.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
