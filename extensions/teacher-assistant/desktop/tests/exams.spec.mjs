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

test('教师通过真实Agent会话命题审核并导出隔离答案的试卷', async ({}, testInfo) => {
  const home = mkdtempSync(join(process.env.TEMP, 'teacher-exams-'))
  const plugin = join(home, 'plugins/teacher-assistant')
  mkdirSync(dirname(plugin), { recursive: true })
  cpSync(extension, plugin, { recursive: true, filter: path => !['test-results', '__pycache__', 'phase0-evidence'].includes(path.split(/[\\/]/).at(-1)) })
  const probe = spawnSync(process.env.HERMES_PYTHON || 'python', ['-c', 'from pm.testenv import testenv_python; from pathlib import Path; import sys; print(testenv_python(Path.cwd()) or sys.executable)'], { cwd: repo, env: process.env, encoding: 'utf8', windowsHide: true })
  expect(probe.status, probe.stderr).toBe(0)
  const python = probe.stdout.trim()
  const env = { ...process.env, HERMES_HOME: home, HERMES_DESKTOP_HERMES_ROOT: repo, HERMES_DESKTOP_PYTHON: python,
    HERMES_DESKTOP_USER_DATA_DIR: join(home, 'desktop-user-data'), HERMES_DESKTOP_IGNORE_EXISTING: '1',
    HERMES_DESKTOP_SKIP_PROTOCOL_REGISTRATION: '1', HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1' }
  const backend = spawn(python, ['-m', 'tests.extensions.teacher_ui_backend', home], { cwd: repo, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const backendLog = []
  backend.stderr.on('data', chunk => backendLog.push(String(chunk)))
  const lines = createInterface({ input: backend.stdout })
  const rendererLog = []
  let app
  try {
    const first = await lines[Symbol.asyncIterator]().next()
    expect(JSON.parse(first.value).ready).toBe(true)
    app = await _electron.launch({ executablePath: require('electron'), args: [join(repo, 'apps/desktop')], cwd: repo, env, timeout: 120000 })
    const page = await app.firstWindow()
    page.on('console', message => rendererLog.push(`${message.type()}: ${message.text()}`))
    page.on('pageerror', error => rendererLog.push(error.stack))
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: '技能与工具', exact: true }).click({ timeout: 150000 })
    await page.getByText('插件', { exact: true }).click()
    await page.getByRole('switch', { name: '教师专业工作台', exact: true }).click()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByLabel('课程名称', { exact: true }).fill('虚构命题课程')
    await page.getByRole('button', { name: '保存课程', exact: true }).click()
    await expect(page.getByRole('button', { name: '虚构命题课程', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '教材知识库', exact: true }).click()
    await page.getByLabel('教材所属课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await page.getByLabel('教材名称', { exact: true }).fill('虚构命题教材')
    await page.getByLabel('教材文件', { exact: true }).setInputFiles({ name: '命题测试教材.txt', mimeType: 'text/plain', buffer: Buffer.from('第一章 工业机器人\n1.1 自由度\n自由度描述机器人独立运动的数量。工作空间指机器人末端能够到达的范围。\n', 'utf8') })
    await page.getByRole('button', { name: '上传并解析教材', exact: true }).click()
    await expect(page.getByText('教材已保存，原始文件和版本哈希已保留')).toBeVisible()
    await page.getByRole('button', { name: '考试命题', exact: true }).click()
    const workspace = page.getByRole('region', { name: '考试命题工作台', exact: true })
    await workspace.getByLabel('命题课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await workspace.getByLabel('命题教材版本', { exact: true }).selectOption({ label: '虚构命题教材 · v1' })
    await workspace.getByRole('button', { name: '新建命题方案', exact: true }).click()
    const editor = workspace.getByRole('region', { name: '命题方案编辑', exact: true })
    await editor.getByLabel('试卷名称', { exact: true }).fill('虚构课程命题集成试卷')
    await editor.getByLabel('单选题数量', { exact: true }).fill('1')
    await editor.getByLabel('简答题数量', { exact: true }).fill('1')
    await editor.getByLabel('中等题数', { exact: true }).fill('2')
    await editor.getByLabel('试卷总分', { exact: true }).fill('10')
    await editor.getByLabel('考试时长', { exact: true }).fill('90')
    await editor.getByLabel('学生学习水平', { exact: true }).fill('职业教育一年级，已掌握基础术语')
    await editor.getByRole('button', { name: '保存命题方案', exact: true }).click()
    const plan = workspace.getByRole('region', { name: '命题方案详情', exact: true })
    await expect(plan.getByText('单选题1题 · 简答题1题 · 满分10.00分 · 90分钟', { exact: true })).toBeVisible()
    await plan.getByLabel('允许本次Hermes Agent命题，可能产生模型费用', { exact: true }).check()
    await plan.getByRole('button', { name: '启动Agent命题', exact: true }).click()
    await expect(page.getByText('本地模拟模型已保存试卷草稿，请教师审核。', { exact: true })).toBeVisible({ timeout: 120000 })
    await page.getByText('教师工作台', { exact: true }).click()
    await page.getByRole('button', { name: '考试命题', exact: true }).click()
    await workspace.getByLabel('命题课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await workspace.getByRole('button', { name: '虚构课程命题集成试卷 · v1 · 待审核', exact: true }).click()
    const paper = workspace.getByRole('region', { name: '试卷详情与审核', exact: true })
    await expect(paper.getByText('2题 · 满分10.00分 · 90分钟', { exact: true })).toBeVisible()
    await paper.getByRole('button', { name: '通过试卷审核', exact: true }).click()
    await expect(paper.getByRole('alert')).toHaveText('请先在题库审核试卷使用的每个题目版本')
    for (const details of await paper.locator(':scope > details').all()) {
      await details.locator('summary').first().click()
      await details.getByRole('button', { name: '通过题目审核', exact: true }).click()
      await expect(details.getByRole('heading')).toContainText('已通过')
    }
    await paper.getByLabel('试卷审核说明', { exact: true }).fill('逐题核对虚构教材、答案、解析和评分要点')
    await paper.getByRole('button', { name: '通过试卷审核', exact: true }).click()
    await expect(paper.getByRole('heading', { name: '虚构课程命题集成试卷 · v1 · 已通过', exact: true })).toBeVisible()
    const outputs = []
    for (const audience of ['student', 'teacher']) {
      for (const format of ['docx', 'pdf']) {
        const path = testInfo.outputPath(`exam-${audience}.${format}`)
        await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }) }, path)
        await paper.getByLabel('试卷导出版本', { exact: true }).selectOption(audience)
        await paper.getByLabel('试卷导出格式', { exact: true }).selectOption(format)
        await paper.getByRole('button', { name: '下载试卷', exact: true }).click()
        await expect.poll(() => existsSync(path)).toBe(true)
        outputs.push(path)
      }
    }
    await page.screenshot({ path: testInfo.outputPath('teacher-exam-reviewed.jpg'), type: 'jpeg', quality: 85 })
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByRole('button', { name: '考试命题', exact: true }).click()
    await workspace.getByLabel('命题课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await workspace.getByRole('button', { name: '虚构课程命题集成试卷 · v1 · 已通过', exact: true }).click()
    await expect(paper.getByRole('heading')).toHaveText('虚构课程命题集成试卷 · v1 · 已通过')
    await page.getByRole('button', { name: '班级', exact: true }).click()
    await page.getByLabel('班级名称', { exact: true }).fill('虚构评分班级')
    await page.getByRole('button', { name: '保存班级', exact: true }).click()
    await expect(page.getByRole('button', { name: '虚构评分班级', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '学生档案', exact: true }).click()
    await page.getByLabel('学号', { exact: true }).fill('GRADE-UI-001')
    await page.getByLabel('学生姓名', { exact: true }).fill('虚构评分学生')
    await page.getByLabel('所属班级', { exact: true }).selectOption({ label: '虚构评分班级' })
    await page.getByRole('button', { name: '保存学生', exact: true }).click()
    await expect(page.getByRole('button', { name: '虚构评分学生', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '课程身份关联', exact: true }).click()
    await page.getByLabel('课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await page.getByLabel('班级', { exact: true }).selectOption({ label: '虚构评分班级' })
    await page.getByRole('button', { name: '关联班级', exact: true }).click()
    await expect(page.getByText('授课班级 · 虚构评分班级', { exact: true })).toBeVisible()
    await page.getByLabel('学生', { exact: true }).selectOption({ label: '虚构评分学生' })
    await page.getByRole('button', { name: '登记选课', exact: true }).click()
    await expect(page.getByText('已登记 1 名学生', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '答卷与成绩', exact: true }).click()
    const grading = page.getByRole('region', { name: '答卷评分工作台', exact: true })
    await grading.getByLabel('批改课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await grading.getByLabel('批改试卷版本', { exact: true }).selectOption({ label: '虚构课程命题集成试卷 · v1' })
    await grading.getByLabel('答卷学生', { exact: true }).selectOption({ label: '虚构评分学生 · GRADE-UI-001' })
    await grading.getByRole('button', { name: '录入学生答卷', exact: true }).click()
    const answerForm = grading.getByRole('form', { name: '学生答卷录入', exact: true })
    await answerForm.locator('input[type=radio][value=A]').check()
    await answerForm.getByLabel('第2题文字答案', { exact: true }).fill('自由度是机器人独立运动的数量。')
    await answerForm.getByRole('button', { name: '保存学生答卷', exact: true }).click()
    await grading.getByRole('button', { name: '计算评分草稿', exact: true }).click()
    const review = grading.getByRole('form', { name: '教师评分复核', exact: true })
    await expect(review.getByText('客观题自动得分 5.00分 · 主观题1题', { exact: true })).toBeVisible()
    await expect(grading.getByText('当前试卷尚未发布正式成绩。', { exact: true })).toBeVisible()
    const assist = grading.getByRole('region', { name: '主观题辅助批改', exact: true })
    await assist.getByLabel('已检查本次答案，允许将主观题答案及评分标准发送给模型，可能产生费用', { exact: true }).check()
    await assist.getByRole('button', { name: '启动主观题辅助批改', exact: true }).click()
    await expect(page.getByText('本地模拟模型已保存主观题评分建议，请教师逐题复核。', { exact: true })).toBeVisible({ timeout: 120000 })
    await page.getByText('教师工作台', { exact: true }).click()
    await page.getByRole('button', { name: '答卷与成绩', exact: true }).click()
    await grading.getByRole('button', { name: '刷新答卷与成绩', exact: true }).click()
    await expect(review.getByRole('status')).toHaveText('模型建议 4.00分 · 置信度40% · 请重点人工核查')
    await expect(grading.getByText('当前试卷尚未发布正式成绩。', { exact: true })).toBeVisible()
    await review.getByLabel('第2题评分要点2得分', { exact: true }).fill('1.50')
    await review.getByLabel('成绩复核说明', { exact: true }).fill('教师复核低置信度建议，第二要点评为1.50分')
    await review.getByRole('checkbox').check()
    await review.getByRole('button', { name: '教师确认发布成绩', exact: true }).click()
    const gradeRecords = grading.getByRole('region', { name: '正式成绩记录', exact: true })
    await expect(gradeRecords.getByRole('button', { name: '虚构评分学生 · 9.50分', exact: true })).toBeVisible()
    await expect(gradeRecords.getByText(/失分0.50分/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('teacher-grading-reviewed.jpg'), type: 'jpeg', quality: 85 })
    await grading.getByRole('button', { name: '重新计算评分草稿', exact: true }).click()
    await expect(review.getByRole('heading')).toHaveText('评分草稿v3')
    await review.getByLabel('第2题评分要点1得分', { exact: true }).fill('3')
    await review.getByLabel('第2题评分要点2得分', { exact: true }).fill('2')
    await review.getByLabel('成绩复核说明', { exact: true }).fill('教师再次核对全部答案后更正为满分，保留前次成绩')
    await review.getByRole('checkbox').check()
    await review.getByRole('button', { name: '教师确认发布成绩', exact: true }).click()
    await expect(gradeRecords.getByRole('button', { name: '虚构评分学生 · 10.00分', exact: true })).toBeVisible()
    await gradeRecords.getByRole('button', { name: '查看前次成绩', exact: true }).click()
    await expect(gradeRecords.getByText('复核总分 9.50分 · 历史成绩', { exact: true })).toBeVisible()
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByRole('button', { name: '答卷与成绩', exact: true }).click()
    await grading.getByLabel('批改课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await grading.getByLabel('批改试卷版本', { exact: true }).selectOption({ label: '虚构课程命题集成试卷 · v1' })
    await expect(gradeRecords.getByRole('button', { name: '虚构评分学生 · 10.00分', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '考试命题', exact: true }).click()
    await workspace.getByLabel('命题课程', { exact: true }).selectOption({ label: '虚构命题课程' })
    await workspace.getByRole('button', { name: '虚构课程命题集成试卷 · v1 · 已通过', exact: true }).click()
    await paper.getByRole('button', { name: '修订试卷', exact: true }).click()
    const assembly = workspace.getByRole('region', { name: '题库组卷', exact: true })
    await expect(assembly.getByText('已选2题 · 合计10.00分', { exact: true })).toBeVisible()
    await assembly.getByRole('button', { name: '下移', exact: true }).first().click()
    await assembly.getByRole('button', { name: '保存试卷版本', exact: true }).click()
    await expect(paper.getByRole('heading', { name: '虚构课程命题集成试卷 · v2 · 待审核', exact: true })).toBeVisible()
    await paper.getByRole('button', { name: '通过试卷审核', exact: true }).click()
    await expect(paper.getByRole('heading', { name: '虚构课程命题集成试卷 · v2 · 已通过', exact: true })).toBeVisible()
    await workspace.getByRole('button', { name: '虚构课程命题集成试卷 · v1 · 已通过', exact: true }).click()
    await expect(paper.getByRole('heading')).toHaveText('虚构课程命题集成试卷 · v1 · 已通过')
    const verify = spawnSync(python, ['-c', `
import json,sqlite3,sys
from pathlib import Path
from docx import Document
from pypdf import PdfReader
with sqlite3.connect(Path(sys.argv[1])/'plugin-data/teacher-assistant/teaching.db') as conn:
    conn.row_factory=sqlite3.Row
    generation=dict(conn.execute('SELECT * FROM exam_generations').fetchone())
    task=dict(conn.execute('SELECT * FROM workflows WHERE id=?',(generation['workflow_id'],)).fetchone())
    assert task['status']=='completed' and generation['stored_session_id']
    assert conn.execute('SELECT COUNT(*) FROM exam_questions').fetchone()[0]==4
    papers=conn.execute('SELECT id,version,status FROM exam_papers ORDER BY version').fetchall()
    assert [(row['version'],row['status']) for row in papers]==[(1,'approved'),(2,'approved')]
    orders=[[row[0] for row in conn.execute('SELECT question_id FROM exam_questions WHERE paper_id=? ORDER BY ordinal',(paper['id'],))] for paper in papers]
    assert orders[0]==list(reversed(orders[1]))
    publications=conn.execute('SELECT total_points_centi,active FROM grade_publications ORDER BY rowid').fetchall()
    assert [(row[0],row[1]) for row in publications]==[(950,0),(1000,1)]
    grading_task=conn.execute("SELECT status FROM workflows WHERE kind='grading_generation'").fetchone()[0]
    assert grading_task=='completed'
    assert conn.execute('SELECT COUNT(*) FROM grade_wrong_questions').fetchone()[0]==1
    assert not conn.execute('PRAGMA foreign_key_check').fetchall()
for index,path in enumerate(sys.argv[2:]):
    text='\\n'.join(p.text for p in Document(path).paragraphs) if path.endswith('.docx') else '\\n'.join(p.extract_text() for p in PdfReader(path).pages)
    assert ('模拟解析仅教师可见' in text)==(index>=2)
    assert ('评分要点' in text)==(index>=2)
print(json.dumps({'home':sys.argv[1],'backend':'real Hermes Gateway and Agent loop','model':'loopback scripted test provider','questions':2,'reviewed_paper_versions':2,'manual_reorder':True,'workflow_completed':True,'exports':4,'student_answer_isolation':True,'grade_history_centi':[950,1000],'low_confidence_human_review':True,'grading_workflow_completed':True,'reload_persistence':True},ensure_ascii=False))
`, home, ...outputs], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(verify.status, verify.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('exam-receipt.json'), verify.stdout)
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
