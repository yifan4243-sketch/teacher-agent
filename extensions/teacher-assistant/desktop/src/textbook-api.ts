import type { PluginProfileRoute } from '@hermes/plugin-sdk'

import { uploadFile } from './file-upload'

export interface Chapter {
  id: string
  parent_id: string | null
  title: string
  level: number
}

export interface BookVersion {
  id: string
  textbook_id: string
  version: number
  filename: string
  sha256: string
  chapters: Chapter[]
  knowledge_point_count: number
  metadata: { warnings: string[]; source_unit_count: number; toc: { title: string; printed_page_hint: number }[] }
}

export interface Textbook {
  id: string
  title: string
  versions: BookVersion[]
}

export interface Source {
  id: string
  text: string
  filename: string
  version: number
  locator: string
  page: number | null
}

export interface KnowledgePoint {
  id: string
  title: string
  text: string
  source_id: string
  review_status: string
}

export interface Page<T> {
  items: T[]
  next_offset: number | null
  total: number
}

export interface SearchResult {
  items: Source[]
  mode: string
  scope_note?: string
  usage?: { provider: string; model: string; cost_usd: number | null }[]
}

export function uploadTextbook(route: PluginProfileRoute, file: File, courseId: string, title: string, textbookId: string, progress: (text: string) => void) {
  return uploadFile<BookVersion>(route, 'textbook.upload', file, { course_id: courseId, textbook_id: textbookId || null, title }, progress)
}
