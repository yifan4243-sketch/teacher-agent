import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { test, expect, withTeacherDesktop } from './teacher-desktop.mjs'

test('教师上传扫描答卷、取消重试、核对低置信答案并发布成绩', async ({}, testInfo) => {
  await withTeacherDesktop(testInfo, async ({ app, page, home, python, env, repo }) => {
    await page.getByRole('button', { name: '答卷与成绩', exact: true }).click()
    const grading = page.getByRole('region', { name: '答卷评分工作台', exact: true })
    await grading.getByLabel('批改课程', { exact: true }).selectOption({ label: 'DOCX文档测试课程' })
    await grading.getByLabel('批改试卷版本', { exact: true }).selectOption({ label: '虚构评分试卷 · v1' })
    await grading.getByLabel('答卷学生', { exact: true }).selectOption({ label: '虚构评分学生 · GRADING-001' })
    const recognition = grading.getByRole('region', { name: '图片与扫描答卷识别', exact: true })
    await recognition.getByLabel('答卷图片或PDF', { exact: true }).setInputFiles(join(home, 'synthetic-scanned-answer.pdf'))
    await recognition.getByRole('button', { name: '上传答卷原件', exact: true }).click()
    await expect(recognition.getByText('答卷原件已保存', { exact: true })).toBeVisible()
    await expect(recognition.getByRole('img', { name: '答卷原页第1页预览', exact: true })).toBeVisible()
    await recognition.getByLabel('答卷预览页号', { exact: true }).fill('2')
    await expect(recognition.getByRole('img', { name: '答卷原页第2页预览', exact: true })).toBeVisible()
    await recognition.getByLabel('识别预算（美元）', { exact: true }).fill('0.01')
    await recognition.getByRole('button', { name: '保存识别预算', exact: true }).click()
    await expect(recognition.getByText('预算 $0.010000 · 预留 $0.000000 · 已记录 $0.000000', { exact: true })).toBeVisible()
    await recognition.getByLabel('每页估算（美元）', { exact: true }).fill('0.001')
    await recognition.getByLabel('允许将所选学生答卷页面发送给已配置的批改视觉模型，并接受估算费用', { exact: true }).check()
    await recognition.getByRole('button', { name: '预留识别任务', exact: true }).click()
    await expect(recognition.getByText('已选 2 个任务', { exact: true })).toBeVisible()
    await recognition.getByRole('button', { name: '取消第2页任务', exact: true }).click()
    await expect(recognition.getByText(/第2页 · 已取消/)).toBeVisible()
    await recognition.getByRole('button', { name: '预留识别任务', exact: true }).click()
    await expect(recognition.getByRole('button', { name: '取消第2页任务', exact: true })).toBeVisible()
    await recognition.getByRole('button', { name: '运行已选识别任务', exact: true }).click()
    await expect(recognition.getByText(/第1页 · 成功/)).toBeVisible({ timeout: 120000 })
    await expect(recognition.getByText(/第2页 · 成功/)).toBeVisible({ timeout: 120000 })
    await recognition.getByRole('button', { name: '合并已选结果并校对', exact: true }).click()
    const correction = recognition.getByRole('region', { name: '答卷识别校对', exact: true })
    await expect(correction.getByText('第5题 · 识别置信度不足，请核对原页', { exact: true })).toBeVisible()
    await correction.getByText('第1页识别原文与置信度', { exact: true }).click()
    const firstSource = correction.locator('details').filter({ has: page.getByText('第1页识别原文与置信度', { exact: true }) })
    await expect(firstSource.getByText('第5题 · 置信度40%', { exact: true })).toBeVisible()
    const answers = correction.getByRole('form', { name: '学生答卷录入', exact: true })
    await expect(answers.getByLabel('第5题文字答案', { exact: true })).toHaveValue('Independent motion count')
    await answers.getByLabel('第5题文字答案', { exact: true }).fill('自由度是独立运动的数量。')
    await answers.getByLabel('答卷备注', { exact: true }).fill('对照两页扫描原件完成识别校对')
    await firstSource.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('recognition-correction.jpg'), type: 'jpeg', quality: 85 })
    await answers.getByRole('button', { name: '保存学生答卷', exact: true }).click()
    await expect(grading.getByText('当前试卷尚未发布正式成绩。', { exact: true })).toBeVisible()
    await expect(grading.getByText('当前答卷v1 · 最新v1', { exact: true })).toHaveCount(0)
    await answers.getByLabel('已对照原页复核识别文字、低置信、跨页和待补全内容', { exact: true }).check()
    await answers.getByRole('button', { name: '保存学生答卷', exact: true }).click()
    await expect(grading.getByText('当前答卷v1 · 最新v1', { exact: true })).toBeVisible()
    await grading.getByRole('button', { name: '计算评分草稿', exact: true }).click()
    const review = grading.getByRole('form', { name: '教师评分复核', exact: true })
    await expect(review.getByText('客观题自动得分 20.01分 · 主观题1题', { exact: true })).toBeVisible()
    await review.getByLabel('第5题评分要点1得分', { exact: true }).fill('3')
    await review.getByLabel('第5题评分要点2得分', { exact: true }).fill('2')
    await review.getByLabel('成绩复核说明', { exact: true }).fill('已对照扫描原件和评分细则逐题复核')
    await review.getByLabel('已逐题核对答卷、自动评分和主观题评分要点，确认发布正式成绩', { exact: true }).check()
    await review.getByRole('button', { name: '教师确认发布成绩', exact: true }).click()
    await expect(grading.getByText('复核总分 25.01分 · 当前成绩', { exact: true })).toBeVisible()
    const report = testInfo.outputPath('recognition-grade-report.pdf')
    await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }) }, report)
    await grading.getByLabel('批改报告格式', { exact: true }).selectOption('pdf')
    await grading.getByRole('button', { name: '下载批改报告', exact: true }).click()
    await expect.poll(() => existsSync(report)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('recognized-grade.jpg'), type: 'jpeg', quality: 85 })
    await page.reload()
    await page.getByText('教师工作台', { exact: true }).click({ timeout: 90000 })
    await page.getByRole('button', { name: '答卷与成绩', exact: true }).click()
    await grading.getByLabel('批改课程', { exact: true }).selectOption({ label: 'DOCX文档测试课程' })
    await grading.getByLabel('批改试卷版本', { exact: true }).selectOption({ label: '虚构评分试卷 · v1' })
    await grading.getByLabel('答卷学生', { exact: true }).selectOption({ label: '虚构评分学生 · GRADING-001' })
    await expect(recognition.getByRole('button', { name: 'synthetic-scanned-answer.pdf · 2页', exact: true })).toBeVisible()
    const verify = spawnSync(python, ['-c', `
import hashlib,json,sqlite3,sys
from pathlib import Path
from pypdf import PdfReader
home=Path(sys.argv[1])
with sqlite3.connect(home/'plugin-data/teacher-assistant/teaching.db') as conn:
    assert conn.execute('PRAGMA user_version').fetchone()[0]==22
    file=conn.execute('SELECT sha256,page_count,stored_path FROM answer_files').fetchone()
    assert file[1]==2 and hashlib.sha256(Path(file[2]).read_bytes()).hexdigest()==file[0]
    assert conn.execute("SELECT COUNT(*) FROM recognition_jobs WHERE state='cancelled' AND attempted=0").fetchone()[0]==1
    assert conn.execute("SELECT COUNT(*) FROM recognition_jobs WHERE state='succeeded' AND attempted=1").fetchone()[0]==2
    assert conn.execute('SELECT COUNT(*) FROM submission_recognitions WHERE reviewed_uncertain=1').fetchone()[0]==2
    assert conn.execute('SELECT COUNT(*) FROM answer_submissions').fetchone()[0]==1
    assert conn.execute('SELECT total_points_centi FROM grade_publications').fetchone()[0]==2501
    assert not conn.execute('PRAGMA foreign_key_check').fetchall()
text='\\n'.join(page.extract_text() for page in PdfReader(sys.argv[2]).pages)
assert 'synthetic-scanned-answer.pdf' in text and file[0] in text and '25.01' in text
print(json.dumps({'home':str(home),'database_schema':22,'scanned_pages':2,'cancelled_before_dispatch':1,'recognized_pages':2,'teacher_corrected':True,'published_centi':2501,'model':'loopback scripted vision provider','real_ocr_quality_verified':False},ensure_ascii=False))
`, home, report], { cwd: repo, env, encoding: 'utf8', windowsHide: true })
    expect(verify.status, verify.stderr).toBe(0)
    writeFileSync(testInfo.outputPath('recognition-receipt.json'), verify.stdout)
  }, ['--recognition-fixture'])
})
