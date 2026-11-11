import { Button, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { DIFFICULTIES, QUESTION_KINDS, QUESTION_STATUS, type Question, type QuestionSummary } from './question-api'
import { QuestionDetails } from './question-details'
import { QuestionEditor } from './question-editor'
import type { BookVersion, Page, Textbook } from './textbook-api'

interface Props { route: PluginProfileRoute }

export function QuestionBank({ route }: Props) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [questionId, setQuestionId] = useState('')
  const [kind, setKind] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [editing, setEditing] = useState(false)
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const books = useQuery({ queryKey: [...routeKey(route), 'textbooks', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }), enabled: !!courseId })
  const book = useQuery({ queryKey: [...routeKey(route), 'book-version', versionId], queryFn: () => call<BookVersion>(route, 'textbook.version', { id: versionId }), enabled: !!versionId })
  const questions = useQuery({ queryKey: [...routeKey(route), 'questions', courseId, versionId, chapterId, kind, difficulty, status, search, offset], queryFn: () => call<Page<QuestionSummary>>(route, 'question.list', { course_id: courseId, textbook_version_id: versionId || null, chapter_id: chapterId || null, kind: kind || null, difficulty: difficulty || null, status: status || null, search, offset, limit: 20 }), enabled: !!courseId })
  const selected = useQuery({ queryKey: [...routeKey(route), 'question', questionId], queryFn: () => call<Question>(route, 'question.get', { id: questionId }), enabled: !!questionId })
  const history = useQuery({ queryKey: [...routeKey(route), 'question-history', selected.data?.root_id, historyOffset], queryFn: () => call<Page<QuestionSummary>>(route, 'question.list', { course_id: courseId, root_id: selected.data!.root_id, offset: historyOffset, limit: 30 }), enabled: !!selected.data })
  async function saved(question: Question) { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); setQuestionId(question.id); setVersionId(question.textbook_version_id); setEditing(false) }
  return <section aria-label="教材关联题库" className="space-y-4">
    <h2 className="text-xl font-semibold">题库</h2>
    <p>题目与确定的教材版本和原文依据关联，答案、解析和分值保存到各自版本。教师核对后审核。</p>
    <label>题库课程<select aria-label="题库课程" value={courseId} onChange={event => { setCourseId(event.target.value); setVersionId(''); setChapterId(''); setQuestionId(''); setEditing(false); setOffset(0) }}><option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    <label>题库教材版本<select aria-label="题库教材版本" value={versionId} onChange={event => { setVersionId(event.target.value); setChapterId(''); setQuestionId(''); setEditing(false); setOffset(0) }}><option value="">全部教材版本</option>{books.data?.items.flatMap(book => book.versions.map(version => <option key={version.id} value={version.id}>{book.title} · v{version.version}</option>))}</select></label>
    {versionId && <label>题库章节<select aria-label="题库章节" value={chapterId} onChange={event => { setChapterId(event.target.value); setOffset(0) }}><option value="">全部章节</option>{book.data?.chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>}
    <div className="flex flex-wrap gap-3">
      <label>题干查询<input aria-label="题干查询" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setOffset(0) }} /></label>
      <label>题型筛选<select aria-label="题型筛选" value={kind} onChange={event => { setKind(event.target.value); setOffset(0) }}><option value="">全部题型</option>{Object.entries(QUESTION_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>难度筛选<select aria-label="题目难度筛选" value={difficulty} onChange={event => { setDifficulty(event.target.value); setOffset(0) }}><option value="">全部难度</option>{Object.entries(DIFFICULTIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>审核筛选<select aria-label="题目审核筛选" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="">最新版本</option>{Object.entries(QUESTION_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {courseId && <Button disabled={!versionId} onClick={() => { setQuestionId(''); setEditing(true) }}>新建题目</Button>}
    {questions.data?.items.map(question => <article key={question.id} className="space-y-1 rounded border border-(--ui-border) p-3"><Button variant="ghost" className="h-auto whitespace-normal text-left" onClick={() => { setQuestionId(question.id); setHistoryOffset(0); setEditing(false) }}>{question.prompt}</Button><p>{QUESTION_KINDS[question.kind]} · {(question.points_centi / 100).toFixed(2)}分 · {DIFFICULTIES[question.difficulty]} · v{question.version} · {QUESTION_STATUS[question.status]}</p></article>)}
    {questions.data?.total === 0 && <p>当前筛选没有题目。</p>}
    {courseId && questions.isPending && <p role="status">正在读取题库</p>}
    {questionId && selected.isPending && <p role="status">正在读取题目版本</p>}
    {courseId && <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页题目</Button><Button variant="secondary" disabled={questions.data?.next_offset == null} onClick={() => setOffset(questions.data?.next_offset ?? 0)}>下一页题目</Button></div>}
    {selected.data && <div className="flex gap-2"><label>题目版本<select aria-label="题目版本" value={questionId} onChange={event => { setQuestionId(event.target.value); setVersionId(history.data?.items.find(question => question.id === event.target.value)?.textbook_version_id ?? versionId); setChapterId(''); setEditing(false) }}>
      {!history.data?.items.some(question => question.id === questionId) && <option value={questionId}>v{selected.data.version} · {QUESTION_STATUS[selected.data.status]}</option>}
      {history.data?.items.map(question => <option key={question.id} value={question.id}>v{question.version} · {QUESTION_STATUS[question.status]}</option>)}</select></label>
      <Button variant="secondary" disabled={historyOffset === 0} onClick={() => setHistoryOffset(value => Math.max(0, value - 30))}>上一组题目版本</Button><Button variant="secondary" disabled={history.data?.next_offset == null} onClick={() => setHistoryOffset(history.data?.next_offset ?? 0)}>下一组题目版本</Button>
    </div>}
    {selected.data && !editing && <QuestionDetails key={selected.data.id + selected.data.status} route={route} question={selected.data} onEdit={() => { setVersionId(selected.data.textbook_version_id); setEditing(true) }} />}
    {editing && courseId && versionId && (!questionId || selected.data) && <QuestionEditor key={questionId || versionId} route={route} courseId={courseId} versionId={versionId} question={selected.data} onSaved={saved} />}
    {[courses.error, books.error, book.error, questions.error, selected.error, history.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
