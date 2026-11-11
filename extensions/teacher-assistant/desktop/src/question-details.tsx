import { Button, useMutation, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey } from './api'
import { DIFFICULTIES, QUESTION_KINDS, QUESTION_STATUS, type Question } from './question-api'

interface Props { route: PluginProfileRoute; question: Question; onEdit?: () => void }

export function QuestionDetails({ route, question, onEdit }: Props) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const review = useMutation({ mutationFn: (decision: string) => call(route, 'question.review', { id: question.id, decision, note }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const content = question.content
  return <section aria-label="题目详情与审核" className="space-y-3 rounded border border-(--ui-border) p-4">
    <h3>{QUESTION_KINDS[question.kind]} · v{question.version} · {QUESTION_STATUS[question.status]}</h3>
    <p>{DIFFICULTIES[question.difficulty]} · {(question.points_centi / 100).toFixed(2)}分</p>
    <p className="whitespace-pre-wrap">{content.prompt}</p>
    {content.options?.map(option => <p key={option.id} className="whitespace-pre-wrap">{option.id} · {option.text}{content.answer_ids?.includes(option.id) ? '（正确选项）' : ''}</p>)}
    {content.kind === 'true_false' && <p>标准答案 {content.answer ? '正确' : '错误'}</p>}
    {content.blanks?.map((blank, index) => <p key={index}>第{index + 1}空接受答案 {blank.accepted.join(' / ')}</p>)}
    {content.reference_answer && <p className="whitespace-pre-wrap">参考答案 {content.reference_answer}</p>}
    {content.rubric?.map((item, index) => <p key={index}>评分要点 {(item.points_centi / 100).toFixed(2)}分 · {item.label}</p>)}
    <p className="whitespace-pre-wrap">解析 {content.explanation}</p>
    <details><summary>教材原文依据 · {question.sources.length}条</summary>{question.sources.map(source => <article key={source.id} className="my-2 space-y-1"><p>{source.filename} · v{source.version} · {source.locator}</p><p className="whitespace-pre-wrap">{source.text}</p></article>)}</details>
    {question.duplicates.length > 0 && <p role="status">题干归一化后与其他{question.duplicates.length}道题重复，请核对使用目的与答案。</p>}
    {question.reviewed_at && <p>审核记录 {question.review_note || '教师已复核'} · {question.reviewed_at}</p>}
    {onEdit && question.version === question.latest_version && <Button variant="secondary" onClick={onEdit}>修订此题目</Button>}
    {question.status === 'draft' && <div className="grid gap-3">
      <label>审核说明（选填）<textarea aria-label="题目审核说明" value={note} maxLength={4000} onChange={event => setNote(event.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={review.isPending} onClick={() => review.mutate('approved')}>通过题目审核</Button><Button variant="secondary" disabled={review.isPending} onClick={() => review.mutate('rejected')}>退回题目修改</Button></div>
    </div>}
    {review.error && <p role="alert">{review.error.message}</p>}
  </section>
}
