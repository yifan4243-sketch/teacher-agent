import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useEffect, useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { LessonEditor } from './lesson-editor'
import { DocumentEditor } from './teaching-document'
import { openGeneration, type Generation, type Lesson, type TeachingDocument } from './preparation-api'

const STATUS: Record<string, string> = { pending: '待启动', running: 'Agent执行中', awaiting_review: '待教师审核', completed: '已完成', cancelled: '已取消', failed: '失败' }

export function Preparation({ route }: { route: PluginProfileRoute }) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [documentId, setDocumentId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const lessons = useQuery({ queryKey: [...routeKey(route), 'lessons', courseId], queryFn: () => call<{ items: Lesson[] }>(route, 'lesson.list', { course_id: courseId }), enabled: !!courseId })
  const documents = useQuery({ queryKey: [...routeKey(route), 'documents', lessonId], queryFn: () => call<{ items: TeachingDocument[] }>(route, 'document.list', { lesson_id: lessonId }), enabled: !!lessonId })
  const generations = useQuery({
    queryKey: [...routeKey(route), 'generations', lessonId],
    queryFn: () => call<{ items: Generation[] }>(route, 'document.generation.list', { lesson_id: lessonId }),
    enabled: !!lessonId,
    refetchInterval: query => query.state.data?.items.some(item => item.task.status === 'running') ? 3000 : false,
  })
  const generationState = generations.data?.items.map(item => `${item.workflow_id}:${item.task.version}`).join('|') ?? ''
  useEffect(() => {
    if (lessonId) void queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'documents', lessonId] })
  }, [generationState, lessonId, queryClient, route])
  const generation = useMutation({
    mutationFn: async (kind: string) => {
      const task = await call<Generation>(route, 'document.generation.begin', { lesson_id: lessonId, kind, allow_model_call: true }, crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: routeKey(route) })
      await openGeneration(route, task)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  const reopen = useMutation({ mutationFn: (task: Generation) => openGeneration(route, task) })
  const cancel = useMutation({ mutationFn: (task: Generation) => call(route, 'task.cancel', { id: task.workflow_id, version: task.task.version }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    generation.mutate(String(new FormData(event.currentTarget).get('kind')))
  }
  return <section className="space-y-5" aria-label="授课稿与教案备课">
    <h2 className="text-lg font-semibold">授课稿与教案</h2>
    <p>课次绑定教材版本。逐字稿按40分钟教学、10分钟休息、40分钟教学安排，正式成果只导出DOCX。</p>
    <label className="grid max-w-xl gap-2">备课课程<select aria-label="备课课程" value={courseId} onChange={event => { setCourseId(event.target.value); setLessonId(''); setDocumentId('') }}>
      <option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
    </select></label>
    {courseId && <>
      <LessonEditor key={courseId} route={route} courseId={courseId} onSaved={async lesson => { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); setLessonId(lesson.id); setDocumentId('') }} />
      <label className="grid max-w-xl gap-2">备课课次<select aria-label="备课课次" value={lessonId} onChange={event => { setLessonId(event.target.value); setDocumentId('') }}>
        <option value="">选择课次</option>{lessons.data?.items.map(lesson => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}
      </select></label>
    </>}
    {lessonId && <>
      <form onSubmit={start} className="grid max-w-xl gap-3">
        <label>生成文档<select aria-label="生成文档类型" name="kind"><option value="script">完整授课逐字稿</option><option value="lesson_plan">原模板正式教案</option></select></label>
        <label className="flex items-start gap-2"><input type="checkbox" required />允许本次调用Hermes Agent生成文档，使用阶段配置模型或当前模型，可能产生API费用</label>
        <Button type="submit" disabled={generation.isPending}>调用原生Agent生成草稿</Button>
      </form>
      {generations.data?.items.filter(task => task.kind !== 'slide_blueprint').map(task => <article key={task.workflow_id} className="space-y-2 rounded border border-(--ui-border) p-3">
        <p>{task.task.input.title} · {STATUS[task.task.status] ?? task.task.status} · {task.workflow_id}</p>
        <Button disabled={reopen.isPending} onClick={() => reopen.mutate(task)}>{task.task.status === 'pending' ? '启动已保存任务' : '打开原Agent会话'}</Button>
        {['pending', 'running', 'awaiting_review'].includes(task.task.status) && <Button variant="secondary" onClick={() => cancel.mutate(task)} disabled={cancel.isPending}>取消草稿保存任务</Button>}
        {task.task.status === 'running' && <p>如需停止模型调用，请打开原Agent会话使用停止按钮。任务提交状态不确定时，先核查原会话。</p>}
      </article>)}
      <label className="grid max-w-xl gap-2">教学文档版本<select aria-label="教学文档版本" value={documentId} onChange={event => setDocumentId(event.target.value)}>
        <option value="">选择文档版本</option>{documents.data?.items.filter(document => document.kind !== 'slide_blueprint').map(document => <option value={document.id} key={document.id}>{document.kind === 'script' ? '授课稿' : '教案'} · v{document.version} · {document.status === 'approved' ? '已审核' : document.status === 'rejected' ? '已退回' : '草稿'}</option>)}
      </select></label>
      <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: routeKey(route) })}>刷新备课记录</Button>
      {documents.data?.items.length === 0 && <p>尚未保存教学正文。Agent保存后重新进入本页面即可读取。</p>}
      {documentId && <DocumentEditor key={documentId} route={route} documentId={documentId} onVersion={setDocumentId} />}
    </>}
    {[courses.error, lessons.error, documents.error, generations.error, generation.error, reopen.error, cancel.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
