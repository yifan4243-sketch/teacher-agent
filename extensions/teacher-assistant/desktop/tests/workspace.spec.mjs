import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const extension = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const repo = resolve(extension, '../..')
const require = createRequire(join(repo, 'apps/desktop/package.json'))
const { test, expect, _electron } = require('@playwright/test')

test('教师工作台通过原生 Gateway 操作教学数据库并审批任务', async ({}, testInfo) => {
  const home = mkdtempSync(join(process.env.TEMP, 'teacher-desktop-'))
  const plugins = join(home, 'plugins', 'teacher-assistant')
  mkdirSync(dirname(plugins), { recursive: true })
  cpSync(extension, plugins, {
    recursive: true,
    filter: path => !['test-results', '__pycache__', 'phase0-evidence'].includes(path.split(/[\\/]/).at(-1)),
  })
  const pythonProbe = spawnSync(process.env.HERMES_PYTHON || 'python', ['-c', 'from pm.testenv import testenv_python; from pathlib import Path; import sys; print(testenv_python(Path.cwd()) or sys.executable)'], { cwd: repo, env: process.env, encoding: 'utf8', windowsHide: true })
  expect(pythonProbe.status, pythonProbe.stderr).toBe(0)
  const python = pythonProbe.stdout.trim()
  const env = {
    ...process.env,
    HERMES_HOME: home,
    HERMES_DESKTOP_HERMES_ROOT: repo,
    HERMES_DESKTOP_PYTHON: python,
    HERMES_DESKTOP_USER_DATA_DIR: join(home, 'desktop-user-data'),
    HERMES_DESKTOP_IGNORE_EXISTING: '1',
    HERMES_DESKTOP_SKIP_PROTOCOL_REGISTRATION: '1',
    HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1',
  }
  const backend = spawn(python, ['-m', 'tests.extensions.teacher_ui_backend', home], {
    cwd: repo, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  })
  const backendLog = []
  backend.stderr.on('data', chunk => backendLog.push(String(chunk)))
  const lines = createInterface({ input: backend.stdout })
  let app
  const rendererLog = []
  try {
    const firstLine = await lines[Symbol.asyncIterator]().next()
    expect(JSON.parse(firstLine.value).ready).toBe(true)
    app = await _electron.launch({ executablePath: require('electron'), args: [join(repo, 'apps/desktop')], cwd: repo, env, timeout: 120000 })
    const page = await app.firstWindow()
    page.on('console', message => rendererLog.push(`${message.type()}: ${message.text()}`))
    page.on('pageerror', error => rendererLog.push(`pageerror: ${error.stack}`))
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: '技能与工具', exact: true }).click({ timeout: 90000 })
    await page.getByText('插件', { exact: true }).click()
    const enable = page.getByRole('switch', { name: '教师专业工作台', exact: true })
    await expect(enable).toHaveAttribute('aria-checked', 'false')
    await enable.click()
    await expect(enable).toHaveAttribute('aria-checked', 'true')
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await expect(page.getByRole('heading', { name: '教师专业工作台' })).toBeVisible()
    await expect(page.getByRole('button', { name: '保存课程', exact: true })).toBeVisible()
    await page.getByLabel('课程名称', { exact: true }).fill('UI虚构测试课程')
    await page.getByRole('button', { name: '保存课程', exact: true }).click()
    await expect(page.getByRole('button', { name: 'UI虚构测试课程', exact: true })).toBeVisible()
    await expect(page.getByText('2小节 · 教学80分钟 · 占用90分钟')).toBeVisible()
    await page.getByLabel('学科', { exact: true }).fill('UI测试学科')
    await page.getByRole('button', { name: '保存课程', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('已保存至本地教学数据库')

    await page.getByRole('button', { name: '班级', exact: true }).click()
    await page.getByLabel('班级名称', { exact: true }).fill('UI虚构测试班')
    await page.getByRole('button', { name: '保存班级', exact: true }).click()
    await expect(page.getByRole('button', { name: 'UI虚构测试班', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '学生档案', exact: true }).click()
    await page.getByLabel('学号', { exact: true }).fill('UI-TEST-001')
    await page.getByLabel('学生姓名', { exact: true }).fill('虚构测试学生')
    await page.getByLabel('所属班级', { exact: true }).selectOption({ label: 'UI虚构测试班' })
    await page.getByRole('button', { name: '保存学生', exact: true }).click()
    await expect(page.getByRole('button', { name: '虚构测试学生', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '课程身份关联', exact: true }).click()
    await page.getByLabel('课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('班级', { exact: true }).selectOption({ label: 'UI虚构测试班' })
    await page.getByLabel('学生', { exact: true }).selectOption({ label: '虚构测试学生' })
    await page.getByRole('button', { name: '关联班级', exact: true }).click()
    await expect(page.getByText('授课班级 · UI虚构测试班')).toBeVisible()
    await page.getByRole('button', { name: '登记选课', exact: true }).click()
    await expect(page.getByText('已登记 1 名学生')).toBeVisible()

    await page.getByRole('button', { name: '任务与审批', exact: true }).click()
    await page.getByLabel('新任务课程名称').fill('UI审批测试课程')
    await page.getByRole('button', { name: '建立课程任务' }).click()
    await page.getByRole('button', { name: '执行任务' }).click()
    await expect(page.getByText('UI审批测试课程 · 待教师审核')).toBeVisible()
    await page.getByRole('button', { name: '教师批准' }).click()
    await expect(page.getByText('UI审批测试课程 · 已完成')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-workspace.png') })
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await expect(page.getByRole('heading', { name: '教师专业工作台' })).toBeVisible()
    await page.getByRole('button', { name: '我的课程', exact: true }).click()
    await expect(page.getByRole('button', { name: 'UI虚构测试课程', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'UI审批测试课程', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '模型与权限', exact: true }).click()
    await page.getByLabel('授课稿服务商', { exact: true }).fill('custom')
    await page.getByLabel('授课稿模型', { exact: true }).fill('fake-model')
    await page.getByRole('button', { name: '保存模型与权限', exact: true }).click()
    await expect(page.getByText('设置已保存', { exact: true })).toBeVisible()
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByRole('button', { name: '模型与权限', exact: true }).click()
    await expect(page.getByLabel('授课稿模型', { exact: true })).toHaveValue('fake-model')
    writeFileSync(testInfo.outputPath('receipt.json'), JSON.stringify({ home, backend: 'real Hermes Gateway', database: 'real SQLite', model: 'loopback scripted test provider', operations_verified: ['course.create', 'course.update', 'class.create', 'student.create', 'course.assign_class', 'enrollment.create', 'task.create', 'task.run', 'task.review', 'reload persistence'] }, null, 2))
  } catch (error) {
    if (app) {
      const page = await app.firstWindow()
      await page.screenshot({ path: testInfo.outputPath('failure.png') })
      writeFileSync(testInfo.outputPath('failure-body.txt'), await page.locator('body').innerText())
    }
    throw error
  } finally {
    if (app) await app.close()
    spawnSync(python, ['hermes', 'gateway', 'stop', '--yes'], { cwd: repo, env, windowsHide: true, timeout: 60000 })
    backend.stdin.end('\n')
    writeFileSync(testInfo.outputPath('backend.log'), backendLog.join(''))
    writeFileSync(testInfo.outputPath('renderer.log'), rendererLog.join('\n'))
    lines.close()
  }
})
