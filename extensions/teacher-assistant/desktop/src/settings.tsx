import { Button, Input, useMutation, useQuery, useQueryClient, type PluginProfileRoute } from '@hermes/plugin-sdk'
import { type FormEvent } from 'react'

import { call, routeKey, type TeacherSettings } from './api'

const STAGES = [
  ['teaching_script', '授课稿'], ['lesson_plan', '教案'], ['slides', '课件'],
  ['exams', '试卷'], ['grading', '辅助批改'], ['analysis', '学情分析'],
]

export function Settings({ route }: { route: PluginProfileRoute }) {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: [...routeKey(route), 'settings'], queryFn: () => call<TeacherSettings>(route, 'settings.get') })
  const schema = useQuery({ queryKey: [...routeKey(route), 'schema'], queryFn: () => call<Record<string, unknown>>(route, 'schema') })
  const mutation = useMutation({
    mutationFn: (data: TeacherSettings) => call(route, 'settings.update', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...routeKey(route), 'settings'] }),
  })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const stageModels: TeacherSettings['stage_models'] = {}
    for (const [key] of STAGES) {
      const provider = String(form.get(`${key}.provider`) ?? '').trim()
      const model = String(form.get(`${key}.model`) ?? '').trim()
      if (provider || model) stageModels[key] = { provider, model }
    }
    mutation.mutate({ agent_student_access: form.has('student_access'), semantic_llm_enabled: form.has('semantic_llm'), disabled_operations: form.getAll('disabled_operation').map(String), stage_models: stageModels })
  }
  return <section className="space-y-5" aria-label="模型与权限设置">
    <h2 className="text-lg font-semibold">模型与工具权限</h2>
    <p>凭据通过 Hermes 系统设置管理。此处只保存阶段模型名称和权限。</p>
    {settings.data && <form onSubmit={save} className="max-w-3xl space-y-6" key={JSON.stringify(settings.data)}>
      <label className="flex items-center gap-3"><input type="checkbox" name="student_access" defaultChecked={settings.data.agent_student_access} />允许 Agent 访问本地学生资料</label>
      <label className="flex items-center gap-3"><input type="checkbox" name="semantic_llm" defaultChecked={settings.data.semantic_llm_enabled} />启用按需语义检索，允许将教材候选片段发送给 Hermes 当前模型，每次最多两次模型请求，可能产生 API 费用</label>
      <fieldset className="space-y-3"><legend className="mb-3 font-medium">分阶段模型</legend>
        {STAGES.map(([key, label]) => <div key={key} className="grid gap-2 sm:grid-cols-3">
          <span>{label}</span>
          <Input aria-label={`${label}服务商`} name={`${key}.provider`} placeholder="服务商" defaultValue={settings.data.stage_models[key]?.provider ?? ''} />
          <Input aria-label={`${label}模型`} name={`${key}.model`} placeholder="模型名称" defaultValue={settings.data.stage_models[key]?.model ?? ''} />
        </div>)}
      </fieldset>
      <fieldset className="grid gap-2"><legend className="mb-3 font-medium">禁用的 Agent 操作</legend>
        {schema.data && Object.keys(schema.data).map(operation => <label className="flex items-center gap-3" key={operation}>
          <input type="checkbox" name="disabled_operation" value={operation} defaultChecked={settings.data.disabled_operations.includes(operation)} />{operation}
        </label>)}
      </fieldset>
      <Button type="submit" disabled={mutation.isPending}>保存模型与权限</Button>
      {mutation.isSuccess && <p role="status">设置已保存</p>}
    </form>}
    {[settings.error, schema.error, mutation.error].filter(Boolean).map((error, index) => <p role="alert" key={index}>{error?.message}</p>)}
  </section>
}
