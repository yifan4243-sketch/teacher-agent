import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useEffect, useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { BlueprintEditor } from './blueprint-editor'
import { openGeneration, type Generation, type Lesson, type TeachingDocument } from './preparation-api'

export function SlidesWorkspace({ route }: { route: PluginProfileRoute }) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [blueprintId, setBlueprintId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const lessons = useQuery({ queryKey: [...routeKey(route), 'lessons', courseId], queryFn: () => call<{ items: Lesson[] }>(route, 'lesson.list', { course_id: courseId }), enabled: !!courseId })
  const documents = useQuery({ queryKey: [...routeKey(route), 'documents', lessonId], queryFn: () => call<{ items: TeachingDocument[] }>(route, 'document.list', { lesson_id: lessonId }), enabled: !!lessonId })
  const generations = useQuery({
    queryKey: [...routeKey(route), 'generations', lessonId], queryFn: () => call<{ items: Generation[] }>(route, 'document.generation.list', { lesson_id: lessonId }), enabled: !!lessonId,
    refetchInterval: query => query.state.data?.items.some(item => item.task.status === 'running') ? 3000 : false,
  })
  const generationState = generations.data?.items.map(item => `${item.workflow_id}:${item.task.version}`).join('|') ?? ''
  useEffect(() => {
    if (lessonId) void queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'documents', lessonId] })
  }, [generationState, lessonId, queryClient, route])
  const generate = useMutation({
    mutationFn: async () => {
      const task = await call<Generation>(route, 'document.generation.begin', { lesson_id: lessonId, kind: 'slide_blueprint', allow_model_call: true }, crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: routeKey(route) })
      await openGeneration(route, task)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  const reopen = useMutation({ mutationFn: (generation: Generation) => openGeneration(route, generation) })
  function start(event: FormEvent<HTMLFormElement>) { event.preventDefault(); generate.mutate() }
  return <section className="space-y-5" aria-label="教学课件页面规划">
    <h2 className="text-lg font-semibold">课件页面蓝图</h2>
    <p>按教材、已审核授课稿与教案规划逐页教学内容，可选主题无需人工参考图。</p>
    <label className="grid max-w-xl gap-2">课件课程<select aria-label="课件课程" value={courseId} onChange={event => { setCourseId(event.target.value); setLessonId(''); setBlueprintId('') }}>
      <option value="">选择课程</option>{courses.data?.items.map(course => <option value={course.id} key={course.id}>{course.title}</option>)}
    </select></label>
    {courseId && <label className="grid max-w-xl gap-2">课件课次<select aria-label="课件课次" value={lessonId} onChange={event => { setLessonId(event.target.value); setBlueprintId('') }}>
      <option value="">选择课次</option>{lessons.data?.items.map(lesson => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}
    </select></label>}
    {lessonId && <>
      <form onSubmit={start} className="grid max-w-xl gap-3">
        <label className="flex gap-2"><input type="checkbox" required />允许本次由原生Agent规划课件，使用课件阶段模型或当前模型，可能产生费用</label>
        <Button type="submit" disabled={generate.isPending}>生成课件页面蓝图</Button>
      </form>
      {generations.data?.items.filter(item => item.kind === 'slide_blueprint').map(item => <p key={item.workflow_id}>{item.task.input.title} <Button variant="secondary" disabled={reopen.isPending} onClick={() => reopen.mutate(item)}>打开蓝图Agent会话</Button></p>)}
      <label className="grid max-w-xl gap-2">课件蓝图版本<select aria-label="课件蓝图版本" value={blueprintId} onChange={event => setBlueprintId(event.target.value)}>
        <option value="">选择页面蓝图</option>{documents.data?.items.filter(document => document.kind === 'slide_blueprint').map(document => <option value={document.id} key={document.id}>页面蓝图 · v{document.version} · {document.status === 'approved' ? '已审核' : '草稿'}</option>)}
      </select></label>
      <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: routeKey(route) })}>刷新课件记录</Button>
      {blueprintId && <BlueprintEditor key={blueprintId} route={route} documentId={blueprintId} onVersion={setBlueprintId} />}
    </>}
    {[courses.error, lessons.error, documents.error, generations.error, generate.error, reopen.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
