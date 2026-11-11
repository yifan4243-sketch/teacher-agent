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
    const images = page.getByRole('region', { name: 'AI逐页设计图片', exact: true })
    await images.getByLabel('单页估算费用（美元）', { exact: true }).fill('0.02')
    await images.getByLabel(/授权所选页面调用/).check()
    await images.getByRole('button', { name: '预留所选图片任务', exact: true }).click()
    await expect(images.getByRole('alert').filter({ hasText: '课件任务预算不足' })).toBeVisible()
    await images.getByLabel('本蓝图预算（美元）', { exact: true }).fill('0.10')
    await images.getByRole('button', { name: '保存图片任务预算', exact: true }).click()
    await expect(images.getByRole('status')).toContainText('$0.10')
    await images.getByRole('button', { name: '预留所选图片任务', exact: true }).click()
    await images.getByRole('button', { name: '依次执行已预留的待执行任务', exact: true }).click()
    await expect(images.getByRole('heading', { name: '第1页 · 已生成', exact: true })).toBeVisible()
    const firstImage = images.getByRole('article').first()
    await firstImage.getByRole('button', { name: '预览设计图', exact: true }).click()
    await expect(firstImage.getByAltText('教学页面设计预览', { exact: true })).toBeVisible()
    const imagePath = testInfo.outputPath('generated-design.jpg')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, imagePath)
    await firstImage.getByRole('button', { name: '下载高清图片', exact: true }).click()
    await expect.poll(() => existsSync(imagePath)).toBe(true)
    await firstImage.getByLabel('视觉检查估算费用（美元）', { exact: true }).fill('0.01')
    await firstImage.getByLabel(/授权将当前设计图发送给课件阶段视觉模型/).check()
    await firstImage.getByRole('button', { name: '预留此页文字与布局识别', exact: true }).click()
    await images.getByRole('button', { name: '执行此页文字与布局识别', exact: true }).click()
    await expect(images.getByText('提取文字与蓝图存在差异，需要核对或重做', { exact: true })).toBeVisible()
    await firstImage.getByLabel('图片核对意见', { exact: true }).fill('离线固定图像用于验证技术流程，不作教学内容验收')
    await firstImage.getByLabel(/已逐字核对蓝图文字/).check()
    await firstImage.getByRole('button', { name: '保存图片核对结论', exact: true }).click()
    await expect(firstImage.getByText(/教师已通过/)).toBeVisible()
    await images.getByLabel(/授权所选页面调用/).uncheck()
    await images.getByRole('button', { name: '预留所选图片任务', exact: true }).click()
    await expect(images.getByRole('heading', { name: '第1页 · 复用缓存', exact: true })).toBeVisible()
    await images.getByLabel('图片页码', { exact: true }).selectOption('2')
    await images.getByLabel(/授权所选页面调用/).check()
    await images.getByRole('button', { name: '预留所选图片任务', exact: true }).click()
    await images.getByRole('button', { name: '取消此图片任务', exact: true }).click()
    await expect(images.getByRole('heading', { name: '第2页 · 已取消', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-design-images.png') })
    const imageProbe = spawnSync(python, ['-c', `
import hashlib, json, sqlite3, sys
from pathlib import Path
home, image = map(Path, sys.argv[1:])
calls = (home / 'image-fixture-calls.jsonl').read_text(encoding='utf-8').splitlines()
assert len(calls) == 1
with sqlite3.connect(home / 'plugin-data/teacher-assistant/teaching.db') as conn:
    states = [row[0] for row in conn.execute('SELECT state FROM slide_image_jobs ORDER BY created_at,id')]
    asset = conn.execute('SELECT sha256,verification_status,review_version FROM slide_image_assets').fetchone()
    analysis = json.loads(conn.execute("SELECT result_json FROM slide_image_jobs WHERE kind='analysis'").fetchone()[0])
assert sorted(states) == ['cached','cancelled','succeeded','succeeded'], states
assert asset[0] == hashlib.sha256(image.read_bytes()).hexdigest()
assert asset[1:] == ('approved', 1)
assert analysis['text_check'] == 'needs_correction' and analysis['missing_text']
assert len(analysis['layout']['elements']) > 1
print(json.dumps({'states': states, 'provider_calls': len(calls), 'sha256': asset[0], 'provider': 'offline fixture', 'text_check': analysis['text_check'], 'layout_elements': len(analysis['layout']['elements'])}))
`, home, imagePath], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(imageProbe.status, imageProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('image-receipt.json'), imageProbe.stdout)
    const reconstruction = page.getByRole('region', { name: '图片转可编辑课件', exact: true })
    await expect(reconstruction.getByLabel('视觉布局任务', { exact: true }).locator('option')).toHaveCount(2)
    const analysisId = await reconstruction.getByLabel('视觉布局任务', { exact: true }).locator('option').nth(1).getAttribute('value')
    await reconstruction.getByLabel('视觉布局任务', { exact: true }).selectOption(analysisId)
    await reconstruction.getByRole('button', { name: '从识别布局建立可编辑页面', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v1 · 草稿', exact: true })).toBeVisible()
    await expect(reconstruction.getByRole('alert').filter({ hasText: '页面缺少蓝图文字' }).first()).toBeVisible()
    await reconstruction.getByLabel('编辑页面对象', { exact: true }).selectOption({ label: 'title · 文字' })
    const requiredText = `${await page.getByLabel('页面标题', { exact: true }).inputValue()}\n${await page.getByLabel('准确可见文字', { exact: true }).inputValue()}`
    await reconstruction.getByLabel('对象文字', { exact: true }).fill(requiredText)
    await reconstruction.getByLabel('对象字号', { exact: true }).fill('24')
    await reconstruction.getByLabel('对象高度', { exact: true }).fill('120')
    await reconstruction.getByRole('button', { name: '保存页面对象为新版本', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v2 · 草稿', exact: true })).toBeVisible()
    await expect(reconstruction.getByRole('alert').filter({ hasText: '页面缺少蓝图文字' })).toHaveCount(0)
    await reconstruction.getByLabel('编辑页面对象', { exact: true }).selectOption({ label: 'detail-illustration · 图片' })
    await reconstruction.getByLabel('裁切宽度', { exact: true }).fill('80')
    await reconstruction.getByLabel('裁切高度', { exact: true }).fill('80')
    await reconstruction.getByLabel('对象宽度', { exact: true }).fill('80')
    await reconstruction.getByLabel('对象高度', { exact: true }).fill('80')
    await reconstruction.getByRole('button', { name: '保存页面对象为新版本', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v3 · 草稿', exact: true })).toBeVisible()
    await reconstruction.getByLabel(/已核对原生文字/).check()
    await reconstruction.getByLabel('可编辑页面审核意见', { exact: true }).fill('离线布局和固定设计图用于技术验证')
    await reconstruction.getByRole('button', { name: '审核通过可编辑页面', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v3 · 已审核', exact: true })).toBeVisible()
    const pptxPath = testInfo.outputPath('editable-page.pptx')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, pptxPath)
    await reconstruction.getByRole('button', { name: '下载单页可编辑PPTX', exact: true }).click()
    await expect.poll(() => existsSync(pptxPath)).toBe(true)
    const pptxProbe = spawnSync(python, ['-c', `
import hashlib, json, sqlite3, sys
from pathlib import Path
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
home, path = map(Path, sys.argv[1:])
with sqlite3.connect(home / 'plugin-data/teacher-assistant/teaching.db') as conn:
    digest = conn.execute('SELECT sha256 FROM slide_deck_exports').fetchone()[0]
    versions = conn.execute('SELECT version,status FROM slide_pages ORDER BY version').fetchall()
assert versions == [(1, 'draft'), (2, 'draft'), (3, 'approved')]
assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
slide = Presentation(path).slides[0]
pictures = [shape for shape in slide.shapes if shape.shape_type == MSO_SHAPE_TYPE.PICTURE]
assert len(pictures) == 1 and pictures[0].image.size == (80, 80)
assert 'UI教师修订的技术参数页' in next(shape for shape in slide.shapes if shape.name == 'title').text
assert any(shape.has_table for shape in slide.shapes)
print(json.dumps({'pages': 1, 'objects': len(slide.shapes), 'independent_image_crops': len(pictures), 'crop_size': pictures[0].image.size, 'versions': versions, 'sha256': digest}))
`, home, pptxPath], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(pptxProbe.status, pptxProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('pptx-receipt.json'), pptxProbe.stdout)
    const renderPanel = reconstruction.getByRole('region', { name: '实际渲染与设计图对照', exact: true })
    await renderPanel.getByRole('button', { name: '生成实际页面预览', exact: true }).click()
    await expect(renderPanel.getByText(/渲染完成 · WPS演示/)).toBeVisible({ timeout: 120000 })
    await renderPanel.getByRole('button', { name: '查看渲染对照', exact: true }).click()
    await expect(renderPanel.getByAltText('原始设计图', { exact: true })).toBeVisible()
    await expect(renderPanel.getByAltText('PPTX实际渲染图', { exact: true })).toBeVisible()
    await expect(renderPanel.getByAltText('像素差异图', { exact: true })).toBeVisible()
    const renderedPath = testInfo.outputPath('actual-render.png')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, renderedPath)
    await renderPanel.getByRole('button', { name: '下载实际渲染PNG', exact: true }).click()
    await expect.poll(() => existsSync(renderedPath)).toBe(true)
    const renderProbe = spawnSync(python, ['-c', `
import hashlib, json, sqlite3, sys
from pathlib import Path
from PIL import Image
home, output = map(Path, sys.argv[1:])
with sqlite3.connect(home / 'plugin-data/teacher-assistant/teaching.db') as conn:
    conn.row_factory = sqlite3.Row
    row = dict(conn.execute('SELECT * FROM slide_render_jobs').fetchone())
    export = dict(conn.execute('SELECT * FROM slide_deck_exports WHERE id=?', (row['export_id'],)).fetchone())
assert row['state'] == 'succeeded'
assert hashlib.sha256(output.read_bytes()).hexdigest() == row['sha256']
with Image.open(output) as image:
    assert image.size == (1600,900) and image.format == 'PNG'
comparison = json.loads(row['comparison_json'])
assert comparison['pptx_sha256'] == export['sha256']
assert hashlib.sha256(Path(export['stored_path']).read_bytes()).hexdigest() == export['sha256']
assert 0 <= comparison['mean_absolute_rgb_error'] <= 255
print(json.dumps({'renderer': row['renderer'], 'renderer_version': row['renderer_version'], 'sha256': row['sha256'], 'comparison': comparison, 'input_unchanged': True}, ensure_ascii=False))
`, home, renderedPath], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(renderProbe.status, renderProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('render-receipt.json'), renderProbe.stdout)
    await page.screenshot({ path: testInfo.outputPath('teacher-render-comparison.jpg'), type: 'jpeg', quality: 85 })
    await reconstruction.getByLabel('编辑页面对象', { exact: true }).selectOption({ label: 'title · 文字' })
    await reconstruction.getByLabel('对象字号', { exact: true }).fill('160')
    await reconstruction.getByRole('button', { name: '保存页面对象为新版本', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v4 · 草稿', exact: true })).toBeVisible()
    await renderPanel.getByRole('button', { name: '生成实际页面预览', exact: true }).click()
    await expect(renderPanel.getByText(/超框区域 1/)).toBeVisible({ timeout: 120000 })
    await renderPanel.getByRole('button', { name: '按实测字号修复并生成预览', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v5 · 草稿', exact: true })).toBeVisible({ timeout: 120000 })
    await expect(renderPanel.getByText(/超框区域 0/)).toBeVisible()
    await expect(reconstruction.getByRole('status').filter({ hasText: '依据实际文字边界修复了1个对象' })).toBeVisible()
    const repairProbe = spawnSync(python, ['-c', `
import json,sqlite3,sys
from pathlib import Path
with sqlite3.connect(Path(sys.argv[1]) / 'plugin-data/teacher-assistant/teaching.db') as conn:
    conn.row_factory = sqlite3.Row
    pages = [dict(row) for row in conn.execute('SELECT id,version,status,layout_json FROM slide_pages ORDER BY version')]
    repair = dict(conn.execute('SELECT * FROM slide_page_repairs').fetchone())
    before = dict(conn.execute('SELECT * FROM slide_render_jobs WHERE page_id=?', (pages[-2]['id'],)).fetchone())
    after = dict(conn.execute('SELECT * FROM slide_render_jobs WHERE page_id=?', (pages[-1]['id'],)).fetchone())
assert [page['status'] for page in pages] == ['draft','draft','approved','draft','draft']
old_layout, new_layout = [json.loads(page['layout_json']) for page in pages[-2:]]
old_title, new_title = [next(element for element in layout['elements'] if element['name']=='title') for layout in [old_layout,new_layout]]
assert old_title['font_size'] == 160 and 32 <= new_title['font_size'] < 160
assert old_title['text'] == new_title['text']
source_bounds = json.loads(before['comparison_json'])['text_bounds']
target_bounds = json.loads(after['comparison_json'])['text_bounds']
assert source_bounds['overflow_regions'] == 1 and target_bounds['overflow_regions'] == 0
assert target_bounds['missing_regions'] == 0 and target_bounds['measured_regions'] == 16
assert repair['render_job_id'] == before['id'] and repair['page_id'] == pages[-1]['id']
print(json.dumps({'before_font_pixels':old_title['font_size'],'after_font_pixels':new_title['font_size'],'before':source_bounds,'after':target_bounds,'approved_version':3,'repair_version':5,'renderer':after['renderer']},ensure_ascii=False))
`, home], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(repairProbe.status, repairProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('text-fit-receipt.json'), repairProbe.stdout)
    await reconstruction.getByLabel('编辑页面对象', { exact: true }).selectOption({ label: 'comparison-table · 表格' })
    await reconstruction.getByLabel('对象字号', { exact: true }).fill('100')
    await reconstruction.getByRole('button', { name: '保存页面对象为新版本', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v6 · 草稿', exact: true })).toBeVisible()
    await renderPanel.getByRole('button', { name: '生成实际页面预览', exact: true }).click()
    await expect(renderPanel.getByText(/超框区域 9/)).toBeVisible({ timeout: 120000 })
    await renderPanel.getByRole('button', { name: '按实测字号修复并生成预览', exact: true }).click()
    await expect(reconstruction.getByRole('heading', { name: '可编辑第1页 · v7 · 草稿', exact: true })).toBeVisible({ timeout: 120000 })
    await expect(renderPanel.getByText(/超框区域 0/)).toBeVisible()
    const tableFitProbe = spawnSync(python, ['-c', `
import json,sqlite3,sys
from pathlib import Path
with sqlite3.connect(Path(sys.argv[1]) / 'plugin-data/teacher-assistant/teaching.db') as conn:
    conn.row_factory = sqlite3.Row
    pages = [dict(row) for row in conn.execute('SELECT id,version,status,layout_json FROM slide_pages ORDER BY version')]
    source = dict(conn.execute('SELECT * FROM slide_render_jobs WHERE page_id=?', (pages[-2]['id'],)).fetchone())
    target = dict(conn.execute('SELECT * FROM slide_render_jobs WHERE page_id=?', (pages[-1]['id'],)).fetchone())
    repairs = conn.execute('SELECT COUNT(*) FROM slide_page_repairs').fetchone()[0]
assert pages[2]['status']=='approved' and pages[-1]['status']=='draft' and repairs==2
tables = [next(element for element in json.loads(page['layout_json'])['elements'] if element['name']=='comparison-table') for page in pages[-2:]]
assert tables[0]['font_size']==100 and 32 <= tables[1]['font_size'] < 100
assert tables[0]['rows']==tables[1]['rows']
before, after = [json.loads(job['comparison_json'])['text_bounds'] for job in [source,target]]
assert before['overflow_regions']==9 and after['overflow_regions']==0 and after['missing_regions']==0
print(json.dumps({'before_font_pixels':tables[0]['font_size'],'after_font_pixels':tables[1]['font_size'],'before':before,'after':after,'approved_version':3,'repair_version':7,'renderer':target['renderer']},ensure_ascii=False))
`, home], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(tableFitProbe.status, tableFitProbe.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('table-fit-receipt.json'), tableFitProbe.stdout)
    await page.screenshot({ path: testInfo.outputPath('teacher-text-fit.jpg'), type: 'jpeg', quality: 85 })
    await reconstruction.getByRole('button', { name: '下载完整可编辑PPTX', exact: true }).click()
    await expect(reconstruction.getByRole('alert').filter({ hasText: '第2页尚无已审核的可编辑版本' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-editable-page.png') })
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
