import { captureGatewayFileDownload, host, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call, type TeachingTask } from './api'
import type { BlueprintContent } from './blueprint-api'

export interface Lesson {
  id: string
  title: string
  course_id: string
  version_id: string
}

export interface Segment {
  title: string
  purpose: string
  minutes: number
  spoken_text: string
  activity_minutes: number
  teacher_actions: string[]
  student_activity: string
  blackboard: string
  source_ids: string[]
}

export interface ScriptContent {
  title: string
  speech_characters_per_minute: number
  units: { title: string; segments: Segment[] }[]
  homework: string[]
}

export interface PlanActivity {
  unit_index: number
  segment_index: number
  teacher_activity: string
  student_activity: string
  methods: string
}

export interface PlanContent {
  title: string
  objectives: string
  key_points: string
  difficulties: string
  preparation: string
  activities: PlanActivity[]
  summary: string
  values_education: string
  homework: string
  blackboard: string
  teaching_week: string
  session_number: number
  lesson_numbers: string
  total_lessons: number | null
}

export interface TeachingDocument {
  id: string
  lesson_id: string
  kind: 'script' | 'lesson_plan' | 'slide_blueprint'
  version: number
  status: string
  script_id: string | null
  content: ScriptContent | PlanContent | BlueprintContent
  timing?: { estimated_units_minutes: number[]; warnings: string[]; method: string }
}

export interface Generation {
  workflow_id: string
  prompt: string
  kind: 'script' | 'lesson_plan' | 'slide_blueprint'
  model: { provider?: string; model?: string }
  stored_session_id: string | null
  runtime_session_id: string | null
  document_id: string | null
  task: TeachingTask
}

export async function openGeneration(route: PluginProfileRoute, generation: Generation) {
  if (generation.task.status !== 'pending') {
    if (!generation.stored_session_id) throw new Error('此任务尚未绑定Agent会话')
    await host.openSession(generation.stored_session_id, { route, profile: route.profile, intent: 'tab', awaitHydration: true })
    return
  }
  const release = await host.retainProfile(route, { spawnPriority: 'foreground' })
  try {
    const session = await host.requestProfile<{ session_id: string; stored_session_id: string }>(route, 'session.create', {
      profile: route.targetProfile, title: generation.task.input.title, request_id: generation.workflow_id,
      ...generation.model,
    })
    await call(route, 'document.generation.claim', { id: generation.workflow_id, runtime_session_id: session.session_id, stored_session_id: session.stored_session_id }, `${generation.workflow_id}:claim`)
    // Claim before dispatch. A lost submit response requires inspecting this same chat, never an automatic second paid turn.
    await host.requestProfile(route, 'prompt.submit', { session_id: session.session_id, text: generation.prompt, input_id: generation.workflow_id }, 120000)
    await host.openSession(session.stored_session_id, { route, profile: route.profile, intent: 'tab', awaitHydration: true, hydrationTimeoutMs: 90000 })
  } finally {
    release()
  }
}

export async function downloadDocument(route: PluginProfileRoute, documentId: string) {
  const save = captureGatewayFileDownload()
  const exported = await call<{ stored_path: string; filename: string }>(route, 'document.export', { id: documentId }, crypto.randomUUID())
  await save(exported.stored_path, exported.filename)
}
