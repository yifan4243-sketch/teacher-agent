import { captureGatewayFileDownload, host, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'

export interface ImageAsset {
  id: string
  job_id: string
  stored_path: string
  sha256: string
  width: number
  height: number
  format: string
  verification_status: string
  source_asset_id: string | null
  processing_json: string
  review_version: number
}

export interface ImageJob {
  id: string
  blueprint_id: string
  page_number: number
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'cached'
  kind: 'generation' | 'analysis'
  input_asset_id: string | null
  analysis: { text_check?: string; missing_text?: string[]; review_note?: string }
  estimated_micro_usd: number
  reported_micro_usd: number | null
  attempted: number
  asset_id: string | null
  error_code: string | null
  provider: string | null
  model: string | null
  assets: ImageAsset[]
}

export interface ImageBudget {
  budget_micro_usd: number
  reserved_micro_usd: number
  spent_micro_usd: number
  cost_basis: string
}

export function usd(micro: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(micro / 1_000_000)
}

export async function runImage(route: PluginProfileRoute, job: ImageJob) {
  const release = await host.retainProfile(route, { spawnPriority: 'foreground' })
  try {
    const result = await host.requestProfile<{ ok: boolean; data: ImageJob; error?: { message: string } }>(route, 'plugin.teacher-assistant.call', {
      operation: 'slide.image.run', data: { id: job.id }, request_id: job.id,
    }, 600000)
    if (!result.ok) throw new Error(result.error?.message ?? '图片任务执行失败')
    return result.data
  } finally {
    release()
  }
}

export async function downloadImage(route: PluginProfileRoute, assetId: string) {
  const save = captureGatewayFileDownload()
  const file = await call<{ stored_path: string; filename: string }>(route, 'slide.image.file', { id: assetId })
  await save(file.stored_path, file.filename)
}

export async function runQueuedImages(route: PluginProfileRoute, blueprintId: string, onUpdate: () => Promise<unknown>) {
  const queued: ImageJob[] = []
  let offset: number | null = 0
  while (offset !== null) {
    const group: { items: ImageJob[]; next_offset: number | null } = await call(route, 'slide.image.list', { blueprint_id: blueprintId, offset, limit: 100 })
    queued.push(...group.items.filter(job => job.state === 'queued'))
    offset = group.next_offset
  }
  for (const job of queued) {
    const result = await runImage(route, job)
    await onUpdate()
    if (result.state === 'failed' || result.state === 'running') throw new Error('批次已停止，请核对原任务状态和费用后继续')
  }
}
