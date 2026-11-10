import { Button, host, ROUTES_AREA, SIDEBAR_NAV_AREA, useQuery, useValue, type HermesPlugin } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { RecordEditor, CourseRoster } from './records'
import { Settings } from './settings'
import { Tasks } from './tasks'
import { Textbooks } from './textbooks'
import { Preparation } from './preparation'
import { SlidesWorkspace } from './slides-workspace'

const PAGES = [
  ['course', '我的课程'], ['class', '班级'], ['student', '学生档案'],
  ['roster', '课程身份关联'], ['textbooks', '教材知识库'], ['preparation', '授课稿与教案'], ['slides', '课件页面蓝图'], ['tasks', '任务与审批'], ['settings', '模型与权限'],
]

function TeacherWorkspace() {
  const profile = useValue(host.state.profile)
  const connectionId = useValue(host.state.connectionId)
  const [page, setPage] = useState('course')
  const routing = useQuery({
    queryKey: ['teacher-route', connectionId, profile],
    queryFn: async () => {
      const routes = await host.profileRoutes()
      const route = routes.find(item => item.connectionId === connectionId && item.profile === profile)
      if (!route) throw new Error('当前教师配置的 Gateway 路由尚未就绪')
      return route
    },
  })
  const route = routing.data
  return <main className="h-full overflow-auto p-6 text-(--ui-text-primary)" aria-label="教师专业工作台">
    <header className="mb-6 space-y-2">
      <h1 className="text-2xl font-semibold">教师专业工作台</h1>
      <p>当前配置 · {profile} · 本地教学数据与 Hermes 会话分开保存</p>
    </header>
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="教师业务导航">
      {PAGES.map(([key, label]) => <Button key={key} variant={page === key ? 'secondary' : 'ghost'} onClick={() => setPage(key)}>{label}</Button>)}
    </nav>
    {routing.isPending && <p role="status">正在连接教师配置…</p>}
    {routing.error && <p role="alert">{routing.error.message}</p>}
    {route && <div key={`${route.connectionId}:${route.profile}:${route.targetProfile}:${page}`}>
      {['course', 'class', 'student'].includes(page) && <RecordEditor route={route} entity={page as 'course' | 'class' | 'student'} />}
      {page === 'roster' && <CourseRoster route={route} />}
      {page === 'tasks' && <Tasks route={route} />}
      {page === 'textbooks' && <Textbooks route={route} />}
      {page === 'preparation' && <Preparation route={route} />}
      {page === 'slides' && <SlidesWorkspace route={route} />}
      {page === 'settings' && <Settings route={route} />}
    </div>}
  </main>
}

export default {
  id: 'teacher-assistant',
  name: '教师专业工作台',
  register(ctx) {
    ctx.registerMany([
      { id: 'workspace', area: ROUTES_AREA, data: { path: '/teacher' }, render: () => <TeacherWorkspace /> },
      { id: 'navigation', area: SIDEBAR_NAV_AREA, data: { path: '/teacher', label: '教师工作台', codicon: 'mortar-board' } },
    ])
  },
} satisfies HermesPlugin
