import { host, type PluginProfileRoute } from '@hermes/plugin-sdk'

export interface TeacherRecord {
  id: string
  version: number
  archived: boolean
  title?: string
  name?: string
  subject?: string
  level?: string
  objectives?: string
  academic_year?: string
  student_number?: string
  class_id?: string
  period_minutes?: number
  period_count?: number
  break_minutes?: number
  instruction_minutes?: number
  session_span_minutes?: number
}

export interface TeachingTask {
  id: string
  status: string
  version: number
  kind: string
  input: { title: string }
  error: string | null
  steps: { step_key: string; completed_at: string }[]
  approval: { status: string; note: string } | null
}

export interface TeacherSettings {
  agent_student_access: boolean
  disabled_operations: string[]
  stage_models: Record<string, { provider: string; model: string }>
}

interface Response<T> {
  ok: boolean
  data: T
  error?: { code: string; message: string }
}

export async function call<T>(route: PluginProfileRoute, operation: string, data: object = {}, requestId?: string): Promise<T> {
  const response = await host.requestProfile<Response<T>>(route, 'plugin.teacher-assistant.call', {
    operation,
    data,
    request_id: requestId,
  })
  if (!response.ok) {
    throw new Error(response.error?.message ?? '教师服务未能完成操作')
  }
  return response.data
}

export function routeKey(route: PluginProfileRoute) {
  return ['teacher-assistant', route.connectionId, route.profile, route.targetProfile]
}
