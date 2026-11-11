import { captureGatewayFileDownload, host, type PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'

export interface RenderJob {
  id: string
  page_id: string
  renderer: string
  renderer_version: string | null
  state: 'queued' | 'running' | 'succeeded' | 'failed'
  error_code: string | null
  comparison: {
    mean_absolute_rgb_error?: number
    pixels_above_32_fraction?: number
    reference_sha256?: string
    pptx_sha256?: string
    review_note?: string
  }
}

export interface ImagePreview { content_base64: string; mime_type: string }

export async function generateRender(route: PluginProfileRoute, pageId: string, renderer: string, forceNew: boolean, onQueued: () => Promise<unknown>) {
  const release = await host.retainProfile(route, { spawnPriority: 'foreground' })
  try {
    const job = await call<RenderJob>(route, 'slide.render.begin', { id: pageId, renderer, force_new: forceNew }, crypto.randomUUID())
    await onQueued()
    const result = await host.requestProfile<{ ok: boolean; data: RenderJob; error?: { message: string } }>(route, 'plugin.teacher-assistant.call', {
      operation: 'slide.render.run', data: { id: job.id }, request_id: job.id,
    }, 120000)
    if (!result.ok) throw new Error(result.error?.message ?? '本地渲染任务未能完成')
    return result.data
  } finally {
    release()
  }
}

export async function downloadRender(route: PluginProfileRoute, id: string, variant: string) {
  const save = captureGatewayFileDownload()
  const file = await call<{ stored_path: string; filename: string }>(route, 'slide.render.file', { id, variant })
  await save(file.stored_path, file.filename)
}
