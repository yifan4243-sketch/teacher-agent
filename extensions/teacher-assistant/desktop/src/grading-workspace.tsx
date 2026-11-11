import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { AnswerEditor } from './answer-editor'
import type { ExamPaper, ExamSummary } from './exam-api'
import type { GradeDraft, GradeSummary, PublishedGrade, Submission, SubmissionSummary } from './grading-api'
import { GradingAgent } from './grading-agent'
import { GradeReview } from './grade-review'
import type { Page } from './textbook-api'

export function GradingWorkspace({ route }: { route: PluginProfileRoute }) {
  const [courseId, setCourseId] = useState('')
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  return <section aria-label="答卷评分工作台" className="space-y-4">
    <h2 className="text-xl font-semibold">答卷与成绩</h2>
    <label>批改课程<select aria-label="批改课程" value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    {courseId && <CourseGrading key={courseId} route={route} courseId={courseId} />}
    {courses.error && <p role="alert">{courses.error.message}</p>}
  </section>
}

function CourseGrading({ route, courseId }: { route: PluginProfileRoute; courseId: string }) {
  const [paperId, setPaperId] = useState('')
  const [offset, setOffset] = useState(0)
  const papers = useQuery({ queryKey: [...routeKey(route), 'exam-papers', courseId, offset], queryFn: () => call<Page<ExamSummary>>(route, 'exam.paper.list', { course_id: courseId, offset, limit: 20 }) })
  return <div className="space-y-4">
    <label>批改试卷版本<select aria-label="批改试卷版本" value={paperId} onChange={event => setPaperId(event.target.value)}><option value="">选择已审核试卷</option>{papers.data?.items.filter(paper => paper.status === 'approved').map(paper => <option key={paper.id} value={paper.id}>{paper.title} · v{paper.version}</option>)}</select></label>
    <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页批改试卷</Button><Button variant="secondary" disabled={papers.data?.next_offset == null} onClick={() => setOffset(papers.data?.next_offset ?? 0)}>下一页批改试卷</Button></div>
    {paperId && <PaperGrading key={paperId} route={route} courseId={courseId} paperId={paperId} />}
    {papers.error && <p role="alert">{papers.error.message}</p>}
  </div>
}

function PaperGrading({ route, courseId, paperId }: { route: PluginProfileRoute; courseId: string; paperId: string }) {
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState('')
  const [submissionId, setSubmissionId] = useState('')
  const [editing, setEditing] = useState(false)
  const [offset, setOffset] = useState(0)
  const [gradeId, setGradeId] = useState('')
  const paper = useQuery({ queryKey: [...routeKey(route), 'exam-paper', paperId], queryFn: () => call<ExamPaper>(route, 'exam.paper.get', { id: paperId }) })
  const students = useQuery({ queryKey: [...routeKey(route), 'student'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'student.list') })
  const enrollments = useQuery({ queryKey: [...routeKey(route), 'enrollments', courseId], queryFn: () => call<{ items: { student_id: string }[] }>(route, 'enrollment.list', { course_id: courseId }) })
  const submissions = useQuery({ queryKey: [...routeKey(route), 'submissions', paperId, offset], queryFn: () => call<Page<SubmissionSummary>>(route, 'submission.list', { id: paperId, offset, limit: 20 }) })
  const selected = useQuery({ queryKey: [...routeKey(route), 'submission', submissionId], queryFn: () => call<Submission>(route, 'submission.get', { id: submissionId }), enabled: !!submissionId })
  async function saved(value: Submission) { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); setSubmissionId(value.id); setStudentId(value.student_id); setEditing(false) }
  return <div className="space-y-4">
    <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: routeKey(route) })}>刷新答卷与成绩</Button>
    <label>答卷学生<select aria-label="答卷学生" value={studentId} onChange={event => { setStudentId(event.target.value); setSubmissionId(''); setEditing(false) }}><option value="">选择已选课学生</option>{students.data?.items.filter(student => enrollments.data?.items.some(item => item.student_id === student.id)).map(student => <option key={student.id} value={student.id}>{student.name} · {student.student_number}</option>)}</select></label>
    <Button disabled={!studentId || !paper.data} onClick={() => { setSubmissionId(''); setEditing(true) }}>录入学生答卷</Button>
    <h3>已保存答卷</h3>
    {submissions.data?.items.map(item => <Button key={item.id} variant="ghost" onClick={() => { setSubmissionId(item.id); setStudentId(item.student_id); setEditing(false) }}>{item.name} · 答卷v{item.version}</Button>)}
    <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页答卷</Button><Button variant="secondary" disabled={submissions.data?.next_offset == null} onClick={() => setOffset(submissions.data?.next_offset ?? 0)}>下一页答卷</Button></div>
    {selected.data && <p>当前答卷v{selected.data.version} · 最新v{selected.data.latest_version}</p>}
    {selected.data?.version === selected.data?.latest_version && selected.data && <Button variant="secondary" onClick={() => setEditing(true)}>更正答卷另存版本</Button>}
    {editing && paper.data && studentId && <AnswerEditor key={submissionId || studentId} route={route} paper={paper.data} studentId={studentId} submission={selected.data} onSaved={saved} />}
    {paper.data && selected.data && <SubmissionGrading route={route} paper={paper.data} submission={selected.data} onPublished={value => setGradeId(value.id)} />}
    {paper.data && <GradeRecords route={route} courseId={courseId} paper={paper.data} gradeId={gradeId} onGrade={setGradeId} />}
    {[paper.error, students.error, enrollments.error, submissions.error, selected.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}

function SubmissionGrading({ route, paper, submission, onPublished }: { route: PluginProfileRoute; paper: ExamPaper; submission: Submission; onPublished: (grade: PublishedGrade) => void }) {
  const queryClient = useQueryClient()
  const draft = useQuery({ queryKey: [...routeKey(route), 'grade-draft', submission.latest_draft_id], queryFn: () => call<GradeDraft>(route, 'grading.draft.get', { id: submission.latest_draft_id }), enabled: !!submission.latest_draft_id })
  const score = useMutation({ mutationFn: () => call<GradeDraft>(route, 'grading.score', { id: submission.id, expected_version: draft.data?.version ?? 0 }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  return <section aria-label="答卷评分与复核" className="space-y-4">
    <Button disabled={score.isPending || !!submission.latest_draft_id && draft.isPending || submission.version !== submission.latest_version} onClick={() => score.mutate()}>{draft.data ? '重新计算评分草稿' : '计算评分草稿'}</Button>
    {draft.data && <>
      {draft.data.report.subjective_count > 0 && <GradingAgent key={draft.data.id} route={route} draft={draft.data} />}
      {draft.data.published_grade_id ? <p>该评分草稿已发布正式成绩。更正时先重新计算评分草稿，已有成绩保留在复核历史中。</p> : <GradeReview key={`${draft.data.id}:${draft.data.current_grade_id}`} route={route} paper={paper} submission={submission} draft={draft.data} onPublished={onPublished} />}
    </>}
    {[draft.error, score.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}

function GradeRecords({ route, courseId, paper, gradeId, onGrade }: { route: PluginProfileRoute; courseId: string; paper: ExamPaper; gradeId: string; onGrade: (id: string) => void }) {
  const [offset, setOffset] = useState(0)
  const grades = useQuery({ queryKey: [...routeKey(route), 'grades', courseId, paper.id, offset], queryFn: () => call<Page<GradeSummary>>(route, 'grade.list', { course_id: courseId, paper_id: paper.id, offset, limit: 20 }) })
  const grade = useQuery({ queryKey: [...routeKey(route), 'grade', gradeId], queryFn: () => call<PublishedGrade>(route, 'grade.get', { id: gradeId }), enabled: !!gradeId })
  return <section aria-label="正式成绩记录" className="space-y-3"><h3>正式成绩</h3>
    {grades.data?.items.map(item => <Button key={item.id} variant="ghost" onClick={() => onGrade(item.id)}>{item.name} · {(item.total_points_centi / 100).toFixed(2)}分</Button>)}
    {grades.data?.total === 0 && <p>当前试卷尚未发布正式成绩。</p>}
    <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页成绩</Button><Button variant="secondary" disabled={grades.data?.next_offset == null} onClick={() => setOffset(grades.data?.next_offset ?? 0)}>下一页成绩</Button></div>
    {grade.data && <article className="space-y-2"><p>复核总分 {(grade.data.total_points_centi / 100).toFixed(2)}分 · {grade.data.active ? '当前成绩' : '历史成绩'}</p><p>{grade.data.note} · {grade.data.created_at}</p>{grade.data.scores.map((score, index) => <p key={score.question_id}>第{index + 1}题 · {(score.points_centi / 100).toFixed(2)}分 · {score.comment}</p>)}<h4>错题记录</h4>{grade.data.wrong_questions.map(item => <p key={item.question_id}>{paper.questions.find(question => question.id === item.question_id)?.prompt} · 失分{(item.lost_points_centi / 100).toFixed(2)}分</p>)}{grade.data.previous_id && <Button variant="secondary" onClick={() => onGrade(grade.data!.previous_id!)}>查看前次成绩</Button>}</article>}
    {[grades.error, grade.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
