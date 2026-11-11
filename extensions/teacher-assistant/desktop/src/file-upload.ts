import type { PluginProfileRoute } from '@hermes/plugin-sdk'

import { call } from './api'

export async function uploadFile<T>(route: PluginProfileRoute, prefix: string, file: File, fields: object, progress: (value: string) => void): Promise<T> {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('上传文件需大于0且不超过50MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
  const requestId = crypto.randomUUID()
  const upload = await call<{ id: string }>(route, `${prefix}.begin`, {
    ...fields, filename: file.name, total_bytes: bytes.length, sha256,
  }, `${requestId}:begin`)
  for (let offset = 0; offset < bytes.length; offset += 128 * 1024) {
    const chunk = bytes.subarray(offset, offset + 128 * 1024)
    let binary = ''
    for (const byte of chunk) binary += String.fromCharCode(byte)
    await call(route, `${prefix}.chunk`, { id: upload.id, offset, content_base64: btoa(binary) }, `${requestId}:${offset}`)
    progress(`已上传 ${Math.round((offset + chunk.length) / bytes.length * 100)}%`)
  }
  progress('正在校验并处理文件…')
  return call<T>(route, `${prefix}.finish`, { id: upload.id }, `${requestId}:finish`)
}
