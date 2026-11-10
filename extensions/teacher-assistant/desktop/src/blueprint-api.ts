import type { TeachingDocument } from './preparation-api'

export interface BlueprintPage {
  number: number
  unit_index: number
  purpose: string
  title: string
  key_messages: string[]
  source_ids: string[]
  knowledge_point_ids: string[]
  script_references: { unit_index: number; segment_index: number }[]
  duration_minutes: number
  visuals: { kind: string; description: string; source_ids: string[] }[]
  layout: string
  teacher_notes: string
  visual_requirements: string
}

export interface BlueprintContent {
  title: string
  theme: string
  pages: BlueprintPage[]
}

export interface BlueprintDocument extends Omit<TeachingDocument, 'kind' | 'content'> {
  kind: 'slide_blueprint'
  content: BlueprintContent
  plan_id: string
}

export interface SlideTheme {
  id: string
  name: string
  instructions: string
}
