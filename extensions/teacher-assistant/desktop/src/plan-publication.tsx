import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'
import { call, routeKey } from './api'
import { publishPlan, type Publication, type PublicationLink } from './timetable-api'

interface Props { route: PluginProfileRoute; planId: string; latest: boolean; current: PublicationLink | null }

export function PlanPublication({ route, planId, latest, current }: Props) {
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const publication = useQuery({ queryKey: [...routeKey(route), 'publication', current?.id], queryFn: () => call<Publication>(route, 'calendar.publication', { id: current!.id }), enabled: !!current })
  const publish = useMutation({ mutationFn: (note: string) => publishPlan(route, planId, current?.id ?? null, note), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); publish.mutate(String(new FormData(event.currentTarget).get('note'))) }
  return <section aria-label="计划发布与课表" className="space-y-3">
    <h4>计划发布与课表</h4>
    {current && <p>{current.plan_id === planId ? '当前计划版本已发布到实际课表' : '同一学期已有其他版本的实际课表'}</p>}
    {publication.data && <p>已发布{publication.data.progress.total_sessions}课次 · 已完成{publication.data.progress.completed_sessions}课次 · 实际教学{publication.data.progress.actual_instruction_minutes}分钟 · 与已完成课次原计划相差{publication.data.progress.instruction_variance_minutes}分钟</p>}
    {latest && current?.plan_id !== planId && <form onSubmit={submit} className="grid max-w-3xl gap-2">
      <p>发布后课次进入课表。替换同一学期旧版本时保留可对应的调课与进度，无法对应时会拦截；旧发布记录保留快照。跨课程时间冲突会阻止整次发布。</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />已核对实际日期、章节与课时，确认发布并保留旧记录</label>
      <label>发布审核说明<input name="note" aria-label="发布审核说明" maxLength={2000} required /></label>
      <Button type="submit" disabled={!confirmed || publish.isPending}>审核并发布到课表</Button>
    </form>}
    {!latest && current?.plan_id !== planId && <p>该计划已有更新版本，请选择最新版本发布。</p>}
    {[publication.error, publish.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
