import assert from 'node:assert/strict'
import test from 'node:test'
import { containerState, evidenceEnabled, observeTransport, transportRecorder, version } from './transport-evidence.mjs'

const origin = 'https://localhost:12345'
function fixture() {
  const lines = []
  let now = 0, phase = 'demo-sign-in'
  const recorder = transportRecorder({ environment: 'staging', origin, phase: () => phase, now: () => now, write: line => lines.push(line) })
  return { recorder, lines, tick: value => { now = value }, phase: value => { phase = value } }
}
const request = (id, path = '/api/auth/demo', method = 'POST') => ({ requestId: id,
  request: { url: `${origin}${path}`, method, headers: { Cookie: 'fictional-secret' }, postData: 'fictional-secret' } })
const output = line => JSON.parse(line.split('Render transport evidence: ')[1])

test('transport investigation requires explicit opt-in, fictional environment, loopback HTTPS and local CA', () => {
  const env = { BOOKCLUB_RENDER_EVIDENCE: '1', BOOKCLUB_RENDER_WORLD: 'staging' }
  assert.equal(evidenceEnabled(env, origin, '/tmp/fictional.crt'), true)
  for (const url of ['https://example.invalid', 'http://localhost', `${origin}/other`, `${origin}?key=fictional-secret`, 'https://fictional-secret@localhost']) {
    assert.equal(evidenceEnabled(env, url, '/tmp/fictional.crt'), false)
  }
  assert.equal(evidenceEnabled({}, origin, '/tmp/fictional.crt'), false)
  assert.equal(evidenceEnabled(env, origin, undefined), false)
  assert.equal(evidenceEnabled({ ...env, BOOKCLUB_RENDER_WORLD: 'fictional-secret' }, origin, 'ca'), false)
})

test('completed request keeps only fixed context, actual HTTP protocol/status and bounded timing', () => {
  const { recorder, lines, tick, phase } = fixture()
  recorder.request(request('private-request-id', '/api/auth/demo?key=fictional-secret'))
  phase('home')
  recorder.response({ requestId: 'private-request-id', response: { status: 204, protocol: 'h2', headers: { 'set-cookie': 'fictional-secret' } } })
  tick(17)
  recorder.finished({ requestId: 'private-request-id', encodedDataLength: 999 })
  assert.deepEqual(output(lines[0]), { environment: 'staging', phase: 'demo-sign-in', method: 'POST', path: '/api/auth/demo',
    event: 'complete', protocol: 'h2', status: 204, durationMs: 17 })
  assert.ok(!lines[0].includes('fictional-secret'))
  assert.ok(!lines[0].includes('private-request-id'))
})

test('failed transport distinguishes response received, canceled and blocked without raw errors', () => {
  const { recorder, lines } = fixture()
  recorder.request(request('1', '/api/home', 'GET'))
  recorder.response({ requestId: '1', response: { protocol: 'http/1.1', status: 200 } })
  recorder.failed({ requestId: '1', errorText: 'net::ERR_ABORTED', canceled: true })
  recorder.request(request('2'))
  recorder.failed({ requestId: '2', errorText: 'net::ERR_FAILED Cookie: fictional-secret', blockedReason: 'fictional-secret' })
  assert.deepEqual(output(lines[0]), { environment: 'staging', phase: 'demo-sign-in', method: 'GET', path: '/api/home',
    event: 'failed', protocol: 'http/1.1', status: 200, durationMs: 0, code: 'ERR_ABORTED', canceled: true, blocked: false })
  assert.equal(output(lines[1]).status, 0)
  assert.equal(output(lines[1]).code, 'UNKNOWN_NETWORK_FAILURE')
  assert.equal(output(lines[1]).blocked, true)
  assert.ok(!lines.join('').includes('fictional-secret'))
})

test('unknown methods/paths/origins are omitted; unknown phases/protocols/status are closed', () => {
  const { recorder, lines, phase } = fixture()
  for (const event of [request('1', '/fictional-secret'), request('2', '/api/home', 'fictional-secret'),
    { requestId: '3', request: { method: 'GET', url: 'https://other.invalid/api/home' } }]) recorder.request(event)
  recorder.flush()
  assert.deepEqual(lines, [])
  phase('fictional-secret')
  recorder.request(request('4'))
  recorder.response({ requestId: '4', response: { status: 'fictional-secret', protocol: 'fictional-secret' } })
  recorder.flush()
  assert.equal(output(lines[0]).phase, 'unknown')
  assert.equal(output(lines[0]).protocol, 'unknown')
  assert.equal(output(lines[0]).status, 0)
  assert.equal(output(lines[0]).event, 'pending')
  assert.ok(!lines[0].includes('fictional-secret'))
})

test('both pending state and emitted evidence have hard bounds; durations clamp', () => {
  const { recorder, lines, tick } = fixture()
  for (let id = 0; id < 100; id++) recorder.request(request(String(id)))
  tick(999999)
  recorder.flush()
  recorder.request(request('extra'))
  recorder.finished({ requestId: 'extra' })
  assert.equal(lines.length, 64)
  assert.equal(output(lines[0]).durationMs, 180000)
  assert.throws(() => transportRecorder({ environment: 'fictional-secret' }), { message: 'Invalid transport evidence environment' })
})

test('container state exposes only fixed statuses, booleans and bounded counts', () => {
  assert.deepEqual(containerState({ status: 'exited', running: false, oomKilled: true, exitCode: 137, restartCount: 2,
    Error: 'fictional-secret', Config: { Env: ['fictional-secret'] }, labels: { private: 'fictional-secret' } }),
  { status: 'exited', running: false, oomKilled: true, exitCode: 137, restartCount: 2 })
  assert.deepEqual(containerState({ status: 'fictional-secret', running: 'fictional-secret', oomKilled: 'fictional-secret', exitCode: 999, restartCount: -5 }),
    { status: 'unknown', running: false, oomKilled: false, exitCode: -1, restartCount: -1 })
  assert.equal(version('v24.21.0'), '24.21.0')
  assert.equal(version('156.0.8078.4'), '156.0.8078.4')
  assert.equal(version('24.21.0 fictional-secret'), 'unknown')
})

test('CDP adapter attaches only required events and never serializes session messages', async () => {
  const listeners = new Map(), calls = [], lines = []
  const session = { on: (event, callback) => listeners.set(event, callback), send: async method => calls.push(method) }
  const recorder = await observeTransport({ newCDPSession: async () => session }, {},
    { environment: 'production-demo', origin, phase: () => 'library', write: line => lines.push(line) })
  assert.deepEqual(calls, ['Network.enable'])
  listeners.get('Network.requestWillBeSent')(request('1', '/api/books', 'GET'))
  listeners.get('Network.responseReceived')({ requestId: '1', response: { status: 200, protocol: 'h2', headers: { Secret: 'fictional-secret' } } })
  listeners.get('Network.loadingFinished')({ requestId: '1' })
  recorder.flush()
  assert.equal(output(lines[0]).environment, 'production-demo')
  assert.ok(!lines[0].includes('fictional-secret'))
})
