import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { downloadImage, type ImageAsset } from './image-api'

interface Props {
  route: PluginProfileRoute
  asset: ImageAsset
  selected: boolean
}

export function SlideImagePreview({ route, asset, selected }: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const preview = useQuery({
    queryKey: [...routeKey(route), 'image-preview', asset.id],
    queryFn: () => call<{ content_base64: string; mime_type: string }>(route, 'slide.image.preview', { id: asset.id }),
    enabled: expanded,
    staleTime: Infinity,
  })
  const download = useMutation({ mutationFn: () => downloadImage(route, asset.id) })
  const review = useMutation({
    mutationFn: (data: object) => call(route, 'slide.image.review', data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'images'] }),
  })
  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    review.mutate({ id: asset.id, expected_version: asset.review_version, decision: form.get('decision'), note: form.get('note') })
  }
  const statuses: Record<string, string> = { needs_text_review: '待核对文字和图解', approved: '教师已通过', rejected: '教师已退回', aspect_ratio_mismatch: '原图比例需规范化' }
  return <div className="space-y-3 rounded border border-(--ui-border) p-3">
    <p>{asset.source_asset_id ? '16∶9等比留边版本' : '模型高清原图'} · {asset.width}×{asset.height} · {statuses[asset.verification_status] ?? asset.verification_status}{selected ? ' · 当前结果' : ''}</p>
    <p className="break-all text-sm">SHA-256 {asset.sha256}</p>
    {asset.source_asset_id && <p>原始像素完整保留，另存留边版本。处理记录 {asset.processing_json}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setExpanded(value => !value)}>{expanded ? '收起设计图' : '预览设计图'}</Button>
      <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>下载高清图片</Button>
    </div>
    {expanded && preview.isPending && <p role="status">正在读取设计图</p>}
    {expanded && preview.data && <img alt="教学页面设计预览" className="w-full rounded" src={`data:${preview.data.mime_type};base64,${preview.data.content_base64}`} />}
    {selected && <form onSubmit={submitReview} className="grid gap-2">
      <label>图片核对结论<select name="decision" aria-label="图片核对结论" defaultValue="approved"><option value="approved">通过</option><option value="rejected">退回重做</option></select></label>
      <label>图片核对意见<input name="note" aria-label="图片核对意见" maxLength={2000} required /></label>
      <label className="flex gap-2"><input type="checkbox" required />已逐字核对蓝图文字、教材依据、图解关系和投影可读性</label>
      <Button type="submit" disabled={review.isPending}>保存图片核对结论</Button>
    </form>}
    {[preview.error, download.error, review.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}
