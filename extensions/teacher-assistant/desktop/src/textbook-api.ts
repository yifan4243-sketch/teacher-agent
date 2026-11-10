import type { PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'

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

export async function uploadTextbook(route: PluginProfileRoute, file: File, courseId: string, title: string, textbookId: string, progress: (text: string) => void) {
  if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error('教材文件需大于0且不超过50MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
  const requestId = crypto.randomUUID()
  const upload = await call<{ id: string }>(route, 'textbook.upload.begin', {
    course_id: courseId, textbook_id: textbookId || null, title, filename: file.name, total_bytes: bytes.length, sha256,
  }, `${requestId}:begin`)
  for (let offset = 0; offset < bytes.length; offset += 128 * 1024) {
    const chunk = bytes.subarray(offset, offset + 128 * 1024)
    let binary = ''
    for (const byte of chunk) binary += String.fromCharCode(byte)
    await call(route, 'textbook.upload.chunk', { id: upload.id, offset, content_base64: btoa(binary) }, `${requestId}:${offset}`)
    progress(`已上传 ${Math.round((offset + chunk.length) / bytes.length * 100)}%`)
  }
  progress('正在解析教材并建立索引…')
  return call<BookVersion>(route, 'textbook.upload.finish', { id: upload.id }, `${requestId}:finish`)
}
