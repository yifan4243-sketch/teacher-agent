import { Button, useMutation, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey } from './api'
import { downloadExam, type ExamPaper } from './exam-api'
import { QuestionDetails } from './question-details'
import { QUESTION_STATUS } from './question-api'

interface Props { route: PluginProfileRoute; paper: ExamPaper; onRevise: () => void }

export function ExamPaperDetails({ route, paper, onRevise }: Props) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [audience, setAudience] = useState('student')
  const [format, setFormat] = useState('docx')
  const review = useMutation({ mutationFn: (decision: string) => call(route, 'exam.paper.review', { id: paper.id, decision, note }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const download = useMutation({ mutationFn: () => downloadExam(route, paper.id, audience, format) })
  return <section aria-label="试卷详情与审核" className="space-y-4">
    <h3 className="font-semibold">{paper.title} · v{paper.version} · {QUESTION_STATUS[paper.status]}</h3>
    <p>{paper.report.question_count}题 · 满分{(paper.report.total_points_centi / 100).toFixed(2)}分 · {paper.plan.config.duration_minutes}分钟</p>
    <p>知识点覆盖 {paper.report.covered_point_ids.length}/{paper.report.scope_point_count}{paper.report.coverage_percent != null && ` · ${paper.report.coverage_percent}%`}</p>
    <p>教材 {paper.plan.scope.textbook_title} · v{paper.plan.scope.textbook_version} · 命题方案v{paper.plan.version}</p>
    {paper.questions.map((question, index) => <details key={question.id}><summary>第{index + 1}题 · {question.prompt} · v{question.version} · {QUESTION_STATUS[question.status]}</summary><QuestionDetails route={route} question={question} /></details>)}
    {paper.status === 'draft' && <div className="space-y-3"><label>试卷审核说明<textarea aria-label="试卷审核说明" value={note} maxLength={4000} onChange={event => setNote(event.target.value)} /></label><div className="flex gap-2"><Button disabled={review.isPending} onClick={() => review.mutate('approved')}>通过试卷审核</Button><Button variant="secondary" disabled={review.isPending} onClick={() => review.mutate('rejected')}>退回试卷修改</Button></div></div>}
    {paper.reviewed_at && <p>试卷审核记录 {paper.review_note || '教师已复核'} · {paper.reviewed_at}</p>}
    {paper.latest_version === paper.version && <Button variant="secondary" onClick={onRevise}>修订试卷</Button>}
    {paper.status === 'approved' && <div className="flex flex-wrap gap-3"><label>试卷导出版本<select aria-label="试卷导出版本" value={audience} onChange={event => setAudience(event.target.value)}><option value="student">学生版</option><option value="teacher">教师版</option></select></label><label>试卷导出格式<select aria-label="试卷导出格式" value={format} onChange={event => setFormat(event.target.value)}><option value="docx">DOCX</option><option value="pdf">PDF</option></select></label><Button disabled={download.isPending} onClick={() => download.mutate()}>下载试卷</Button></div>}
    {[review.error, download.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
