import { Button, Input, useMutation, useQuery, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { Lesson } from './preparation-api'
import type { Page, Source, Textbook } from './textbook-api'

export function LessonEditor({ route, courseId, onSaved }: { route: PluginProfileRoute; courseId: string; onSaved: (lesson: Lesson) => void }) {
  const [versionId, setVersionId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const books = useQuery({ queryKey: [...routeKey(route), 'textbooks', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }) })
  const sources = useQuery({ queryKey: [...routeKey(route), 'lesson-sources', versionId, offset], queryFn: () => call<Page<Source>>(route, 'source.list', { version_id: versionId, offset, limit: 20 }), enabled: !!versionId })
  const save = useMutation({ mutationFn: (data: object) => call<Lesson>(route, 'lesson.create', data, crypto.randomUUID()), onSuccess: onSaved })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({ course_id: courseId, version_id: versionId, source_ids: selected,
      title: String(form.get('title')), objectives: String(form.get('objectives')), key_points: String(form.get('key_points')), difficulties: String(form.get('difficulties')) })
  }
  return <details className="rounded border border-(--ui-border) p-4"><summary>创建教材关联课次</summary>
    <form onSubmit={submit} className="mt-4 grid max-w-3xl gap-3">
      <label>课次名称<Input aria-label="课次名称" name="title" required maxLength={200} /></label>
      <label>课次教学目标<Input aria-label="课次教学目标" name="objectives" maxLength={12000} /></label>
      <label>课次教学重点<Input aria-label="课次教学重点" name="key_points" maxLength={12000} /></label>
      <label>课次教学难点<Input aria-label="课次教学难点" name="difficulties" maxLength={12000} /></label>
      <label>课次教材版本<select aria-label="课次教材版本" value={versionId} onChange={event => { setVersionId(event.target.value); setSelected([]); setOffset(0) }} required>
        <option value="">选择固定教材版本</option>{books.data?.items.flatMap(book => book.versions.map(version => <option value={version.id} key={version.id}>{book.title} · v{version.version}</option>))}
      </select></label>
      <fieldset className="space-y-3"><legend>选取本课次原文依据 · 已选 {selected.length} 条，最多100条</legend>
        {sources.data?.items.map(source => <label key={source.id} className="flex items-start gap-2">
          <input type="checkbox" aria-label={`选择来源 ${source.locator}`} checked={selected.includes(source.id)} onChange={event => setSelected(event.target.checked ? [...selected, source.id] : selected.filter(id => id !== source.id))} />
          <span>{source.text}<span className="block text-sm">{source.locator}</span></span>
        </label>)}
      </fieldset>
      {sources.data && <div className="flex gap-2"><Button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一组来源</Button><Button type="button" disabled={sources.data.next_offset == null} onClick={() => setOffset(sources.data?.next_offset ?? 0)}>下一组来源</Button></div>}
      <Button type="submit" disabled={save.isPending || selected.length === 0 || selected.length > 100}>保存课次与教材依据</Button>
    </form>
    {[books.error, sources.error, save.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </details>
}
