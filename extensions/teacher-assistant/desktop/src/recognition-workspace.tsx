import { Button, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { ExamPaper } from './exam-api'
import type { Submission } from './grading-api'
import { uploadAnswer, type AnswerFile } from './recognition-api'
import { RecognitionJobs } from './recognition-jobs'
import type { Page } from './textbook-api'

interface Props { route: PluginProfileRoute; paper: ExamPaper; studentId: string; onSaved: (value: Submission) => void }

export function RecognitionWorkspace({ route, paper, studentId, onSaved }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [fileId, setFileId] = useState('')
  const [progress, setProgress] = useState('')
  const files = useQuery({ queryKey: [...routeKey(route), 'answer-files', paper.id, studentId, offset], queryFn: () => call<Page<AnswerFile>>(route, 'answer.file.list', { id: paper.id, student_id: studentId, offset, limit: 20 }) })
  const selected = useQuery({ queryKey: [...routeKey(route), 'answer-file', fileId], queryFn: () => call<AnswerFile>(route, 'answer.file.get', { id: fileId }), enabled: !!fileId })
  const upload = useMutation({
    mutationFn: (file: File) => uploadAnswer(route, file, paper.id, studentId, setProgress),
    onSuccess: async file => { await queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'answer-files'] }); setFileId(file.id); setProgress('答卷原件已保存') },
    onError: () => setProgress(''),
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get('file')
    if (file instanceof File) upload.mutate(file)
  }
  return <section aria-label="图片与扫描答卷识别" className="space-y-4 rounded border border-(--ui-border) p-4">
    <h3>图片与扫描答卷识别</h3>
    <form className="space-y-2" onSubmit={submit}>
      <label>答卷图片或PDF<input name="file" aria-label="答卷图片或PDF" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" required disabled={upload.isPending} /></label>
      <Button type="submit" disabled={upload.isPending}>上传答卷原件</Button>
      {progress && <p role="status">{progress}</p>}
    </form>
    {files.data?.items.map(file => <Button key={file.id} variant="ghost" onClick={() => setFileId(file.id)}>{file.filename} · {file.page_count}页</Button>)}
    <div className="flex gap-2"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页答卷原件</Button><Button variant="secondary" disabled={files.data?.next_offset == null} onClick={() => setOffset(files.data?.next_offset ?? 0)}>下一页答卷原件</Button></div>
    {selected.data && <AnswerFilePages key={fileId} route={route} file={selected.data} />}
    {selected.data && <RecognitionJobs key={fileId} route={route} file={selected.data} paper={paper} onSaved={onSaved} />}
    {[files.error, selected.error, upload.error].filter(Boolean).map((error, index) => <p key={index} role="alert">{error?.message}</p>)}
  </section>
}

function AnswerFilePages({ route, file }: { route: PluginProfileRoute; file: AnswerFile }) {
  const [page, setPage] = useState(1)
  const preview = useQuery({ queryKey: [...routeKey(route), 'answer-preview', file.id, page], queryFn: () => call<{ mime_type: string; content_base64: string }>(route, 'answer.file.preview', { id: file.id, page_number: page }, crypto.randomUUID()), staleTime: Infinity })
  return <div className="space-y-2">
    <p>{file.filename} · {file.page_count}页</p><p className="break-all text-sm">原件 SHA-256 {file.sha256}</p>
    <label>答卷预览页号<input type="number" aria-label="答卷预览页号" min={1} max={file.page_count} value={page} onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 1 && value <= file.page_count) setPage(value) }} /></label>
    {preview.data && <img className="max-h-[640px] max-w-full object-contain" alt={`答卷原页第${page}页预览`} src={`data:${preview.data.mime_type};base64,${preview.data.content_base64}`} />}
    {preview.isPending && <p role="status">正在读取答卷页面</p>}
    {preview.error && <p role="alert">{preview.error.message}</p>}
  </div>
}
