import { Button, Input, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey } from './api'
import type { BookVersion, KnowledgePoint, Page, Source } from './textbook-api'

interface Props {
  route: PluginProfileRoute
  versionId: string
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  searchPending: boolean
}

export function TextbookVersion({ route, versionId, onSearch, searchPending }: Props) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [sourceId, setSourceId] = useState('')
  const version = useQuery({ queryKey: [...routeKey(route), 'version', versionId], queryFn: () => call<BookVersion>(route, 'textbook.version', { id: versionId }), enabled: !!versionId })
  const points = useQuery({ queryKey: [...routeKey(route), 'knowledge', versionId, offset], queryFn: () => call<Page<KnowledgePoint>>(route, 'knowledge.list', { version_id: versionId, offset, limit: 20 }), enabled: !!versionId })
  const source = useQuery({ queryKey: [...routeKey(route), 'source', sourceId], queryFn: () => call<Source>(route, 'source.get', { id: sourceId }), enabled: !!sourceId })
  const update = useMutation({
    mutationFn: ({ operation, id, title }: { operation: string; id: string; title: string }) => call(route, operation, { id, title }, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }),
  })
  function rename(event: FormEvent<HTMLFormElement>, operation: string, id: string) {
    event.preventDefault()
    update.mutate({ operation, id, title: String(new FormData(event.currentTarget).get('title')) })
  }
  return <div className="space-y-5">
    {version.data && <>
      <p>原文片段 {version.data.metadata.source_unit_count} · 知识点候选 {version.data.knowledge_point_count}</p>
      <p className="break-all text-sm">SHA-256 {version.data.sha256}</p>
      {version.data.metadata.warnings.map(warning => <p key={warning} role="note">{warning}</p>)}
      {version.data.metadata.toc.length > 0 && <details><summary>原书目录的待核验页码</summary>{version.data.metadata.toc.map((item, index) => <p key={index}>{item.title} · 印刷页码提示 {item.printed_page_hint} · 尚未核验</p>)}</details>}
      <details open><summary>章节结构与修订</summary><div className="space-y-2">
        {version.data.chapters.map(chapter => <form className="flex gap-2" style={{ marginLeft: `${Math.min(chapter.level - 1, 5) * 16}px` }} key={chapter.id} onSubmit={event => rename(event, 'chapter.update', chapter.id)}>
          <Input aria-label={`章节名称 ${chapter.title}`} name="title" defaultValue={chapter.title} maxLength={200} required />
          <Button type="submit" variant="secondary" disabled={update.isPending}>修订章节</Button>
        </form>)}
      </div></details>
    </>}
    <form onSubmit={onSearch} className="grid max-w-xl gap-3">
      <label>教材检索词<Input aria-label="教材检索词" name="query" required maxLength={300} /></label>
      <label>检索章节<select aria-label="检索章节" name="chapter_id"><option value="">全部章节</option>{version.data?.chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="semantic" />本次使用语义检索，允许模型处理教材候选片段，需先启用权限，可能产生费用</label>
      <Button type="submit" disabled={searchPending}>检索教材</Button>
    </form>
    {points.data && <details open><summary>知识点候选与教师复核 · 共 {points.data.total} 项</summary>
      <p>以下内容由原文规则提取，教师可修订名称并确认。</p>
      {points.data.items.map(point => <article key={point.id} className="my-3 rounded border border-(--ui-border) p-3">
        <p className="whitespace-pre-wrap">{point.text}</p>
        <form className="mt-3 flex gap-2" onSubmit={event => rename(event, 'knowledge.review', point.id)}>
          <Input aria-label={`知识点名称 ${point.id}`} name="title" defaultValue={point.title} required maxLength={200} />
          <Button type="submit" disabled={update.isPending}>{point.review_status === 'reviewed' ? '更新确认' : '教师确认'}</Button>
          <Button type="button" variant="secondary" onClick={() => setSourceId(point.source_id)}>查看原文</Button>
        </form>
      </article>)}
      <div className="flex gap-2"><Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一组知识点</Button><Button disabled={points.data.next_offset == null} onClick={() => setOffset(points.data?.next_offset ?? 0)}>下一组知识点</Button></div>
    </details>}
    {source.data && <aside aria-label="知识点原文" className="rounded border border-(--ui-border) p-4"><p className="whitespace-pre-wrap">{source.data.text}</p><p>{source.data.filename} · v{source.data.version} · {source.data.locator}</p><p>来源ID {source.data.id}</p></aside>}
    {[version.error, points.error, source.error, update.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </div>
}
