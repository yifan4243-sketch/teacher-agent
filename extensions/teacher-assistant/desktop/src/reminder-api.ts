export interface ReminderSettings {
  version: number
  enabled: boolean
  preclass_minutes: number | null
  preparation_minutes: number | null
  exam_minutes: number | null
  late_grace_minutes: number
  last_tick_at: string | null
  last_tick_error: string | null
}

export interface TeacherTodo {
  id: string
  version: number
  title: string
  details: string
  kind: string
  course_id: string | null
  due_at: string
  lead_minutes: number
  status: string
}

export interface ReminderDelivery {
  id: string
  title: string
  body: string
  due_at: string
  state: string
  error_code: string | null
  receipt: { history_contains_tag?: boolean }
}

export interface Page<T> { items: T[]; total: number; next_offset: number | null }

export interface BackgroundStatus {
  cron_job_id: string | null
  cron: { enabled: boolean; last_status: string | null; last_error: string | null } | null
  windows: { installed: boolean; enabled?: boolean; last_result?: number; next_run_at?: string }
  last_tick_at: string | null
  last_tick_error: string | null
}

export const TODO_KINDS: Record<string, string> = { homework: '作业', exam: '考试', preparation: '备课', personal: '个人事务' }
export const TODO_STATES: Record<string, string> = { pending: '待完成', completed: '已完成', cancelled: '已取消' }
export const DELIVERY_STATES: Record<string, string> = { queued: '等待发送', dispatching: '正在发送或发送中断', accepted: 'Windows已接受', failed: '发送失败', expired: '已过补发窗口', cancelled: '来源已变更' }
