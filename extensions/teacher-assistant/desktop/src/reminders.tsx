import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import { DELIVERY_STATES, type BackgroundStatus, type Page, type ReminderDelivery, type ReminderSettings } from './reminder-api'
import { TeacherTodos } from './teacher-todos'

interface Props { route: PluginProfileRoute }
interface SettingsProps extends Props { settings: ReminderSettings }

function ReminderPolicy({ route, settings }: SettingsProps) {
  const queryClient = useQueryClient()
  const save = useMutation({ mutationFn: (data: object) => call(route, 'reminder.set_settings', data, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const lead = (key: string) => form.get(key) === '' ? null : Number(form.get(key))
    save.mutate({ version: settings.version, enabled: form.has('enabled'), preclass_minutes: lead('preclass_minutes'),
      preparation_minutes: lead('preparation_minutes'), exam_minutes: lead('exam_minutes'),
      break_lead_minutes: lead('break_lead_minutes'), end_lead_minutes: lead('end_lead_minutes'), late_grace_minutes: Number(form.get('late_grace_minutes')) })
  }
  return <form aria-label="提醒设置" onSubmit={submit} className="grid max-w-3xl gap-3">
    <label><input type="checkbox" name="enabled" aria-label="启用教学提醒" defaultChecked={settings.enabled} />启用教学提醒</label>
    <p>课表提醒的提前分钟留空可关闭该类提醒。后台任务每分钟检查到期项目，电脑关机或退出 Windows 登录后暂停。</p>
    {([['preclass_minutes', '课前提前分钟'], ['preparation_minutes', '备课提前分钟'], ['exam_minutes', '考试提前分钟'], ['break_lead_minutes', '课间提前分钟'], ['end_lead_minutes', '下课提前分钟']] as const).map(([name, label]) => <label key={name}>{label}<input type="number" name={name} aria-label={label} min={0} max={10080} defaultValue={settings[name] ?? ''} /></label>)}
    <label>允许补发分钟<input type="number" name="late_grace_minutes" aria-label="允许补发分钟" min={0} max={10080} defaultValue={settings.late_grace_minutes} required /></label>
    <Button type="submit" disabled={save.isPending}>保存提醒设置</Button>
    {save.isSuccess && <p role="status">提醒设置已保存</p>}
    {save.error && <p role="alert">{save.error.message}</p>}
  </form>
}

export function Reminders({ route }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [backgroundVisible, setBackgroundVisible] = useState(false)
  const policy = useQuery({ queryKey: [...routeKey(route), 'reminder-settings'], queryFn: () => call<ReminderSettings>(route, 'reminder.settings'), refetchInterval: 30000 })
  const deliveries = useQuery({ queryKey: [...routeKey(route), 'reminder-deliveries', offset], queryFn: () => call<Page<ReminderDelivery>>(route, 'reminder.list', { offset, limit: 20 }), refetchInterval: 30000 })
  const background = useQuery({ queryKey: [...routeKey(route), 'reminder-background'], queryFn: () => call<BackgroundStatus>(route, 'reminder.background.status'), enabled: backgroundVisible })
  const action = useMutation({ mutationFn: ({ operation, data = {} }: { operation: string; data?: object }) => call(route, operation, data, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) })
  const test = useMutation({ mutationFn: () => call<{ history_contains_tag?: boolean }>(route, 'reminder.test', {}, crypto.randomUUID()) })
  return <section aria-label="提醒与待办" className="space-y-6">
    <h2 className="text-xl font-semibold">提醒与待办</h2>
    {policy.data && <ReminderPolicy key={policy.data.version} route={route} settings={policy.data} />}
    <section aria-label="提醒后台" className="space-y-3">
      <h3>Windows 后台</h3>
      <p>启用后台会为当前 Windows 用户创建每分钟运行的任务，调用当前教师配置的 Hermes 原生定时器。关闭 Desktop 后继续检查提醒。</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={action.isPending} onClick={() => { setBackgroundVisible(true); action.mutate({ operation: 'reminder.background.install' }) }}>启用或修复后台</Button>
        <Button variant="secondary" disabled={action.isPending} onClick={() => { setBackgroundVisible(true); action.mutate({ operation: 'reminder.background.remove' }) }}>停用后台</Button>
        <Button variant="secondary" onClick={() => { setBackgroundVisible(true); void background.refetch() }}>刷新后台状态</Button>
        <Button variant="secondary" disabled={test.isPending} onClick={() => test.mutate()}>发送本机测试通知</Button>
      </div>
      {background.data && <div><p>Windows任务{background.data.windows.installed ? (background.data.windows.enabled ? '已启用' : '已停用') : '尚未安装'} · Hermes任务{background.data.cron?.enabled ? '已启用' : '未启用'}</p>
        <p>最近检查 {background.data.last_tick_at?.replace('T', ' ') ?? '尚无记录'}</p>
        {background.data.windows.next_run_at && <p>下次后台检查 {background.data.windows.next_run_at.replace('T', ' ')}</p>}
        {background.data.windows.last_result !== undefined && <p>Windows最近运行结果码 {background.data.windows.last_result}</p>}
        {background.data.last_tick_error && <p role="alert">{background.data.last_tick_error}</p>}
        {background.data.cron?.last_error && <p role="alert">{background.data.cron.last_error}</p>}
      </div>}
      {test.isSuccess && <p role="status">Windows已接受测试通知{test.data.history_contains_tag ? '，已在本机通知历史核对' : ''}</p>}
      <p>系统接受记录后仍可能受专注模式或系统显示设置影响，阅读状态由用户确认。</p>
    </section>
    <TeacherTodos route={route} />
    <section aria-label="提醒记录" className="space-y-3">
      <h3>提醒记录</h3>
      <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate({ operation: 'reminder.refresh' })}>按最新课表和待办刷新提醒</Button>
      {policy.data && <p>教学提醒{policy.data.enabled ? '已开启' : '已关闭'} · 最近检查 {policy.data.last_tick_at?.replace('T', ' ') ?? '尚无记录'}</p>}
      {deliveries.data?.items.map(item => <article key={item.id} className="space-y-1 rounded border border-(--ui-border) p-3">
        <p>{item.title} · {DELIVERY_STATES[item.state]}</p><p>{item.due_at.replace('T', ' ')} · {item.body}</p>
        {item.error_code && <p role="alert">{item.error_code}</p>}
        {['failed', 'dispatching'].includes(item.state) && <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate({ operation: 'reminder.retry', data: { id: item.id } })}>重新排队此提醒</Button>}
      </article>)}
      {deliveries.data?.total === 0 && <p>尚无提醒记录，可按最新课表和待办刷新。</p>}
      <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页提醒</Button><Button variant="secondary" disabled={deliveries.data?.next_offset == null} onClick={() => setOffset(deliveries.data?.next_offset ?? 0)}>下一页提醒</Button></div>
    </section>
    {[policy.error, deliveries.error, background.error, action.error, test.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
