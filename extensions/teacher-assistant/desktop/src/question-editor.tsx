import { Button, useMutation, useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { QuestionAnswerFields } from './question-answer-fields'
import { DIFFICULTIES, QUESTION_KINDS, scoreCenti, type Question, type QuestionKind } from './question-api'
import type { KnowledgePoint, Page, Source, Textbook } from './textbook-api'

interface Props { route: PluginProfileRoute; courseId: string; versionId: string; question?: Question; onSaved: (question: Question) => void }

export function QuestionEditor({ route, courseId, versionId, question, onSaved }: Props) {
  const original = question?.content
  const [chosenVersionId, setChosenVersionId] = useState(versionId)
  const [kind, setKind] = useState<QuestionKind>(original?.kind ?? 'single_choice')
  const [selectedSources, setSelectedSources] = useState<string[]>(original?.source_ids ?? [])
  const [selectedPoints, setSelectedPoints] = useState<string[]>(original?.knowledge_point_ids ?? [])
  const [sourceOffset, setSourceOffset] = useState(0)
  const [pointOffset, setPointOffset] = useState(0)
  const [options, setOptions] = useState(original?.options ?? [{ id: 'A', text: '' }, { id: 'B', text: '' }])
  const [blanks, setBlanks] = useState(original?.blanks ?? [{ accepted: [''] }])
  const [rubric, setRubric] = useState(() => original?.rubric?.map(item => ({ label: item.label, points: String(item.points_centi / 100) })) ?? [{ label: '', points: '5' }])
  const books = useQuery({ queryKey: [...routeKey(route), 'textbooks', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }) })
  const sources = useQuery({ queryKey: [...routeKey(route), 'question-source-options', chosenVersionId, sourceOffset], queryFn: () => call<Page<Source>>(route, 'source.list', { version_id: chosenVersionId, offset: sourceOffset, limit: 10 }) })
  const points = useQuery({ queryKey: [...routeKey(route), 'question-point-options', chosenVersionId, pointOffset], queryFn: () => call<Page<KnowledgePoint>>(route, 'knowledge.list', { version_id: chosenVersionId, offset: pointOffset, limit: 20 }) })
  const save = useMutation({ mutationFn: (data: object) => call<Question>(route, 'question.save', data, crypto.randomUUID()), onSuccess: onSaved })
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const text = (key: string) => String(form.get(key) ?? '')
    const choice = () => ({ options, answer_ids: text('answer_ids').toUpperCase().split(/[\s,，]+/).filter(Boolean) })
    const answerFields: Record<QuestionKind, () => object> = {
      single_choice: choice, multiple_choice: choice, true_false: () => ({ answer: text('answer') === 'true' }),
      fill_blank: () => ({ blanks }),
      short_answer: () => ({ reference_answer: text('reference_answer'), rubric: rubric.map(item => ({ label: item.label, points_centi: scoreCenti(item.points) })) }),
    }
    try {
      save.mutate({ course_id: courseId, textbook_version_id: chosenVersionId, root_id: question?.root_id ?? null, expected_version: question?.version ?? 0,
        content: { kind, prompt: text('prompt'), explanation: text('explanation'), difficulty: text('difficulty'), points_centi: scoreCenti(text('points')),
          source_ids: selectedSources, knowledge_point_ids: selectedPoints, ...answerFields[kind]() } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : '请检查题目输入') }
  }
  return <form aria-label="题目编辑" onSubmit={submit} className="grid max-w-4xl gap-3 rounded border border-(--ui-border) p-4">
    <h3>{question ? `修订题目 · 当前v${question.version}` : '新建题目'}</h3>
    <label>题目教材版本<select aria-label="题目教材版本" value={chosenVersionId} onChange={event => { setChosenVersionId(event.target.value); setSelectedSources([]); setSelectedPoints([]); setSourceOffset(0); setPointOffset(0) }}>{books.data?.items.flatMap(book => book.versions.map(version => <option key={version.id} value={version.id}>{book.title} · v{version.version}</option>))}</select></label>
    <label>题型<select aria-label="题目类型" value={kind} onChange={event => setKind(event.target.value as QuestionKind)}>{Object.entries(QUESTION_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>题干<textarea name="prompt" aria-label="题目正文" maxLength={6000} defaultValue={original?.prompt ?? ''} required /></label>
    <label>题目分值<input type="number" name="points" aria-label="题目分值" min="0.01" max="1000" step="0.01" defaultValue={(original?.points_centi ?? 500) / 100} required /></label>
    <label>难度<select name="difficulty" aria-label="题目难度" defaultValue={original?.difficulty ?? 'medium'}>{Object.entries(DIFFICULTIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <QuestionAnswerFields kind={kind} original={original} options={options} setOptions={setOptions} blanks={blanks} setBlanks={setBlanks} rubric={rubric} setRubric={setRubric} />
    <label>答案解析<textarea name="explanation" aria-label="题目解析" maxLength={12000} defaultValue={original?.explanation ?? ''} required /></label>
    <fieldset className="space-y-2"><legend>教材原文依据 · 已选{selectedSources.length}条，最多30条</legend>{sources.data?.items.map(source => <label key={source.id} className="flex items-start gap-2"><input type="checkbox" aria-label={`题目来源 ${source.locator}`} checked={selectedSources.includes(source.id)} onChange={event => setSelectedSources(current => event.target.checked ? [...current, source.id] : current.filter(id => id !== source.id))} /><span>{source.locator}<br />{source.text}</span></label>)}</fieldset>
    <div className="flex gap-2"><Button type="button" variant="secondary" disabled={sourceOffset === 0} onClick={() => setSourceOffset(value => Math.max(0, value - 10))}>上一组题目来源</Button><Button type="button" variant="secondary" disabled={sources.data?.next_offset == null} onClick={() => setSourceOffset(sources.data?.next_offset ?? 0)}>下一组题目来源</Button></div>
    <fieldset className="space-y-2"><legend>关联知识点 · 已选{selectedPoints.length}项，选择对应原文后勾选</legend>{points.data?.items.map(point => <label key={point.id} className="flex gap-2"><input type="checkbox" aria-label={`题目知识点 ${point.title}`} disabled={!selectedSources.includes(point.source_id) && !selectedPoints.includes(point.id)} checked={selectedPoints.includes(point.id)} onChange={event => setSelectedPoints(current => event.target.checked ? [...current, point.id] : current.filter(id => id !== point.id))} />{point.title}</label>)}</fieldset>
    <div className="flex gap-2"><Button type="button" variant="secondary" disabled={pointOffset === 0} onClick={() => setPointOffset(value => Math.max(0, value - 20))}>上一组题目知识点</Button><Button type="button" variant="secondary" disabled={points.data?.next_offset == null} onClick={() => setPointOffset(points.data?.next_offset ?? 0)}>下一组题目知识点</Button></div>
    <Button type="submit" disabled={save.isPending || selectedSources.length === 0 || selectedSources.length > 30 || (question && question.version !== question.latest_version)}>保存题目草稿</Button>
    {error && <p role="alert">{error}</p>}
    {[books.error, sources.error, points.error, save.error].filter(Boolean).map((reason, index) => <p role="alert" key={index}>{reason?.message}</p>)}
  </form>
}
