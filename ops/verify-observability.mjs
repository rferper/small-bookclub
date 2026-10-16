// Local fictional requests only; own an exact random project and always remove it.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const project = `bookclub-observability-${randomBytes(6).toString('hex')}`
const evidence = mkdtempSync(join(tmpdir(), 'bookclub-observability-check-'))
const revision = '3'.repeat(40), marker = 'fictional-telemetry-private-marker-79'
const reservations = []
async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  reservations.push(server)
  return server.address().port
}
const appPort = await port(), grafanaPort = await port()
await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))))
const env = { ...process.env, BOOKCLUB_PORT: String(appPort), BOOKCLUB_GRAFANA_PORT: String(grafanaPort),
  BOOKCLUB_REVISION: revision, DEMO_MODE: 'false', SECRET_KEY: randomBytes(48).toString('hex'),
  DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '' }
const compose = ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'ops/compose.observability.yml']
let phase = 'configuration', browser, failed = false, httpStatus = null
function docker(args, capture = false) {
  const result = spawnSync('docker', args, { cwd: root, env, timeout: 300000,
    encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
  if (result.error || result.status !== 0) throw new Error('Docker verification command failed')
  return result.stdout?.trim()
}
const command = (args, capture) => docker([...compose, ...args], capture)
const app = `http://127.0.0.1:${appPort}`, grafana = `http://127.0.0.1:${grafanaPort}`
const proxy = (uid, path) => `${grafana}/api/datasources/proxy/uid/${uid}${path}`
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) })
  httpStatus = response.status
  assert.equal(response.status, 200)
  const body = await response.text()
  assert.ok(body.length <= 2000000)
  return JSON.parse(body)
}
async function ready(action) {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try { const value = await action(); if (value) return value } catch { /* Bounded asynchronous readiness reads only. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('Observability readiness deadline')
}
const start = name => { phase = name; httpStatus = null; console.log(`Observability verification: ${name}`) }
try {
  console.log(`Disposable observability project: ${project}`)
  console.log(`Observability screenshots: ${evidence}`)
  const config = JSON.parse(command(['config', '--format', 'json'], true))
  for (const name of ['otel-collector', 'prometheus', 'loki', 'tempo']) {
    assert.equal(config.services[name].ports, undefined)
    assert.deepEqual(config.services[name].networks, { observability: null })
  }
  assert.equal(config.networks.observability.internal, true)
  assert.deepEqual(config.services.grafana.networks, { observability: null, dashboard: null })
  assert.equal(config.networks.dashboard.driver, 'bridge')
  assert.notEqual(config.networks.dashboard.internal, true)
  assert.deepEqual(config.services.backend.networks, { default: null, observability: null })
  assert.deepEqual(config.services.frontend.networks, { default: null })
  assert.equal(config.services.backend.environment.TELEMETRY_ENABLED, 'true')
  for (const name of ['frontend', 'grafana']) {
    assert.equal(config.services[name].ports.length, 1)
    assert.equal(config.services[name].ports[0].host_ip, '127.0.0.1')
  }
  assert.equal(config.services.grafana.environment.GF_AUTH_ANONYMOUS_ORG_ROLE, 'Viewer')
  assert.equal(config.services.grafana.environment.GF_SECURITY_DISABLE_INITIAL_ADMIN_CREATION, 'true')
  for (const service of Object.values(config.services)) {
    assert.ok(!service.privileged && !service.pid)
    assert.ok(!service.volumes?.some(v => v.source?.includes('docker.sock')))
  }
  start('collector-configuration')
  command(['run', '--rm', '--no-deps', 'otel-collector', 'validate', '--config=/etc/otelcol/config.yaml'])
  start('startup')
  command(['up', '--build', '-d', '--wait', '--wait-timeout', '180'])
  const published = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}',
    command(['ps', '-q', 'grafana'], true)], true))
  assert.deepEqual(published['3000/tcp'], [{ HostIp: '127.0.0.1', HostPort: String(grafanaPort) }])
  await ready(async () => (await json(`${grafana}/api/health`)).database === 'ok')
  start('fictional-requests')
  for (let count = 0; count < 6; count++) {
    assert.deepEqual(await json(`${app}/api/health?private=${marker}`, {
      headers: { Authorization: `Bearer ${marker}`, Cookie: `sessionid=${marker}`, baggage: `private=${marker}`,
        traceparent: `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01` },
    }), { status: 'ok', environment: 'development', version: `release-${revision}` })
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  const denied = await fetch(`${app}/api/me/profile?private=${marker}`, { redirect: 'error', signal: AbortSignal.timeout(10000) })
  assert.equal(denied.status, 401)
  start('metrics')
  const metrics = await ready(async () => {
    const result = await json(proxy('prometheus', `/api/v1/query?query=${encodeURIComponent('bookclub_http_requests_total')}`))
    return result.status === 'success' && result.data?.result?.some(row => Number(row.value?.[1]) >= 6) && result
  })
  assert.ok(JSON.stringify(metrics).includes(`release-${revision}`))
  const durations = await json(proxy('prometheus', `/api/v1/query?query=${encodeURIComponent('http_server_request_duration_seconds_count')}`))
  assert.ok(durations.data.result.some(row => Number(row.value[1]) >= 6))
  start('logs')
  const logs = await ready(async () => {
    const result = await json(proxy('loki', `/loki/api/v1/query_range?query=${encodeURIComponent('{service_name="small-bookclub-backend"}')}&limit=100`))
    return result.data?.result?.some(row => row.values?.some(value => value[1] === 'http.request')) && result
  })
  assert.ok(!JSON.stringify(logs).includes(marker))
  start('traces')
  const traces = await ready(async () => {
    const result = await json(proxy('tempo', `/api/search?q=${encodeURIComponent('{ resource.service.name = "small-bookclub-backend" }')}&limit=20`))
    return result.traces?.length > 0 && result
  })
  const traceId = traces.traces[0].traceID
  assert.match(traceId, /^[a-f0-9]{16,32}$/u)
  const trace = await json(proxy('tempo', `/api/traces/${traceId}`))
  assert.ok(JSON.stringify(trace).includes(`release-${revision}`))
  assert.ok(!JSON.stringify(trace).includes(marker))
  assert.ok(!JSON.stringify(metrics).includes(marker))
  start('collector-outage')
  command(['stop', 'otel-collector'])
  assert.deepEqual(await json(`${app}/api/health`),
    { status: 'ok', environment: 'development', version: `release-${revision}` })
  command(['start', 'otel-collector'])
  await ready(async () => {
    const result = await json(proxy('prometheus', `/api/v1/query?query=${encodeURIComponent('bookclub_http_requests_total')}`))
    return result.data?.result?.some(row => Number(row.value?.[1]) >= 6)
  })
  start('dashboard-identity')
  const dashboard = await json(`${grafana}/api/dashboards/uid/bookclub-operations`)
  assert.equal(dashboard.dashboard.uid, 'bookclub-operations')
  assert.equal(dashboard.dashboard.panels.length, 6)
  start('dashboard-permissions')
  assert.equal(dashboard.meta.canSave, false)
  start('dashboard-write-denial')
  const write = await fetch(`${grafana}/api/dashboards/db`, { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', Origin: grafana },
    body: JSON.stringify({ dashboard: { uid: 'fictional-denied-write', title: 'Fictional denied write' } }) })
  httpStatus = write.status
  assert.ok([401, 403].includes(write.status))
  start('default-admin-denial')
  const login = await fetch(`${grafana}/login`, { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', Origin: grafana },
    body: JSON.stringify({ user: 'admin', password: 'admin' }) })
  httpStatus = login.status
  // Pinned Grafana omits the form client when the login form is disabled.
  assert.equal(login.status, 400)
  assert.equal((await login.json()).messageId, 'auth.client.notConfigured')
  assert.equal(login.headers.get('set-cookie'), null)
  start('screenshot')
  const { chromium } = createRequire(new URL('../frontend/package.json', import.meta.url))('@playwright/test')
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'es-ES' })
  await page.goto(`${grafana}/d/bookclub-operations`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Solicitudes por segundo', { exact: true }).first().waitFor({ timeout: 30000 })
  await page.getByText('Registros operativos sin contenido', { exact: true }).first().waitFor({ timeout: 30000 })
  await page.screenshot({ path: join(evidence, 'dashboard.png'), fullPage: true, timeout: 10000 })
  console.log('PASS: real local metrics, logs, traces, version identity, privacy and Viewer dashboard.')
} catch {
  failed = true
  const status = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : 'none'
  console.error(`Observability verification failed in ${phase}; HTTP status ${status}; raw data suppressed`)
} finally {
  try { await browser?.close() } catch { failed = true }
  start('cleanup')
  try {
    command(['down', '--volumes', '--remove-orphans'])
    for (const args of [
      ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`],
      ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`],
      ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`],
    ]) assert.equal(docker(args, true), '')
  } catch { failed = true; console.error('Observability exact-project cleanup failed') }
}
process.exitCode = failed ? 1 : 0
