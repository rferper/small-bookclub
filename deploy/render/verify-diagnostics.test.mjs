import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest, diagnostics, failureKind, json, VerificationFailure } from './verify-diagnostics.mjs'

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
