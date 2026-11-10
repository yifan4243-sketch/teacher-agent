import { captureGatewayFileDownload, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'

export const PAGE_LABELS: Record<string, string> = { draft: '草稿', approved: '已审核', rejected: '已退回' }

export interface NativeElement {
  kind: 'text' | 'shape' | 'line' | 'table'
  name: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  font_size?: number
  color?: string
  bold?: boolean
  rows?: string[][]
  fill?: string | null
  line_color?: string | null
}

export interface NativeLayout {
  title: string
  width: number
  height: number
  background: string
  elements: NativeElement[]
}

export interface EditablePageSummary {
  id: string
  blueprint_id: string
  page_number: number
  version: number
  status: string
}

export interface EditablePage extends EditablePageSummary {
  layout: NativeLayout
  object_counts: Record<string, number>
  text_check: { missing_text: string[] }
}

export async function downloadSlides(route: PluginProfileRoute, operation: string, id: string) {
  const save = captureGatewayFileDownload()
  const file = await call<{ stored_path: string; filename: string }>(route, operation, { id }, crypto.randomUUID())
  await save(file.stored_path, file.filename)
}
