import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { call, routeKey } from './api'
import { EditableSlide } from './editable-slide'
import type { ImageJob } from './image-api'
import { downloadSlides, PAGE_LABELS, type EditablePageSummary } from './reconstruction-api'

interface Props { route: PluginProfileRoute; blueprintId: string }

export function ReconstructionWorkspace({ route, blueprintId }: Props) {
  const queryClient = useQueryClient()
  const [analysisId, setAnalysisId] = useState('')
  const [pageId, setPageId] = useState('')
  const [offset, setOffset] = useState(0)
  const analyses = useQuery({ queryKey: [...routeKey(route), 'images', blueprintId, 'layout-analyses', offset], queryFn: () => call<{ items: ImageJob[]; next_offset: number | null }>(route, 'slide.image.list', { blueprint_id: blueprintId, limit: 100, offset }), refetchInterval: 3000 })
  const pages = useQuery({ queryKey: [...routeKey(route), 'slide-pages', blueprintId], queryFn: () => call<{ items: EditablePageSummary[] }>(route, 'slide.page.list', { blueprint_id: blueprintId, limit: 100 }) })
  const create = useMutation({
    mutationFn: async () => {
      const job = analyses.data?.items.find(item => item.id === analysisId)
      if (!job) throw new Error('请先选择已完成的识别任务')
      const history = await call<{ items: EditablePageSummary[] }>(route, 'slide.page.list', { blueprint_id: blueprintId, page_number: job.page_number, limit: 1 })
      const previous = history.items[0]
      return call<EditablePageSummary>(route, 'slide.page.from_analysis', { id: analysisId, expected_version: previous?.version ?? 0 }, crypto.randomUUID())
    },
    onSuccess: async page => { await queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'slide-pages'] }); setPageId(page.id) },
  })
  const download = useMutation({ mutationFn: () => downloadSlides(route, 'slide.deck.export', blueprintId) })
  return <section aria-label="图片转可编辑课件" className="space-y-4">
    <h3 className="text-lg font-semibold">图片转可编辑课件</h3>
    <p>复用已完成的视觉布局识别，教师先审核设计图，再建立可编辑页面。完整导出逐页选择最新已审核版本。</p>
    <label>视觉布局任务<select aria-label="视觉布局任务" value={analysisId} onChange={event => setAnalysisId(event.target.value)}>
      <option value="">选择已完成的识别任务</option>{analyses.data?.items.filter(job => job.kind === 'analysis' && job.state === 'succeeded').map(job => <option key={job.id} value={job.id}>第{job.page_number}页 · {job.id}</option>)}
    </select></label>
    <div className="flex gap-2">
      <Button variant="secondary" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 100)); setAnalysisId('') }}>上一组识别记录</Button>
      <Button variant="secondary" disabled={analyses.data?.next_offset == null} onClick={() => { setOffset(analyses.data?.next_offset ?? offset); setAnalysisId('') }}>下一组识别记录</Button>
    </div>
    <Button disabled={!analysisId || create.isPending} onClick={() => create.mutate()}>从识别布局建立可编辑页面</Button>
    <label>可编辑页面版本<select aria-label="可编辑页面版本" value={pageId} onChange={event => setPageId(event.target.value)}>
      <option value="">选择可编辑页面</option>{pages.data?.items.map(page => <option key={page.id} value={page.id}>第{page.page_number}页 · v{page.version} · {PAGE_LABELS[page.status]}</option>)}
    </select></label>
    {pageId && <EditableSlide key={pageId} route={route} pageId={pageId} onVersion={setPageId} />}
    <Button disabled={download.isPending} onClick={() => download.mutate()}>下载完整可编辑PPTX</Button>
    {[analyses.error, pages.error, create.error, download.error].filter(Boolean).map((error, i) => <p role="alert" key={i}>{error?.message}</p>)}
  </section>
}
