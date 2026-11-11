import type { PluginProfileRoute } from '@hermes/plugin-sdk'

import { uploadFile } from './file-upload'
import type { StudentAnswer } from './grading-api'

export interface AnswerFile {
  id: string; paper_id: string; student_id: string; filename: string; sha256: string; page_count: number
}

export interface RecognitionJob {
  id: string; file_id: string; page_number: number
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  attempted: number; estimated_micro_usd: number; reported_micro_usd: number | null; error_code: string | null
  model: { provider?: string; model?: string }
  result: { answers?: (StudentAnswer & { observed_text: string; confidence: number; note: string })[]; note?: string }
}

export interface RecognitionProposal {
  file_id: string; paper_id: string; student_id: string; expected_version: number; answers: StudentAnswer[]
  warnings: { question_id: string; message: string }[]
  unassigned: { page_number: number; text: string }[]
  review_required: boolean; source_jobs: { id: string; page_number: number }[]
}

export interface RecognitionCosts {
  budget_micro_usd: number; reserved_micro_usd: number; spent_micro_usd: number; cost_basis: string
}

export function uploadAnswer(route: PluginProfileRoute, file: File, paperId: string, studentId: string, progress: (value: string) => void) {
  return uploadFile<AnswerFile>(route, 'answer.upload', file, { paper_id: paperId, student_id: studentId }, progress)
}
