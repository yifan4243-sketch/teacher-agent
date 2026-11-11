import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { ImagePreview } from './render-api'

interface Reference { id: string; label: string; sha256: string; width: number; height: number; archived: number }
interface Props { route: PluginProfileRoute; blueprintId: string; selected: string; onSelect: (id: string) => void }

export function SlideReferences({ route, blueprintId, selected, onSelect }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const key = [...routeKey(route), 'slide-references', blueprintId]
  const references = useQuery({ queryKey: [...key, offset], queryFn: () => call<{ items: Reference[]; next_offset: number | null }>(route, 'slide.reference.list', { blueprint_id: blueprintId, offset, limit: 20 }) })
  const preview = useQuery({ queryKey: [...key, 'preview', selected], queryFn: () => call<ImagePreview>(route, 'slide.reference.preview', { id: selected }), enabled: !!selected })
  const upload = useMutation({
    mutationFn: async ({ file, label, note }: { file: File; label: string; note: string }) => {
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('参考图大小需大于0且不超过2MB')
      const bytes = await file.arrayBuffer()
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(new Error('无法读取所选参考图'))
        reader.readAsDataURL(file)
      })
      return call<Reference>(route, 'slide.reference.upload', { blueprint_id: blueprintId, label, source_note: note, content_base64: encoded, sha256: digest }, crypto.randomUUID())
    },
    onSuccess: async reference => { await queryClient.invalidateQueries({ queryKey: key }); onSelect(reference.id) },
  })
  const archive = useMutation({
    mutationFn: () => call(route, 'slide.reference.archive', { id: selected }, crypto.randomUUID()),
    onSuccess: async () => { onSelect(''); await queryClient.invalidateQueries({ queryKey: key }) },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    if (file instanceof File) upload.mutate({ file, label: String(form.get('label')), note: String(form.get('note')) })
  }
  return <section aria-label="可选参考素材" className="space-y-3">
    <h4>可选参考素材</h4>
    <p>不选择素材时系统自动设计。上传仅保存在本地；预留生图任务时，需另行授权发送所选图片。归档不删除历史素材或撤销已授权任务。</p>
    <form onSubmit={submit} className="grid max-w-3xl gap-2">
      <label>参考素材名称<input name="label" aria-label="参考素材名称" maxLength={120} required /></label>
      <label>参考素材来源说明<input name="note" aria-label="参考素材来源说明" maxLength={1000} /></label>
      <label>参考图片（最大2MB）<input name="file" aria-label="参考图片" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
      <Button type="submit" disabled={upload.isPending}>保存参考素材到本地</Button>
    </form>
    <label>本次生图参考<select aria-label="本次生图参考" value={selected} onChange={event => onSelect(event.target.value)}>
      <option value="">自动设计，不使用参考图</option>{references.data?.items.map(reference => <option value={reference.id} key={reference.id} disabled={!!reference.archived}>{reference.label} · {reference.width}×{reference.height}{reference.archived ? ' · 已归档' : ''}</option>)}
      {selected && !references.data?.items.some(reference => reference.id === selected) && <option value={selected}>当前已选素材</option>}
    </select></label>
    {selected && preview.data && <img alt="可选参考图片预览" className="max-w-lg rounded" src={`data:${preview.data.mime_type};base64,${preview.data.content_base64}`} />}
    <div className="flex gap-2">
      <Button variant="secondary" disabled={!selected || archive.isPending} onClick={() => archive.mutate()}>归档所选参考素材</Button>
      <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一组参考素材</Button>
      <Button variant="secondary" disabled={references.data?.next_offset == null} onClick={() => setOffset(references.data?.next_offset ?? offset)}>下一组参考素材</Button>
    </div>
    {[references.error, preview.error, upload.error, archive.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
