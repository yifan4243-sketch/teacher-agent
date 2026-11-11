import { Button, useMutation, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call } from './api'
import type { Plan, SessionContent } from './planning'
import type { BookVersion } from './textbook-api'

interface Props { route: PluginProfileRoute; plan: Plan; book: BookVersion; onSaved: (plan: Plan) => void }
const KINDS: Record<string, string> = { teaching: '教学', practice: '练习', review: '复习', exam: '考核' }

export function PlanContentEditor({ route, plan, book, onSaved }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState<SessionContent[]>(() => plan.sessions.map(session => ({ kind: session.kind, chapter_id: session.chapter_id, title: session.title })))
  const selected = new Set(plan.config.chapters.map(chapter => chapter.chapter_id))
  const chapters = book.chapters.filter(chapter => selected.size ? selected.has(chapter.id) : !chapter.parent_id)
  const save = useMutation({ mutationFn: (data: object) => call<Plan>(route, 'plan.save', data, crypto.randomUUID()), onSuccess: onSaved })
  function move(index: number, step: number) {
    setContent(current => {
      const next = [...current]
      const destination = index + step
      const previous = next[index]
      next[index] = next[destination]
      next[destination] = previous
      return next
    })
  }
  function revise(index: number, update: Partial<SessionContent>) { setContent(current => current.map((item, ordinal) => ordinal === index ? { ...item, ...update } : item)) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const config: Record<string, unknown> = { ...plan.config }
    delete config.time_basis
    delete config.course_timing
    save.mutate({ ...config, course_id: plan.course_id, textbook_version_id: plan.textbook_version_id, parent_id: plan.id, session_content: content })
  }
  return <section aria-label="人工调整章节进度" className="space-y-3">
    <Button variant="secondary" onClick={() => setExpanded(value => !value)}>{expanded ? '收起课次内容调整' : '调整章节进度与课次内容'}</Button>
    {expanded && <form onSubmit={submit} className="space-y-3">
      <p>上移或下移可交换课次内容，授课日期使用当前校历。教学课次可以重新分配章节，所选章节均需覆盖。保存会建立待发布的新版本。</p>
      <p>{chapters.map(chapter => `${chapter.title} ${content.filter(item => item.chapter_id === chapter.id).length}次`).join(' · ')}</p>
      {content.map((item, index) => <fieldset key={index} className="space-y-2 rounded border border-(--ui-border) p-3">
        <legend>第{index + 1}次课 · {plan.sessions[index].starts_at.replace('T', ' ')} · {KINDS[item.kind]}</legend>
        {item.kind === 'teaching' && <label>教材章节<select aria-label={`课次章节 ${index + 1}`} value={item.chapter_id ?? ''} onChange={event => revise(index, { chapter_id: event.target.value, title: chapters.find(chapter => chapter.id === event.target.value)?.title ?? item.title })}>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>}
        <label>课次内容<input aria-label={`课次内容 ${index + 1}`} value={item.title} maxLength={200} required onChange={event => revise(index, { title: event.target.value })} /></label>
        <div className="flex gap-2"><Button type="button" variant="secondary" aria-label={`上移第${index + 1}次课内容`} disabled={index === 0} onClick={() => move(index, -1)}>上移</Button><Button type="button" variant="secondary" aria-label={`下移第${index + 1}次课内容`} disabled={index === content.length - 1} onClick={() => move(index, 1)}>下移</Button></div>
      </fieldset>)}
      <Button type="submit" disabled={save.isPending || plan.version !== plan.latest_version}>保存内容调整新版本</Button>
      {plan.version !== plan.latest_version && <p>请选择最新计划版本后调整内容。</p>}
      {save.error && <p role="alert">{save.error.message}</p>}
    </form>}
  </section>
}
