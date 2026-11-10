import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
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
    await page.getByRole('button', { name: '技能与工具', exact: true }).click({ timeout: 150000 })
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
    await page.getByRole('button', { name: '教材知识库', exact: true }).click()
    await page.getByLabel('教材所属课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('教材名称', { exact: true }).fill('UI自动上传教材')
    await page.getByLabel('教材文件', { exact: true }).setInputFiles({
      name: 'UI教材.txt', mimeType: 'text/plain',
      buffer: Buffer.from('第一章 工业机器人\n1.1 技术参数\n自由度描述独立运动的数量。\n定位精度是实际位置与目标位置的偏差。\n', 'utf8'),
    })
    await page.getByRole('button', { name: '上传并解析教材', exact: true }).click()
    await expect(page.getByText('教材已保存，原始文件和版本哈希已保留')).toBeVisible()
    await expect(page.getByText('原文片段 4 · 知识点候选 2')).toBeVisible()
    await page.getByLabel('教材检索词', { exact: true }).fill('自由度')
    await page.getByRole('button', { name: '检索教材', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '检索到 1 条来源' })).toBeVisible()
    await expect(page.getByLabel('教材检索结果').getByText(/text\/line:3/)).toBeVisible()
    await page.getByRole('button', { name: '教师确认', exact: true }).first().click()
    await expect(page.getByRole('button', { name: '更新确认', exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: '授课稿与教案', exact: true }).click()
    await page.getByLabel('备课课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByText('创建教材关联课次', { exact: true }).click()
    await page.getByLabel('课次名称', { exact: true }).fill('UI备课测试课次')
    await page.getByLabel('课次教学目标', { exact: true }).fill('理解工业机器人的基本技术参数')
    await page.getByLabel('课次教材版本', { exact: true }).selectOption({ label: 'UI自动上传教材 · v1' })
    await page.getByLabel('选择来源 text/line:3', { exact: true }).check()
    await page.getByRole('button', { name: '保存课次与教材依据', exact: true }).click()
    await expect(page.getByLabel('备课课次', { exact: true }).locator('option:checked')).toHaveText('UI备课测试课次')
    for (const [kind, label, output] of [['script', '授课稿', 'script.docx'], ['lesson_plan', '教案', 'lesson-plan.docx']]) {
      await page.getByLabel('生成文档类型', { exact: true }).selectOption(kind)
      await page.getByLabel(/允许本次调用Hermes Agent生成文档/).check()
      await page.getByRole('button', { name: '调用原生Agent生成草稿', exact: true }).click()
      await expect(page.getByText('本地模拟模型已保存教学草稿，请教师审核。', { exact: true }).last()).toBeVisible({ timeout: 120000 })
      await page.getByText('教师工作台', { exact: true }).click()
      await page.getByRole('button', { name: '授课稿与教案', exact: true }).click()
      await page.getByLabel('备课课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
      await page.getByLabel('备课课次', { exact: true }).selectOption({ label: 'UI备课测试课次' })
      await page.getByLabel('教学文档版本', { exact: true }).selectOption({ label: `${label} · v1 · 草稿` })
      if (kind === 'script') {
        await page.getByText('测试环节1 · 10分钟', { exact: true }).click()
        await page.getByLabel('环节标题 0-0', { exact: true }).fill('UI教师修订的导入')
        await page.getByRole('button', { name: '保存此环节为新版本', exact: true }).first().click()
      } else {
        await page.getByLabel('教案教学重点', { exact: true }).fill('教师已复核的自由度概念')
        await page.getByRole('button', { name: '保存教案修订版', exact: true }).click()
      }
      await expect(page.getByRole('heading', { name: / · v2 · 待审核草稿$/ })).toBeVisible()
      await page.getByLabel('我已核对完整正文、教材依据和时间分配', { exact: true }).check()
      await page.getByRole('button', { name: '审核通过此版本', exact: true }).click()
      const downloadPath = testInfo.outputPath(output)
      // Pick a deterministic target in the native dialog. The authenticated file transfer still runs normally.
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, downloadPath)
      await page.getByRole('button', { name: '下载正式DOCX', exact: true }).click()
      await expect.poll(() => existsSync(downloadPath), { timeout: 30000 }).toBe(true)
    }
    const fileProbe = spawnSync(python, ['-c', `
import hashlib
import json
import sqlite3
import sys
from pathlib import Path
from docx import Document
home, output = map(Path, sys.argv[1:])
with sqlite3.connect(home / 'plugin-data/teacher-assistant/teaching.db') as conn:
    rows = conn.execute('SELECT d.kind,e.sha256 FROM teaching_exports e JOIN teaching_documents d ON d.id=e.document_id').fetchall()
verified = []
for kind, digest in rows:
    path = output / ('script.docx' if kind == 'script' else 'lesson-plan.docx')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    document = Document(path)
    assert document.paragraphs
    if kind == 'lesson_plan':
        assert len(document.tables) == 1 and len(document.tables[0].rows) == 14
    verified.append({'kind': kind, 'sha256': digest, 'bytes': path.stat().st_size})
assert len(verified) == 2
print(json.dumps(verified))
`, home, testInfo.outputPath()], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(fileProbe.status, fileProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('docx-download-receipt.json'), fileProbe.stdout)
    await page.screenshot({ path: testInfo.outputPath('teacher-documents.png') })
    await page.getByRole('button', { name: '课件页面蓝图', exact: true }).click()
    await page.getByLabel('课件课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('课件课次', { exact: true }).selectOption({ label: 'UI备课测试课次' })
    await page.getByLabel(/允许本次由原生Agent规划课件/).check()
    await page.getByRole('button', { name: '生成课件页面蓝图', exact: true }).click()
    await expect(page.getByText('本地模拟模型已保存教学草稿，请教师审核。', { exact: true }).last()).toBeVisible({ timeout: 120000 })
    await page.getByText('教师工作台', { exact: true }).click()
    await page.getByRole('button', { name: '课件页面蓝图', exact: true }).click()
    await page.getByLabel('课件课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('课件课次', { exact: true }).selectOption({ label: 'UI备课测试课次' })
    await page.getByLabel('课件蓝图版本', { exact: true }).selectOption({ label: '页面蓝图 · v1 · 草稿' })
    await page.getByLabel('课件主题', { exact: true }).selectOption('technology')
    await page.getByLabel('页面标题', { exact: true }).fill('UI教师修订的技术参数页')
    await page.getByRole('button', { name: '保存页面为蓝图新版本', exact: true }).click()
    await expect(page.getByRole('heading', { name: '模拟课件页面蓝图 · v2 · 草稿', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '查看自动生图提示词', exact: true }).click()
    await expect(page.getByLabel('自动生图提示词', { exact: true })).toHaveValue(/科技教学风/)
    await expect(page.getByLabel('自动生图提示词', { exact: true })).toHaveValue(/自由度描述独立运动的数量/)
    await page.getByLabel('已核对全部页面的文字、来源和教学环节', { exact: true }).check()
    await page.getByRole('button', { name: '审核通过蓝图版本', exact: true }).click()
    await expect(page.getByRole('heading', { name: '模拟课件页面蓝图 · v2 · 已审核', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-blueprint.png') })
    await page.getByRole('button', { name: '教材知识库', exact: true }).click()
    await page.getByLabel('教材所属课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('教材版本', { exact: true }).selectOption({ label: 'UI自动上传教材 · v1 · UI教材.txt' })
    await page.getByRole('button', { name: '查看原文', exact: true }).first().click()
    await expect(page.getByLabel('知识点原文').getByText('自由度描述独立运动的数量。', { exact: true })).toBeVisible()
    await page.getByLabel('章节名称 1.1 技术参数', { exact: true }).fill('1.1 已复核技术参数')
    await page.getByRole('button', { name: '修订章节', exact: true }).nth(1).click()
    await expect(page.getByLabel('章节名称 1.1 已复核技术参数', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-textbook.png') })
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByRole('button', { name: '教材知识库', exact: true }).click()
    await page.getByLabel('教材所属课程', { exact: true }).selectOption({ label: 'UI虚构测试课程' })
    await page.getByLabel('教材版本', { exact: true }).selectOption({ label: 'UI自动上传教材 · v1 · UI教材.txt' })
    await expect(page.getByLabel('章节名称 1.1 已复核技术参数', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '更新确认', exact: true })).toHaveCount(1)
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
