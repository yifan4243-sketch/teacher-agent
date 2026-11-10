import { Button, Input, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { useState, type FormEvent } from 'react'

import { call, routeKey, type TeacherRecord } from './api'
import { uploadTextbook, type BookVersion, type Textbook, type SearchResult } from './textbook-api'
import { TextbookVersion } from './textbook-version'

export function Textbooks({ route }: { route: PluginProfileRoute }) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const courses = useQuery({ queryKey: [...routeKey(route), 'course'], queryFn: () => call<{ items: TeacherRecord[] }>(route, 'course.list') })
  const books = useQuery({ queryKey: [...routeKey(route), 'textbooks', courseId], queryFn: () => call<{ items: Textbook[] }>(route, 'textbook.list', { course_id: courseId }), enabled: !!courseId })
  const upload = useMutation({
    mutationFn: ({ file, title, textbookId }: { file: File; title: string; textbookId: string }) => uploadTextbook(route, file, courseId, title, textbookId, setProgress),
    onSuccess: async (version: BookVersion) => {
      await queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'textbooks'] })
      setVersionId(version.id)
      setProgress('教材已保存，原始文件和版本哈希已保留')
    },
  })
  const search = useMutation({
    mutationFn: ({ query, semantic, chapterId }: { query: string; semantic: boolean; chapterId: string }) => call<SearchResult>(route, semantic ? 'knowledge.semantic' : 'knowledge.search', {
      course_id: courseId, query, version_id: versionId || null, chapter_id: chapterId || null,
      ...(semantic ? { allow_model_call: true } : {}),
    }),
    onSuccess: setResults,
  })
  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('file') as File
    setProgress('正在计算文件哈希…')
    upload.mutate({ file, title: String(form.get('title')), textbookId: String(form.get('textbook_id') ?? '') })
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setResults(null)
    search.mutate({ query: String(form.get('query')), semantic: form.has('semantic'), chapterId: String(form.get('chapter_id') ?? '') })
  }
  return <section className="space-y-5" aria-label="教材知识库管理">
    <h2 className="text-lg font-semibold">教材知识库</h2>
    <label className="grid max-w-xl gap-2">教材所属课程<select aria-label="教材所属课程" value={courseId} onChange={event => { setCourseId(event.target.value); setVersionId(''); setResults(null); setProgress('') }} disabled={upload.isPending}>
      <option value="">选择课程</option>{courses.data?.items.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
    </select></label>
    {courseId && <>
      <form onSubmit={submitUpload} className="grid max-w-xl gap-3">
        <label>教材名称<Input name="title" aria-label="教材名称" required maxLength={200} /></label>
        <label>教材文件<input aria-label="教材文件" name="file" type="file" accept=".pdf,.docx,.pptx,.txt" required /></label>
        <label>版本归属<select aria-label="版本归属" name="textbook_id"><option value="">作为新教材导入</option>{books.data?.items.map(book => <option value={book.id} key={book.id}>新增《{book.title}》版本</option>)}</select></label>
        <Button type="submit" disabled={upload.isPending}>上传并解析教材</Button>
        {progress && <p role="status">{progress}</p>}
      </form>
      {books.data?.items.length === 0 && <p>这门课程还没有教材。</p>}
      <label className="grid max-w-xl gap-2">教材版本<select aria-label="教材版本" value={versionId} onChange={event => { setVersionId(event.target.value); setResults(null) }}>
        <option value="">检索各教材最新版本</option>{books.data?.items.flatMap(book => book.versions.map(version => <option value={version.id} key={version.id}>{book.title} · v{version.version} · {version.filename}</option>))}
      </select></label>
      <TextbookVersion key={versionId} route={route} versionId={versionId} onSearch={submitSearch} searchPending={search.isPending} />
      {results && <div className="space-y-3" aria-label="教材检索结果">
        <p role="status">检索到 {results.items.length} 条来源 · {results.mode === 'full_text' ? '全文检索' : '模型语义检索'}</p>
        {results.scope_note && <p>{results.scope_note}</p>}
        {results.usage?.map((usage, index) => <p key={index}>{usage.provider} · {usage.model} · {usage.cost_usd == null ? '服务商未返回费用' : `$${usage.cost_usd}`}</p>)}
        {results.items.map(source => <article key={source.id} className="rounded border border-(--ui-border) p-4">
          <p className="whitespace-pre-wrap">{source.text}</p><p className="mt-2 text-sm">{source.filename} · v{source.version} · {source.locator} · 来源ID {source.id}</p>
        </article>)}
      </div>}
    </>}
    {[courses.error, books.error, upload.error, search.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
