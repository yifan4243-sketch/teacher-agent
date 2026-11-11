import { captureGatewayFileDownload, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'
import type { ExamGeneration } from './exam-api'
import type { QuestionKind } from './question-api'

export interface StudentAnswer {
  question_id: string
  content: { kind: QuestionKind; selected_ids?: string[]; answer?: boolean | null; values?: string[]; text?: string }
}
export interface SubmissionSummary {
  id: string; root_id: string; version: number; student_id: string; class_id: string; note: string; name: string; student_number: string
}
export interface Submission extends SubmissionSummary {
  paper_id: string; answers: StudentAnswer[]; latest_version: number; latest_draft_id: string | null
}
export interface DraftScore {
  question_id: string; kind: QuestionKind; max_points_centi: number; automatic_points_centi: number | null
  proposed_points_centi: number | null; rubric_awards: number[]; comment: string; confidence: number | null; method: string
}
export interface GradeDraft {
  id: string; submission_id: string; version: number; latest_version: number; current_grade_id: string | null; published_grade_id: string | null
  report: { scores: DraftScore[]; objective_points_centi: number; subjective_count: number }
}
export interface GradeSummary {
  id: string; paper_id: string; student_id: string; class_id: string; total_points_centi: number; name: string; student_number: string; title: string; created_at: string
}
export interface PublishedGrade extends GradeSummary {
  submission_id: string; draft_id: string; previous_id: string | null; active: number; note: string; reviewed_by: string
  scores: { question_id: string; points_centi: number; rubric_awards: number[]; comment: string }[]
  wrong_questions: { question_id: string; lost_points_centi: number }[]
}
export interface GradingGeneration extends Omit<ExamGeneration, 'plan_id' | 'paper_id'> {
  base_draft_id: string; result_draft_id: string | null
}

export function answerText(content: StudentAnswer['content']) {
  if (content.selected_ids) return content.selected_ids.join('、') || '未作答'
  if (content.values) return content.values.map((value, index) => `第${index + 1}空 ${value || '未作答'}`).join(' · ')
  if (content.kind === 'true_false') return content.answer == null ? '未作答' : content.answer ? '正确' : '错误'
  return content.text || '未作答'
}

export async function downloadGradeReport(route: PluginProfileRoute, id: string, format: string) {
  const save = captureGatewayFileDownload()
  const exported = await call<{ stored_path: string; filename: string }>(route, 'grade.export', { id, format }, crypto.randomUUID())
  await save(exported.stored_path, exported.filename)
}
