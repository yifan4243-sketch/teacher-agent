import { Button, useMutation, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import type { FormEvent } from 'react'

import { call, routeKey } from './api'
import type { ExamPaper } from './exam-api'
import { answerText, type GradeDraft, type PublishedGrade, type Submission } from './grading-api'
import { scoreCenti } from './question-api'

interface Props { route: PluginProfileRoute; paper: ExamPaper; submission: Submission; draft: GradeDraft; onPublished: (grade: PublishedGrade) => void }

export function GradeReview({ route, paper, submission, draft, onPublished }: Props) {
  const queryClient = useQueryClient()
  const publish = useMutation({ mutationFn: (data: object) => call<PublishedGrade>(route, 'grading.publish', data, crypto.randomUUID()), onSuccess: async value => { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); onPublished(value) } })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const scores = paper.questions.map(question => {
      const awards = (question.content.rubric ?? []).map((_, index) => scoreCenti(String(form.get(`${question.id}.rubric.${index}`))))
      return { question_id: question.id, points_centi: awards.length ? awards.reduce((sum, value) => sum + value, 0) : scoreCenti(String(form.get(question.id + '.points'))), rubric_awards: awards, comment: String(form.get(question.id + '.comment')) }
    })
    publish.mutate({ id: draft.id, scores, note: String(form.get('note')), confirmed: form.has('confirmed'), expected_current_grade_id: draft.current_grade_id })
  }
  return <form aria-label="教师评分复核" className="space-y-4" onSubmit={save}>
    <h3 className="font-semibold">评分草稿v{draft.version}</h3>
    <p>客观题自动得分 {(draft.report.objective_points_centi / 100).toFixed(2)}分 · 主观题{draft.report.subjective_count}题</p>
    {draft.report.scores.map((score, index) => {
      const question = paper.questions.find(item => item.id === score.question_id)!
      const answer = submission.answers.find(item => item.question_id === score.question_id)!.content
      return <fieldset key={score.question_id} className="space-y-2 rounded border border-(--ui-border) p-3"><legend>第{index + 1}题 · {question.prompt}</legend>
        <p className="whitespace-pre-wrap">学生作答 {answerText(answer)}</p>
        {score.automatic_points_centi != null && <p>自动得分 {(score.automatic_points_centi / 100).toFixed(2)}分</p>}
        {score.confidence != null && <p role={score.confidence < 0.8 ? 'status' : undefined}>模型建议 {(score.proposed_points_centi! / 100).toFixed(2)}分 · 置信度{(score.confidence * 100).toFixed(0)}%{score.confidence < 0.8 && ' · 请重点人工核查'}</p>}
        {question.kind === 'short_answer' ? <><p className="whitespace-pre-wrap">参考答案 {question.content.reference_answer}</p>{question.content.rubric!.map((item, rubricIndex) => <label key={rubricIndex} className="block">{item.label}（满分{(item.points_centi / 100).toFixed(2)}分）<input className="ml-2 w-28 rounded border border-(--ui-border) p-2" aria-label={`第${index + 1}题评分要点${rubricIndex + 1}得分`} name={`${question.id}.rubric.${rubricIndex}`} type="number" min={0} max={item.points_centi / 100} step="0.01" required defaultValue={(score.rubric_awards[rubricIndex] ?? 0) / 100} /></label>)}</> : <label>复核得分<input className="ml-2 w-28 rounded border border-(--ui-border) p-2" aria-label={`第${index + 1}题复核得分`} name={question.id + '.points'} type="number" min={0} max={question.points_centi / 100} step="0.01" required defaultValue={(score.proposed_points_centi ?? 0) / 100} /></label>}
        <label className="block">评分意见或调整原因<textarea className="mt-1 min-h-24 w-full rounded border border-(--ui-border) p-2" aria-label={`第${index + 1}题评分意见`} name={question.id + '.comment'} maxLength={4000} defaultValue={score.comment} /></label>
      </fieldset>
    })}
    <label className="block">成绩复核说明<textarea className="mt-1 min-h-24 w-full rounded border border-(--ui-border) p-2" aria-label="成绩复核说明" name="note" required maxLength={4000} /></label>
    <label className="flex gap-2"><input type="checkbox" name="confirmed" required />已逐题核对答卷、自动评分和主观题评分要点，确认发布正式成绩</label>
    <Button type="submit" disabled={publish.isPending || draft.version !== draft.latest_version || submission.version !== submission.latest_version}>教师确认发布成绩</Button>
    {publish.error && <p role="alert">{publish.error.message}</p>}
  </form>
}
