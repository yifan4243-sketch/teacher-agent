import { captureGatewayFileDownload, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call, type TeachingTask } from './api'
import type { Question, QuestionKind } from './question-api'

export interface ExamConfig {
  chapter_ids: string[]; knowledge_point_ids: string[]; completed_only: boolean
  question_types: { kind: QuestionKind; count: number }[]
  difficulties: { difficulty: string; count: number }[]
  total_points_centi: number; duration_minutes: number; coverage_percent: number; student_level: string
}
export interface ExamPlan {
  id: string; root_id: string; version: number; latest_version: number; course_id: string; textbook_version_id: string; title: string; config: ExamConfig
  scope: { source_ids: string[]; knowledge_points: { id: string; title: string }[]; progress_events: { id: string }[]; textbook_title: string; textbook_version: number }
}
export interface ExamReport {
  question_count: number; total_points_centi: number; coverage_percent: number | null; scope_point_count: number; covered_point_ids: string[]
}
export interface ExamSummary {
  id: string; root_id: string; version: number; plan_id: string; title: string; status: string; report: ExamReport
}
export interface ExamPaper extends ExamSummary {
  latest_version: number; plan: ExamPlan; questions: Question[]; review_note: string | null; reviewed_at: string | null
}
export interface ExamGeneration {
  workflow_id: string; plan_id: string; prompt: string; model: { provider?: string; model?: string }
  stored_session_id: string | null; runtime_session_id: string | null; paper_id: string | null; task: TeachingTask
}

export async function downloadExam(route: PluginProfileRoute, id: string, audience: string, format: string) {
  const save = captureGatewayFileDownload()
  const exported = await call<{ stored_path: string; filename: string }>(route, 'exam.export', { id, audience, format }, crypto.randomUUID())
  await save(exported.stored_path, exported.filename)
}
