import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { BlueprintDocument } from './blueprint-api'
import { runImage, runQueuedImages, usd, type ImageBudget, type ImageJob } from './image-api'
import { SlideImagePreview } from './slide-image-preview'

interface Props {
  route: PluginProfileRoute
  blueprint: BlueprintDocument
}

export function SlideImages({ route, blueprint }: Props) {
  const queryClient = useQueryClient()
  const [pageNumber, setPageNumber] = useState(blueprint.content.pages[0].number)
  const [offset, setOffset] = useState(0)
  const [costAcknowledged, setCostAcknowledged] = useState(false)
  const key = [...routeKey(route), 'images', blueprint.id]
  const budget = useQuery({ queryKey: [...key, 'budget'], queryFn: () => call<ImageBudget>(route, 'slide.image.budget', { blueprint_id: blueprint.id }), refetchInterval: 3000 })
  const jobs = useQuery({
    queryKey: [...key, 'jobs', offset], queryFn: () => call<{ items: ImageJob[]; total: number; next_offset: number | null }>(route, 'slide.image.list', { blueprint_id: blueprint.id, offset }),
    refetchInterval: 3000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const setBudget = useMutation({ mutationFn: (micro: number) => call(route, 'slide.image.set_budget', { blueprint_id: blueprint.id, budget_micro_usd: micro }, crypto.randomUUID()), onSettled: refresh })
  const reserve = useMutation({
    mutationFn: async ({ pages, estimate, allowed, force }: { pages: number[]; estimate: number; allowed: boolean; force: boolean }) => {
      for (const number of pages) {
        await call(route, 'slide.image.reserve', { id: blueprint.id, page_number: number, estimated_micro_usd: estimate, allow_model_call: allowed, force_regenerate: force }, crypto.randomUUID())
        // Each committed reservation is visible even when a later page exceeds the budget.
        await refresh()
      }
    },
    onSettled: refresh,
  })
  const execute = useMutation({ mutationFn: (job: ImageJob) => runImage(route, job), retry: false, onSettled: refresh })
  const executeBatch = useMutation({ mutationFn: () => runQueuedImages(route, blueprint.id, refresh), retry: false, onSettled: refresh })
  const analyze = useMutation({
    mutationFn: ({ assetId, estimate }: { assetId: string; estimate: number }) => call(route, 'slide.image.reserve_analysis', {
      id: assetId, estimated_micro_usd: estimate, allow_model_call: true,
    }, crypto.randomUUID()),
    onSettled: refresh,
  })
  const cancel = useMutation({ mutationFn: (job: ImageJob) => call(route, 'slide.image.abandon', { id: job.id, acknowledge_possible_cost: costAcknowledged }, crypto.randomUUID()), onSettled: refresh })
  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBudget.mutate(Math.round(Number(new FormData(event.currentTarget).get('budget')) * 1_000_000))
  }
  function reservePages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const pages = form.get('scope') === 'all' ? blueprint.content.pages.map(page => page.number) : [pageNumber]
    reserve.mutate({ pages, estimate: Math.round(Number(form.get('estimate')) * 1_000_000), allowed: form.has('allow'), force: form.has('force') })
  }
  function reserveAnalysis(event: FormEvent<HTMLFormElement>, assetId: string) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    analyze.mutate({ assetId, estimate: Math.round(Number(form.get('analysis-estimate')) * 1_000_000) })
  }
  const states = { queued: '待执行', running: '执行中，勿重复调用', succeeded: '已生成', failed: '失败', cancelled: '已取消', cached: '复用缓存' }
  return <section className="space-y-4" aria-label="AI逐页设计图片">
    <h3 className="text-lg font-semibold">AI逐页设计图片</h3>
    <p>已审核蓝图 → 自动合成提示词 → Hermes原生生图服务。每次外部调用前先预留费用。</p>
    {budget.data && <>
      <p role="status">预算 {usd(budget.data.budget_micro_usd)} · 待执行预留 {usd(budget.data.reserved_micro_usd)} · 已记录 {usd(budget.data.spent_micro_usd)}</p>
      <p>{budget.data.cost_basis}</p>
      <form onSubmit={saveBudget} className="flex flex-wrap items-end gap-2">
        <label>本蓝图预算（美元）<input aria-label="本蓝图预算（美元）" name="budget" type="number" min="0" max="1000000" step="0.000001" defaultValue={budget.data.budget_micro_usd / 1_000_000} required /></label>
        <Button type="submit" disabled={setBudget.isPending}>保存图片任务预算</Button>
      </form>
    </>}
    <form onSubmit={reservePages} className="grid max-w-3xl gap-3">
      <label>图片页码<select aria-label="图片页码" value={pageNumber} onChange={event => setPageNumber(Number(event.target.value))}>{blueprint.content.pages.map(page => <option key={page.number} value={page.number}>第{page.number}页 {page.title}</option>)}</select></label>
      <label>预留范围<select name="scope" aria-label="图片预留范围"><option value="single">当前页</option><option value="all">全部页面，依页序预留</option></select></label>
      <label>单页估算费用（美元）<input name="estimate" aria-label="单页估算费用（美元）" type="number" min="0.000001" max="1000" step="0.000001" required /></label>
      <label className="flex gap-2"><input type="checkbox" name="allow" />授权所选页面调用当前配置的生图服务并接受估算费用，实际账单以服务商为准</label>
      <label className="flex gap-2"><input type="checkbox" name="force" />重新生成所选页面并另计费用，保留历史图片</label>
      <Button type="submit" disabled={reserve.isPending}>预留所选图片任务</Button>
    </form>
    <p>已有缓存时可直接复用。任务执行期间可切换页面，刷新后可查询持久状态。连接超时后请先查询原任务。</p>
    <label className="flex gap-2"><input type="checkbox" checked={costAcknowledged} onChange={event => setCostAcknowledged(event.target.checked)} />确认运行中的请求可能已计费，取消将停止采纳结果，迟到图片保留在历史记录</label>
    <Button variant="secondary" onClick={() => void refresh()}>刷新图片任务</Button>
    <Button disabled={execute.isPending || executeBatch.isPending || !jobs.data?.total} onClick={() => executeBatch.mutate()}>依次执行已预留的待执行任务</Button>
    {jobs.data?.items.map(job => <article key={job.id} aria-label={`第${job.page_number}页图片任务 ${job.id}`} className="space-y-3 rounded border border-(--ui-border) p-4">
      <h4>第{job.page_number}页{job.kind === 'analysis' ? '文字与布局识别' : ''} · {states[job.state]}</h4>
      <p className="break-all">任务 {job.id}</p>
      <p>预估 {usd(job.estimated_micro_usd)}{job.reported_micro_usd !== null ? ` · 服务报告 ${usd(job.reported_micro_usd)}` : ''} · {job.provider ?? '尚无服务结果'} · {job.model ?? ''}</p>
      {job.error_code && <p role="alert">错误记录 {job.error_code}</p>}
      {job.state === 'queued' && <Button disabled={execute.isPending || executeBatch.isPending} onClick={() => execute.mutate(job)}>{job.kind === 'analysis' ? '执行此页文字与布局识别' : '执行此页图片生成'}</Button>}
      {['queued', 'running'].includes(job.state) && <Button variant="secondary" disabled={cancel.isPending || !!job.attempted && !costAcknowledged} onClick={() => cancel.mutate(job)}>取消此图片任务</Button>}
      {job.assets.map(asset => <SlideImagePreview key={asset.id} route={route} asset={asset} selected={asset.id === job.asset_id} />)}
      {job.kind === 'generation' && ['succeeded', 'cached'].includes(job.state) && job.asset_id && <form onSubmit={event => reserveAnalysis(event, job.asset_id!)} className="grid gap-2">
        <label>视觉检查估算费用（美元）<input name="analysis-estimate" aria-label="视觉检查估算费用（美元）" type="number" min="0.000001" max="1000" step="0.000001" required /></label>
        <label className="flex gap-2"><input type="checkbox" required />授权将当前设计图发送给课件阶段视觉模型并接受估算费用，识别结果同时用于后续可编辑课件重建</label>
        <Button type="submit" disabled={analyze.isPending}>预留此页文字与布局识别</Button>
      </form>}
      {job.analysis.text_check && <div className="space-y-2">
        <p>{job.analysis.text_check === 'matched_extracted_text' ? '提取文字与蓝图逐字匹配，待教师复核' : '提取文字与蓝图存在差异，需要核对或重做'}</p>
        {job.analysis.missing_text?.map((text, index) => <p role="alert" key={index}>未匹配原文 {text}</p>)}
        <p>{job.analysis.review_note}</p>
      </div>}
    </article>)}
    <div className="flex gap-2">
      <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一组图片任务</Button>
      <Button variant="secondary" disabled={jobs.data?.next_offset == null} onClick={() => setOffset(jobs.data?.next_offset ?? offset)}>下一组图片任务</Button>
    </div>
    {[budget.error, jobs.error, setBudget.error, reserve.error, analyze.error, execute.error, executeBatch.error, cancel.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
