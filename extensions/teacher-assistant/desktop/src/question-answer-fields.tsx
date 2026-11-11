import { Button } from '@hermes/plugin-sdk'
import type { Dispatch, SetStateAction } from 'react'

import type { QuestionContent, QuestionKind } from './question-api'

interface Props {
  kind: QuestionKind
  original?: QuestionContent
  options: NonNullable<QuestionContent['options']>
  setOptions: Dispatch<SetStateAction<Props['options']>>
  blanks: NonNullable<QuestionContent['blanks']>
  setBlanks: Dispatch<SetStateAction<Props['blanks']>>
  rubric: { label: string; points: string }[]
  setRubric: Dispatch<SetStateAction<Props['rubric']>>
}

export function QuestionAnswerFields({ kind, original, options, setOptions, blanks, setBlanks, rubric, setRubric }: Props) {
  return <>
    {['single_choice', 'multiple_choice'].includes(kind) && <>
      {options.map((option, index) => <fieldset key={index} className="space-y-2"><legend>选项{index + 1}</legend>
        <label>标识<input aria-label={`选项标识 ${index + 1}`} value={option.id} pattern="[A-H]" maxLength={1} required onChange={event => setOptions(current => current.map((item, i) => i === index ? { ...item, id: event.target.value.toUpperCase() } : item))} /></label>
        <label>正文<textarea aria-label={`选项正文 ${index + 1}`} value={option.text} maxLength={3000} required onChange={event => setOptions(current => current.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} /></label>
        <Button type="button" variant="secondary" disabled={options.length <= 2} onClick={() => setOptions(current => current.filter((_, i) => i !== index))}>移除此选项</Button>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={options.length >= 8} onClick={() => setOptions(current => [...current, { id: 'ABCDEFGH'.split('').find(id => !current.some(item => item.id === id))!, text: '' }])}>增加选项</Button>
      <label>正确选项（多个字母用逗号分隔）<input name="answer_ids" aria-label="正确选项" defaultValue={original?.answer_ids?.join(',') ?? 'A'} required /></label>
    </>}
    {kind === 'true_false' && <label>标准答案<select name="answer" aria-label="判断题答案" defaultValue={String(original?.answer ?? true)}><option value="true">正确</option><option value="false">错误</option></select></label>}
    {kind === 'fill_blank' && <>
      <p>题干用{'{{1}}'}、{'{{2}}'}等连续标识填空位置，每空可填写多个接受答案。</p>
      {blanks.map((blank, index) => <fieldset key={index} className="space-y-2"><legend>第{index + 1}空</legend>
        {blank.accepted.map((answer, alternative) => <div key={alternative} className="flex gap-2"><label>可接受答案<textarea aria-label={`第${index + 1}空答案 ${alternative + 1}`} value={answer} maxLength={2000} required onChange={event => setBlanks(current => current.map((item, i) => i === index ? { accepted: item.accepted.map((value, j) => j === alternative ? event.target.value : value) } : item))} /></label>
          <Button type="button" variant="secondary" disabled={blank.accepted.length <= 1} onClick={() => setBlanks(current => current.map((item, i) => i === index ? { accepted: item.accepted.filter((_, j) => j !== alternative) } : item))}>移除此答案</Button></div>)}
        <Button type="button" variant="secondary" disabled={blank.accepted.length >= 20} onClick={() => setBlanks(current => current.map((item, i) => i === index ? { accepted: [...item.accepted, ''] } : item))}>增加可接受答案</Button>
        <Button type="button" variant="secondary" disabled={blanks.length <= 1} onClick={() => setBlanks(current => current.filter((_, i) => i !== index))}>移除此空</Button>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={blanks.length >= 20} onClick={() => setBlanks(current => [...current, { accepted: [''] }])}>增加填空位置</Button>
    </>}
    {kind === 'short_answer' && <>
      <label>参考答案<textarea name="reference_answer" aria-label="简答题参考答案" defaultValue={original?.reference_answer ?? ''} maxLength={12000} required /></label>
      {rubric.map((item, index) => <fieldset key={index} className="space-y-2"><legend>评分细则{index + 1}</legend>
        <label>评分要点<textarea aria-label={`评分要点 ${index + 1}`} value={item.label} maxLength={3000} required onChange={event => setRubric(current => current.map((value, i) => i === index ? { ...value, label: event.target.value } : value))} /></label>
        <label>分值<input type="number" aria-label={`评分要点分值 ${index + 1}`} value={item.points} min="0.01" max="1000" step="0.01" required onChange={event => setRubric(current => current.map((value, i) => i === index ? { ...value, points: event.target.value } : value))} /></label>
        <Button type="button" variant="secondary" disabled={rubric.length <= 1} onClick={() => setRubric(current => current.filter((_, i) => i !== index))}>移除此评分要点</Button>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={rubric.length >= 30} onClick={() => setRubric(current => [...current, { label: '', points: '1' }])}>增加评分要点</Button>
    </>}
  </>
}
