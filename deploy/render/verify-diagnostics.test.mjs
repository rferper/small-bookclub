import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { apiRequest, diagnostics, failureKind, faultProbe, json, saveProfile, VerificationFailure } from './verify-diagnostics.mjs'

test('post-smoke failure reports exact active environment, phase and prior completed phase', async () => {
  const lines = [], d = diagnostics(line => lines.push(line))
  await d.phase('production-demo', 'native-smoke', async () => {})
  const error = Object.assign(new Error('Cookie: fictional-secret'), { name: 'TimeoutError' })
  await assert.rejects(d.phase('staging', 'profile-edit', async () => { throw error }))
  d.fail(error)
  assert.match(lines.at(-1), /"environment":"staging","phase":"profile-edit"/)
  assert.match(lines.at(-1), /"lastCompleted":\{"environment":"production-demo","phase":"native-smoke"\}/)
  assert.match(lines.at(-1), /"classification":"TIMEOUT"/)
  assert.ok(!lines.join('').includes('fictional-secret'))
})

test('diagnostics retain bounded fixed request context and reject secret-bearing values', () => {
  const lines = [], d = diagnostics(line => lines.push(line))
  d.request('POST', 'https://fictional.invalid/api/auth/demo?key=fictional-secret', 'net::ERR_CONNECTION_RESET')
  d.request('GET', 'https://fictional.invalid/api/me/profile', 502)
  d.request('GET', 'https://fictional.invalid/api/me/profile', 'net::ERR_FAILED fictional-secret')
  d.request('GET', 'https://fictional.invalid/fictional-secret', 500)
  d.request('fictional-secret', 'https://fictional.invalid/api/session', 500)
  for (let i = 0; i < 20; i++) d.request('GET', 'https://fictional.invalid/api/session', 503)
  d.fail(new Error('fictional-secret'))
  assert.match(lines[0], /ERR_CONNECTION_RESET/)
  assert.match(lines[0], /UNKNOWN_NETWORK_FAILURE/)
  assert.ok(!lines.join('').includes('fictional-secret'))
  assert.equal(JSON.parse(lines[0].split('Render verification failed: ')[1]).requests.length, 8)
})

test('request failures preserve fixed context without reflecting Playwright automatic cookie logs', async () => {
  const lines = [], d = diagnostics(line => lines.push(line))
  const context = { request: { get: async () => { throw new Error('Cookie: fictional-secret') } } }
  try { await apiRequest(context, 'GET', '/api/session', {}, 200, d, 'https://fictional.invalid') }
  catch (error) { assert.equal(failureKind(error), 'REQUEST_FAILED'); d.fail(error) }
  assert.ok(!lines.join('').includes('fictional-secret'))
})

test('HTTP mismatch and invalid JSON fail rather than hiding failed bootstrap', async () => {
  const lines = [], d = diagnostics(line => lines.push(line))
  await assert.rejects(apiRequest({ request: { get: async () => ({ status: () => 502 }) } },
    'GET', '/api/session', {}, 200, d, 'https://fictional.invalid'), error => failureKind(error) === 'HTTP_STATUS')
  await assert.rejects(json({ json: async () => { throw new Error('fictional-secret') } }),
    error => failureKind(error) === 'INVALID_JSON' && !error.message.includes('fictional-secret'))
})

test('API timeout remains distinct from browser locator timeout and request failures', async () => {
  const context = { request: { get: async () => { throw Object.assign(new Error('fictional-secret'), { name: 'TimeoutError' }) } } }
  await assert.rejects(apiRequest(context, 'GET', '/api/session', {}, 200, diagnostics(() => {}), 'https://fictional.invalid'),
    error => failureKind(error) === 'API_TIMEOUT' && !error.message.includes('fictional-secret'))
})

test('classification never reflects arbitrary names, codes or controlled-error kinds', () => {
  assert.equal(failureKind({ name: 'fictional-secret', code: 'fictional-secret' }), 'UNKNOWN_FAILURE')
  assert.equal(failureKind(new VerificationFailure('fictional-secret')), 'UNKNOWN_FAILURE')
  assert.equal(failureKind({ code: 'ERR_ASSERTION', message: 'fictional-secret' }), 'ASSERTION')
  assert.equal(failureKind(new VerificationFailure('COMMAND_FAILED')), 'COMMAND_FAILED')
})

test('unknown environments and phases cannot enter output', async () => {
  const lines = [], d = diagnostics(line => lines.push(line))
  await assert.rejects(d.phase('fictional-secret', 'profile-edit', async () => {}))
  await assert.rejects(d.phase('staging', 'fictional-secret', async () => {}))
  assert.deepEqual(lines, [])
})

test('profile response rejection while a click is pending is caught, never unhandled', () => {
  const fixture = `
    const page = {
      waitForResponse: () => Promise.reject(new Error('fictional-request-failure')),
      getByRole: () => ({ click: () => new Promise(resolve => setTimeout(resolve, 50)) }),
    };
  `
  // The former sequence exits through Node's unhandled-rejection path before
  // the delayed click completes; this is a controlled reproduction, not a
  // claim about the cause of the earlier CI failures.
  const baseline = spawnSync(process.execPath, ['--unhandled-rejections=strict', '--input-type=module', '-e', `${fixture}
    try { const saved = page.waitForResponse(); await page.getByRole().click(); await saved }
    catch { console.log('controlled-catch') }
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(baseline.status, 1)
  assert.ok(!baseline.stdout.includes('controlled-catch'))
  const corrected = spawnSync(process.execPath, ['--unhandled-rejections=strict', '--input-type=module', '-e', `
    import { saveProfile, diagnostics } from ${JSON.stringify(new URL('./verify-diagnostics.mjs', import.meta.url).href)};
    ${fixture}
    try { await saveProfile(page) } catch (error) { diagnostics().fail(error); process.exitCode = 1 }
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(corrected.status, 1, 'The injected failure must still fail verification')
  assert.match(corrected.stdout, /Render verification failed:/)
  assert.ok(!`${corrected.stdout}${corrected.stderr}`.includes('fictional-request-failure'))
  assert.equal(corrected.stderr, '')
})

test('profile save checks the actual response status and observes a failed click', async () => {
  for (const status of [200, 403, 500]) {
    const page = { waitForResponse: async () => ({ status: () => status }), getByRole: () => ({ click: async () => {} }) }
    if (status === 200) await saveProfile(page)
    else await assert.rejects(saveProfile(page), error => failureKind(error) === 'HTTP_STATUS')
  }
  const page = { waitForResponse: () => new Promise(() => {}), getByRole: () => ({ click: async () => { throw new Error('controlled') } }) }
  await assert.rejects(saveProfile(page))
})

test('explicit local fault probes are closed and inject once only in the selected staging phase', () => {
  assert.throws(() => faultProbe(['fictional-secret']), { message: 'Invalid verifier arguments' })
  assert.throws(() => faultProbe(['--fault=cleanup', 'fictional-secret']))
  assert.doesNotThrow(() => faultProbe([])('staging', 'cleanup'))
  for (const [phase, kind] of [['api-bootstrap', 'REQUEST_FAILED'], ['profile-edit', 'TIMEOUT'], ['cleanup', 'COMMAND_FAILED']]) {
    const probe = faultProbe([`--fault=${phase}`])
    assert.doesNotThrow(() => probe('production-demo', phase))
    assert.doesNotThrow(() => probe('staging', 'configuration'))
    assert.throws(() => probe('staging', phase), error => failureKind(error) === kind)
    assert.doesNotThrow(() => probe('staging', phase))
  }
})
