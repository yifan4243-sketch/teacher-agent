import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { BlueprintContent, BlueprintDocument, SlideTheme } from './blueprint-api'
import { SlideImages } from './slide-images'

const LAYOUTS = [['single_column', '单栏'], ['two_column', '双栏'], ['three_column', '三栏'], ['comparison', '对比'], ['timeline', '时间线'], ['table', '表格']]

export function BlueprintEditor({ route, documentId, onVersion }: { route: PluginProfileRoute; documentId: string; onVersion: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [pageNumber, setPageNumber] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const document = useQuery({ queryKey: [...routeKey(route), 'blueprint', documentId], queryFn: () => call<BlueprintDocument>(route, 'document.get', { id: documentId }) })
  const themes = useQuery({ queryKey: [...routeKey(route), 'slide-themes'], queryFn: () => call<{ items: SlideTheme[] }>(route, 'slide.themes') })
  const prompt = useMutation({ mutationFn: () => call<{ prompt: string }>(route, 'slide.prompt', { id: documentId, page_number: pageNumber }) })
  const write = useMutation({
    mutationFn: ({ operation, data }: { operation: string; data: object }) => call<BlueprintDocument>(route, operation, data, crypto.randomUUID()),
    onSuccess: async saved => { await queryClient.invalidateQueries({ queryKey: routeKey(route) }); onVersion(saved.id) },
  })
  const saved = document.data
  const page = saved?.content.pages.find(page => page.number === pageNumber)
  function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saved) return
    const form = new FormData(event.currentTarget)
    const content: BlueprintContent = structuredClone(saved.content)
    content.theme = String(form.get('theme'))
    content.pages = content.pages.map(page => page.number === pageNumber ? { ...page, title: String(form.get('title')),
      key_messages: String(form.get('messages')).split('\n').filter(message => message.trim()), duration_minutes: Number(form.get('minutes')),
      teacher_notes: String(form.get('notes')), layout: String(form.get('layout')), visual_requirements: String(form.get('visual_requirements')) } : page)
    write.mutate({ operation: 'document.save', data: { lesson_id: saved.lesson_id, kind: 'slide_blueprint', expected_version: saved.version,
      script_id: saved.script_id, plan_id: saved.plan_id, content } })
  }
  return <article className="space-y-4" aria-label="课件蓝图编辑与审核">
    {saved && <>
      <h3 className="text-lg font-semibold">{saved.content.title} · v{saved.version} · {saved.status === 'approved' ? '已审核' : saved.status === 'rejected' ? '已退回' : '草稿'}</h3>
      <p>关联授课稿 {saved.script_id} · 教案 {saved.plan_id}</p>
      <ol className="space-y-2">{saved.content.pages.map(page => <li key={page.number}>
        <Button variant={page.number === pageNumber ? 'secondary' : 'ghost'} onClick={() => { setPageNumber(page.number); prompt.reset() }}>第{page.number}页 {page.title} · 第{page.unit_index + 1}单元 · {page.duration_minutes}分钟</Button>
      </li>)}</ol>
    </>}
    {saved && page && themes.data && <form key={`${saved.id}:${page.number}`} onSubmit={savePage} className="grid max-w-4xl gap-3">
      <label>课件主题<select aria-label="课件主题" name="theme" defaultValue={saved.content.theme}>{themes.data?.items.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
      <label>页面标题<input aria-label="页面标题" name="title" defaultValue={page.title} maxLength={60} required /></label>
      <label>准确可见文字<textarea aria-label="准确可见文字" name="messages" defaultValue={page.key_messages.join('\n')} className="min-h-32 w-full rounded border border-(--ui-border) p-3" required /></label>
      <label>页面教学分钟<input aria-label="页面教学分钟" name="minutes" type="number" min={0.1} max={40} step={0.1} defaultValue={page.duration_minutes} required /></label>
      <label>页面布局<select aria-label="页面布局" name="layout" defaultValue={page.layout}>{LAYOUTS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>教师备注<textarea aria-label="页面教师备注" name="notes" defaultValue={page.teacher_notes} className="w-full rounded border border-(--ui-border) p-3" required /></label>
      <label>视觉要求<textarea aria-label="页面视觉要求" name="visual_requirements" defaultValue={page.visual_requirements} className="w-full rounded border border-(--ui-border) p-3" /></label>
      <p>教材来源 {page.source_ids.join('、')}</p><p>知识点 {page.knowledge_point_ids.join('、')}</p>
      <p>授课稿环节 {page.script_references.map(reference => `${reference.unit_index + 1}单元${reference.segment_index + 1}环节`).join('、')}</p>
      {page.visuals.map((visual, index) => <p key={index}>图解要求 {visual.description}</p>)}
      <Button type="submit" disabled={write.isPending}>保存页面为蓝图新版本</Button>
    </form>}
    {page && <Button disabled={prompt.isPending} onClick={() => prompt.mutate()}>查看自动生图提示词</Button>}
    {prompt.data && <textarea aria-label="自动生图提示词" readOnly value={prompt.data.prompt} className="min-h-64 w-full rounded border border-(--ui-border) p-3" />}
    {saved?.status === 'draft' && <div className="space-y-3">
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对全部页面的文字、来源和教学环节</label>
      <Button disabled={!confirmed || write.isPending} onClick={() => write.mutate({ operation: 'document.review', data: { id: documentId, decision: 'approved' } })}>审核通过蓝图版本</Button>
    </div>}
    {saved?.status === 'approved' && <SlideImages key={saved.id} route={route} blueprint={saved} />}
    {[document.error, themes.error, prompt.error, write.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </article>
}
