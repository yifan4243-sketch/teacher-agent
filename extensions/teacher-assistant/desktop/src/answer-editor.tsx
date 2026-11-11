import { Button, useMutation, type PluginProfileRoute } from '@hermes/plugin-sdk'
import type { FormEvent } from 'react'

import { call } from './api'
import type { ExamPaper } from './exam-api'
import type { StudentAnswer, Submission } from './grading-api'
import { QUESTION_KINDS, type Question } from './question-api'
import type { RecognitionProposal } from './recognition-api'

interface Props { route: PluginProfileRoute; paper: ExamPaper; studentId: string; submission?: Submission; recognition?: RecognitionProposal; onSaved: (value: Submission) => void }

export function AnswerEditor({ route, paper, studentId, submission, recognition, onSaved }: Props) {
  const write = useMutation({ mutationFn: (data: object) => call<Submission>(route, recognition ? 'recognition.apply' : 'submission.save', data, crypto.randomUUID()), onSuccess: onSaved })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const answers = paper.questions.map(question => ({ question_id: question.id, content: readAnswer(form, question) }))
    const source = recognition ? { file_id: recognition.file_id, job_ids: recognition.source_jobs.map(job => job.id), reviewed_uncertain: form.has('reviewed_uncertain') } : {}
    write.mutate({ paper_id: paper.id, student_id: studentId, expected_version: recognition?.expected_version ?? submission?.version ?? 0, answers, note: String(form.get('note')), ...source })
  }
  return <form aria-label="学生答卷录入" className="space-y-4 rounded border border-(--ui-border) p-4" onSubmit={save}>
    <h3>答卷{(recognition?.expected_version ?? submission?.version ?? 0) + 1}版</h3>
    {paper.questions.map((question, index) => <AnswerFields key={question.id} question={question} ordinal={index + 1} initial={(recognition?.answers ?? submission?.answers)?.find(answer => answer.question_id === question.id)} />)}
    <label>答卷备注<textarea aria-label="答卷备注" name="note" maxLength={4000} defaultValue={submission?.note ?? ''} /></label>
    {recognition && <label className="flex gap-2"><input type="checkbox" name="reviewed_uncertain" required />已对照原页复核识别文字、低置信、跨页和待补全内容</label>}
    <Button type="submit" disabled={write.isPending}>保存学生答卷</Button>
    {write.error && <p role="alert">{write.error.message}</p>}
  </form>
}

function AnswerFields({ question, ordinal, initial }: { question: Question; ordinal: number; initial?: StudentAnswer }) {
  const content = question.content
  const answer = initial?.content
  return <fieldset className="space-y-2"><legend>第{ordinal}题 · {QUESTION_KINDS[question.kind]} · {content.prompt}</legend>
    {content.options?.map(option => <label key={option.id} className="mr-4 inline-flex gap-2"><input type={question.kind === 'single_choice' ? 'radio' : 'checkbox'} name={question.id + '.choice'} value={option.id} defaultChecked={answer?.selected_ids?.includes(option.id)} />{option.id}　{option.text}</label>)}
    {question.kind === 'single_choice' && <label className="inline-flex gap-2"><input type="radio" name={question.id + '.choice'} value="" defaultChecked={!answer?.selected_ids?.length} />未作答</label>}
    {question.kind === 'true_false' && <select aria-label={`第${ordinal}题判断答案`} name={question.id + '.boolean'} defaultValue={answer?.answer == null ? '' : String(answer.answer)}><option value="">未作答</option><option value="true">正确</option><option value="false">错误</option></select>}
    {content.blanks?.map((_, index) => <label className="block" key={index}>第{index + 1}空<input aria-label={`第${ordinal}题第${index + 1}空答案`} name={`${question.id}.blank.${index}`} maxLength={2000} defaultValue={answer?.values?.[index] ?? ''} /></label>)}
    {question.kind === 'short_answer' && <textarea aria-label={`第${ordinal}题文字答案`} name={question.id + '.text'} maxLength={20000} rows={5} defaultValue={answer?.text ?? ''} />}
  </fieldset>
}

function readAnswer(form: FormData, question: Question): StudentAnswer['content'] {
  const kind = question.kind
  const readers: Record<string, () => StudentAnswer['content']> = {
    single_choice: () => ({ kind, selected_ids: form.getAll(question.id + '.choice').map(String).filter(Boolean) }),
    multiple_choice: () => ({ kind, selected_ids: form.getAll(question.id + '.choice').map(String) }),
    true_false: () => ({ kind, answer: form.get(question.id + '.boolean') === '' ? null : form.get(question.id + '.boolean') === 'true' }),
    fill_blank: () => ({ kind, values: question.content.blanks!.map((_, index) => String(form.get(`${question.id}.blank.${index}`))) }),
    short_answer: () => ({ kind, text: String(form.get(question.id + '.text')) }),
  }
  return readers[kind]()
}
