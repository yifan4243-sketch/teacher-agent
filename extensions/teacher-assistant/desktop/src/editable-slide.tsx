import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { downloadSlides, OBJECT_LABELS, PAGE_LABELS, type EditablePage } from './reconstruction-api'
import { SlideRenderPreview } from './slide-render-preview'

interface Props {
  route: PluginProfileRoute
  pageId: string
  onVersion: (pageId: string) => void
}

export function EditableSlide({ route, pageId, onVersion }: Props) {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const page = useQuery({ queryKey: [...routeKey(route), 'editable-page', pageId], queryFn: () => call<EditablePage>(route, 'slide.page.get', { id: pageId }) })
  const saved = page.data
  const element = saved?.layout.elements[index]
  const revise = useMutation({
    mutationFn: (layout: object) => call<EditablePage>(route, 'slide.page.revise', { id: pageId, layout }, crypto.randomUUID()),
    onSuccess: async updated => { await queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'slide-pages'] }); onVersion(updated.id) },
  })
  const review = useMutation({
    mutationFn: (data: object) => call(route, 'slide.page.review', { id: pageId, ...data }, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  const download = useMutation({ mutationFn: () => downloadSlides(route, saved?.status === 'approved' ? 'slide.page.export' : 'slide.page.preview_export', pageId) })
  function saveElement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saved || !element) return
    const form = new FormData(event.currentTarget)
    const layout = structuredClone(saved.layout)
    const edited = layout.elements[index]
    edited.x = Number(form.get('x'))
    edited.y = Number(form.get('y'))
    edited.width = Number(form.get('width'))
    edited.height = Number(form.get('height'))
    if (edited.kind === 'text') edited.text = String(form.get('text'))
    if (edited.kind === 'text' || edited.kind === 'table') {
      edited.font_size = Number(form.get('font_size'))
      edited.color = String(form.get('color'))
    }
    if (edited.kind === 'table') {
      edited.rows = edited.rows!.map((row, rowIndex) => row.map((_, columnIndex) => String(form.get(`cell-${rowIndex}-${columnIndex}`))))
    }
    if (edited.kind === 'shape') {
      edited.fill = String(form.get('fill')) || null
      edited.line_color = String(form.get('line_color')) || null
    }
    if (edited.kind === 'image') {
      edited.source_x = Number(form.get('source_x'))
      edited.source_y = Number(form.get('source_y'))
      edited.source_width = Number(form.get('source_width'))
      edited.source_height = Number(form.get('source_height'))
      edited.description = String(form.get('description'))
    }
    revise.mutate(layout)
  }
  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    review.mutate({ note: String(form.get('note')), decision: form.get('decision') })
  }
  return <article className="space-y-3" aria-label="可编辑页面对象">
    {saved && <>
      <h4>可编辑第{saved.page_number}页 · v{saved.version} · {PAGE_LABELS[saved.status]}</h4>
      <p>页面对象 {Object.entries(saved.object_counts).map(([kind, count]) => `${OBJECT_LABELS[kind]} ${count}`).join(' · ')}</p>
      <p>文字、形状、连接线与表格为原生对象。照片和复杂插画保存为独立裁切图片，支持移动、缩放和裁切。坐标与尺寸采用原图像素。</p>
      {saved.text_check.missing_text.map((text, i) => <p role="alert" key={i}>页面缺少蓝图文字 {text}</p>)}
      <label>编辑页面对象<select aria-label="编辑页面对象" value={index} onChange={event => setIndex(Number(event.target.value))}>
        {saved.layout.elements.map((element, i) => <option key={element.name} value={i}>{element.name} · {OBJECT_LABELS[element.kind]}</option>)}
      </select></label>
      {element && <form key={`${pageId}:${element.name}`} onSubmit={saveElement} className="grid max-w-3xl gap-2">
        {([['x', '水平位置'], ['y', '垂直位置'], ['width', '宽度'], ['height', '高度']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={`对象${label}`} type="number" name={key} min={key === 'x' || key === 'y' ? 0 : 0.01} step="0.01" defaultValue={element[key]} required /></label>)}
        {element.kind === 'text' && <label>对象文字<textarea aria-label="对象文字" name="text" defaultValue={element.text} maxLength={5000} className="min-h-28 w-full rounded border border-(--ui-border) p-3" required /></label>}
        {element.kind === 'table' && <fieldset className="grid gap-2"><legend>表格单元格</legend>{element.rows!.map((row, rowIndex) => <div className="flex flex-wrap gap-2" key={rowIndex}>{row.map((cell, columnIndex) => <label key={columnIndex}>第{rowIndex + 1}行第{columnIndex + 1}列<input aria-label={`表格第${rowIndex + 1}行第${columnIndex + 1}列`} name={`cell-${rowIndex}-${columnIndex}`} defaultValue={cell} maxLength={2000} /></label>)}</div>)}</fieldset>}
        {(element.kind === 'text' || element.kind === 'table') && <>
          <label>对象字号<input aria-label="对象字号" name="font_size" type="number" min="8" max={element.kind === 'table' ? 100 : 160} step="0.1" defaultValue={element.font_size} required /></label>
          <label>对象文字颜色<input aria-label="对象文字颜色" name="color" pattern="[0-9A-Fa-f]{6}" defaultValue={element.color} required /></label>
        </>}
        {element.kind === 'shape' && <>
          <label>对象填充颜色<input aria-label="对象填充颜色" name="fill" pattern="[0-9A-Fa-f]{6}" defaultValue={element.fill ?? ''} /></label>
          <label>对象边线颜色<input aria-label="对象边线颜色" name="line_color" pattern="[0-9A-Fa-f]{6}" defaultValue={element.line_color ?? ''} /></label>
        </>}
        {element.kind === 'image' && <fieldset className="grid gap-2"><legend>原图裁切区域</legend>
          {([['source_x', '裁切水平位置'], ['source_y', '裁切垂直位置'], ['source_width', '裁切宽度'], ['source_height', '裁切高度']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={label} name={key} type="number" min={key === 'source_x' || key === 'source_y' ? 0 : 1} step="0.01" defaultValue={element[key]} required /></label>)}
          <label>图片说明<input aria-label="图片说明" name="description" defaultValue={element.description} maxLength={500} required /></label>
        </fieldset>}
        <Button type="submit" disabled={revise.isPending}>保存页面对象为新版本</Button>
      </form>}
      <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>{saved.status === 'approved' ? '下载单页可编辑PPTX' : '下载单页草稿PPTX'}</Button>
      <SlideRenderPreview route={route} pageId={pageId} assetId={saved.asset_id} />
      {saved.status === 'draft' && <form onSubmit={approve} className="grid max-w-3xl gap-2">
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />已核对原生文字、图形、表格、位置及教材内容</label>
        <label>可编辑页面审核结果<select name="decision" aria-label="可编辑页面审核结果"><option value="approved">通过</option><option value="rejected">退回修订</option></select></label>
        <label>可编辑页面审核意见<input aria-label="可编辑页面审核意见" name="note" maxLength={2000} required /></label>
        <Button type="submit" disabled={!confirmed || review.isPending}>审核通过可编辑页面</Button>
      </form>}
    </>}
    {[page.error, revise.error, review.error, download.error].filter(Boolean).map((error, i) => <p role="alert" key={i}>{error?.message}</p>)}
  </article>
}
