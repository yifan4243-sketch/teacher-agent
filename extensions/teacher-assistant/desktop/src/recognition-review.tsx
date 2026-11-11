import { useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call, routeKey } from './api'
import { AnswerEditor } from './answer-editor'
import type { ExamPaper } from './exam-api'
import type { Submission } from './grading-api'
import type { RecognitionJob, RecognitionProposal } from './recognition-api'

interface Props { route: PluginProfileRoute; paper: ExamPaper; proposal: RecognitionProposal; onSaved: (value: Submission) => void }

export function RecognitionReview({ route, paper, proposal, onSaved }: Props) {
  return <section aria-label="答卷识别校对" className="space-y-3">
    <h3>对照原页校对答案</h3>
    {proposal.source_jobs.map(job => <SourceJob key={job.id} route={route} id={job.id} page={job.page_number} paper={paper} />)}
    {proposal.warnings.map(item => <p role="status" key={item.question_id}>第{paper.questions.findIndex(question => question.id === item.question_id) + 1}题 · {item.message}</p>)}
    {proposal.unassigned.map(item => <p className="whitespace-pre-wrap" key={item.page_number}>第{item.page_number}页未定位作答 · {item.text}</p>)}
    <AnswerEditor route={route} paper={paper} studentId={proposal.student_id} recognition={proposal} onSaved={onSaved} />
  </section>
}

function SourceJob({ route, id, page, paper }: { route: PluginProfileRoute; id: string; page: number; paper: ExamPaper }) {
  const job = useQuery({ queryKey: [...routeKey(route), 'recognition-source', id], queryFn: () => call<RecognitionJob>(route, 'recognition.get', { id }), staleTime: Infinity })
  return <details><summary>第{page}页识别原文与置信度</summary>
    {job.data?.result.answers?.map(answer => <article key={answer.question_id}><p>第{paper.questions.findIndex(question => question.id === answer.question_id) + 1}题 · 置信度{Math.round(answer.confidence * 100)}%</p><p className="whitespace-pre-wrap">{answer.observed_text}</p>{answer.note && <p>{answer.note}</p>}</article>)}
    {job.data?.result.note && <p>{job.data.result.note}</p>}
    {job.error && <p role="alert">{job.error.message}</p>}
  </details>
}
