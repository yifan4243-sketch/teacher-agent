import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const extension = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const repo = resolve(extension, '../..')
const require = createRequire(join(repo, 'apps/desktop/package.json'))
export const { test, expect } = require('@playwright/test')
const { _electron } = require('@playwright/test')

export async function withTeacherDesktop(testInfo, action, backendArgs = []) {
  const home = mkdtempSync(join(process.env.TEMP, 'teacher-desktop-'))
  const plugin = join(home, 'plugins/teacher-assistant')
  mkdirSync(dirname(plugin), { recursive: true })
  cpSync(extension, plugin, { recursive: true, filter: path => !['test-results', '__pycache__', 'phase0-evidence'].includes(path.split(/[\\/]/).at(-1)) })
  const probe = spawnSync(process.env.HERMES_PYTHON || 'python', ['-c', 'from pm.testenv import testenv_python; from pathlib import Path; import sys; print(testenv_python(Path.cwd()) or sys.executable)'], { cwd: repo, env: process.env, encoding: 'utf8', windowsHide: true })
  expect(probe.status, probe.stderr).toBe(0)
  const python = probe.stdout.trim()
  const env = { ...process.env, HERMES_HOME: home, HERMES_DESKTOP_HERMES_ROOT: repo, HERMES_DESKTOP_PYTHON: python,
    HERMES_DESKTOP_USER_DATA_DIR: join(home, 'desktop-user-data'), HERMES_DESKTOP_IGNORE_EXISTING: '1',
    HERMES_DESKTOP_SKIP_PROTOCOL_REGISTRATION: '1', HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1' }
  const backend = spawn(python, ['-m', 'tests.extensions.teacher_ui_backend', home, ...backendArgs], { cwd: repo, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const backendLog = [], rendererLog = []
  backend.stderr.on('data', chunk => backendLog.push(String(chunk)))
  const lines = createInterface({ input: backend.stdout })
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
    await action({ app, page, home, python, env, repo })
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
}
