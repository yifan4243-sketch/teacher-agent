import type { Source } from './textbook-api'

export type QuestionKind = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
export interface QuestionContent {
  kind: QuestionKind; prompt: string; explanation: string; points_centi: number; difficulty: string; source_ids: string[]; knowledge_point_ids: string[]
  options?: { id: string; text: string }[]; answer_ids?: string[]; answer?: boolean
  blanks?: { accepted: string[] }[]; reference_answer?: string; rubric?: { label: string; points_centi: number }[]
}
export interface QuestionSummary {
  id: string; root_id: string; version: number; course_id: string; textbook_version_id: string; kind: QuestionKind
  difficulty: string; points_centi: number; prompt: string; status: string
}
export interface Question extends QuestionSummary {
  latest_version: number; content: QuestionContent; sources: Source[]; duplicates: { id: string; root_id: string; version: number; status: string }[]
  reviewed_by: string | null; reviewed_at: string | null; review_note: string | null
}

export const QUESTION_KINDS: Record<QuestionKind, string> = { single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', fill_blank: '填空题', short_answer: '简答题' }
export const QUESTION_STATUS: Record<string, string> = { draft: '待审核', approved: '已通过', rejected: '已退回' }
export const DIFFICULTIES: Record<string, string> = { easy: '基础', medium: '中等', hard: '较难' }

export function scoreCenti(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('分值需为正数，最多保留两位小数')
  return Math.round(Number(value) * 100)
}
