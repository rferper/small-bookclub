import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const { parse } = createRequire(new URL('../frontend/package.json', import.meta.url))('yaml')
const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
test('actual aggregate shell rejects failed, skipped and cancelled security checks', () => {
  const required = workflow.jobs.required
  assert.ok(required.needs.includes('security'))
  assert.equal(required.if, 'always()')
  const step = required.steps.find(item => item.name === 'Require every job to succeed')
  assert.equal(step.env.SECURITY_RESULT, '${{ needs.security.result }}')
  const environment = Object.fromEntries(Object.keys(step.env).map(key => [key, 'success']))
  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
  const invoke = env => spawnSync(shell, ['-e', '-c', step.run], { env: { ...process.env, ...env },
    encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000 })
  assert.equal(invoke(environment).status, 0)
  for (const status of ['failure', 'skipped', 'cancelled', '']) {
    const result = invoke({ ...environment, SECURITY_RESULT: status })
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0)
  }
})
test('security job uses complete history and uploads only the projected summary', () => {
  const job = workflow.jobs.security
  assert.equal(workflow.permissions.contents, 'read')
  assert.equal(job.steps.find(item => item.uses === 'actions/checkout@v4').with['fetch-depth'], 0)
  const artifacts = job.steps.filter(item => item.uses?.startsWith('actions/upload-artifact@'))
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0].with.path, '${{ runner.temp }}/bookclub-security-report/scan-summary.json')
  assert.equal(artifacts[0].with['retention-days'], 3)
  assert.ok(job.steps.every(item => item['continue-on-error'] !== true))
})
