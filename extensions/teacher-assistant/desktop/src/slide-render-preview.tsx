import { Button, host, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { downloadRender, fitMeasuredText, generateRender, type ImagePreview, type RenderJob } from './render-api'

interface Props { route: PluginProfileRoute; pageId: string; assetId: string | null; onVersion: (pageId: string) => void }
interface ComparisonProps { route: PluginProfileRoute; job: RenderJob; assetId: string | null; onVersion: (pageId: string) => void }

function RenderComparison({ route, job, assetId, onVersion }: ComparisonProps) {
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const previews = useQuery({
    queryKey: [...routeKey(route), 'render-comparison', job.id, assetId],
    queryFn: async () => {
      if (!assetId) {
        return [{ label: 'PPTX实际渲染图', ...await call<ImagePreview>(route, 'slide.render.preview', { id: job.id, variant: 'rendered' }) }]
      }
      const [reference, rendered, difference] = await Promise.all([
        call<ImagePreview>(route, 'slide.image.preview', { id: assetId }),
        call<ImagePreview>(route, 'slide.render.preview', { id: job.id, variant: 'rendered' }),
        call<ImagePreview>(route, 'slide.render.preview', { id: job.id, variant: 'difference' }),
      ])
      return [{ label: '原始设计图', ...reference }, { label: 'PPTX实际渲染图', ...rendered }, { label: '像素差异图', ...difference }]
    },
    enabled: visible,
    staleTime: Infinity,
  })
  const download = useMutation({ mutationFn: (variant: string) => downloadRender(route, job.id, variant) })
  const repair = useMutation({
    mutationFn: (minimum: number) => fitMeasuredText(route, job, minimum),
    onSuccess: async result => {
      if (result.changed) {
        if (result.preview_error) host.notify({ kind: 'error', message: '修复草稿已保存，预览生成失败。请在新版本中重试。', detail: result.preview_error })
        await queryClient.invalidateQueries({ queryKey: routeKey(route) })
        onVersion(result.page.id)
      }
    },
    retry: false,
  })
  function fit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    repair.mutate(Number(new FormData(event.currentTarget).get('minimum')))
  }
  return <div className="space-y-3">
    {job.comparison.reference_sha256 && <p>RGB平均绝对差 {job.comparison.mean_absolute_rgb_error?.toFixed(2)} · 通道差值大于32的像素占比 {new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 }).format(job.comparison.pixels_above_32_fraction!)}</p>}
    <p>{job.comparison.review_note}</p>
    {job.comparison.text_bounds && <p>已测量文字区域 {job.comparison.text_bounds.measured_regions} · 超框区域 {job.comparison.text_bounds.overflow_regions} · 缺少测量 {job.comparison.text_bounds.missing_regions}</p>}
    <form onSubmit={fit} className="grid gap-2">
      <label>修复最小字号（原图像素）<input aria-label="修复最小字号（原图像素）" name="minimum" type="number" min="8" max="160" step="0.1" defaultValue="32" required /></label>
      <Button type="submit" disabled={repair.isPending || !job.comparison.text_bounds?.measured_regions}>按实测字号修复并生成预览</Button>
    </form>
    {repair.data && !repair.data.changed && <p role="status">已检查{repair.data.report.measured_regions}个文字区域，{repair.data.report.minimum_limited.length}个对象受到最小字号限制，{repair.data.report.missing_regions}个区域缺少测量。</p>}
    <Button variant="secondary" onClick={() => setVisible(value => !value)}>{visible ? '收起渲染对照' : assetId ? '查看渲染对照' : '查看实际渲染'}</Button>
    {visible && previews.isPending && <p role="status">正在读取实际渲染图</p>}
    {visible && previews.data && <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>{previews.data.map(preview => <figure key={preview.label}>
      <figcaption>{preview.label}</figcaption><img className="w-full rounded" alt={preview.label} src={`data:${preview.mime_type};base64,${preview.content_base64}`} />
    </figure>)}</div>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate('rendered')}>下载实际渲染PNG</Button>
      {job.comparison.reference_sha256 && <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate('difference')}>下载像素差异PNG</Button>}
    </div>
    {[previews.error, download.error, repair.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}

export function SlideRenderPreview({ route, pageId, assetId, onVersion }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const key = [...routeKey(route), 'slide-renders', pageId]
  const jobs = useQuery({
    queryKey: [...key, offset], queryFn: () => call<{ items: RenderJob[]; next_offset: number | null }>(route, 'slide.render.list', { id: pageId, offset }),
    refetchInterval: query => query.state.data?.items.some(job => ['queued', 'running'].includes(job.state)) ? 3000 : false,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const generate = useMutation({ mutationFn: ({ renderer, force }: { renderer: string; force: boolean }) => generateRender(route, pageId, renderer, force, refresh), retry: false, onSettled: refresh })
  function render(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    generate.mutate({ renderer: String(form.get('renderer')), force: form.has('force') })
  }
  const states = { queued: '待渲染', running: '渲染中', succeeded: '渲染完成', failed: '渲染失败' }
  const engines: Record<string, string> = { wps: 'WPS演示', powerpoint: 'Microsoft PowerPoint' }
  const errors: Record<string, string> = { office_unavailable: '所选办公软件未能启动', office_render_failed: '办公软件渲染失败，请检查软件状态', render_timeout: '渲染超时，请检查办公软件状态', render_file_access_failed: '预览文件无法保存，请检查磁盘和权限', render_response_invalid: '办公软件未返回有效预览，请查看运行日志', file_integrity_error: '渲染所需文件未通过完整性校验', render_execution_failed: '渲染执行失败，请查看运行日志' }
  return <section aria-label="实际渲染与设计图对照" className="space-y-4">
    <h4 className="font-semibold">实际渲染与设计图对照</h4>
    <p>使用运行Hermes的Windows主机上已安装的办公软件生成预览，绑定当前页面版本。可在草稿阶段检查排版。</p>
    <form onSubmit={render} className="grid gap-2">
      <label>本地渲染软件<select name="renderer" aria-label="本地渲染软件"><option value="wps">WPS演示</option><option value="powerpoint">Microsoft PowerPoint</option></select></label>
      <label className="flex gap-2"><input type="checkbox" name="force" />新建本页渲染任务，保留此前预览</label>
      <Button type="submit" disabled={generate.isPending}>生成实际页面预览</Button>
    </form>
    <Button variant="secondary" onClick={() => void refresh()}>刷新渲染任务</Button>
    {jobs.data?.items.map(job => <article key={job.id} className="space-y-3 rounded border border-(--ui-border) p-3">
      <p>{states[job.state]} · {engines[job.renderer]} {job.renderer_version ?? ''}</p>
      {job.error_code && <p role="alert">{errors[job.error_code] ?? job.error_code}</p>}
      {job.state === 'succeeded' && <RenderComparison route={route} job={job} assetId={assetId} onVersion={onVersion} />}
    </article>)}
    <div className="flex gap-2">
      <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一组渲染记录</Button>
      <Button variant="secondary" disabled={jobs.data?.next_offset == null} onClick={() => setOffset(jobs.data?.next_offset ?? offset)}>下一组渲染记录</Button>
    </div>
    {[jobs.error, generate.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
