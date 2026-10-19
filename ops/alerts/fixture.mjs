// Explicit synthetic metric input, never an application failure or endpoint.
// Only run through the alert-test profile of a disposable verification project.
import assert from 'node:assert/strict'

assert.match(process.env.ALERT_FIXTURE_PROJECT ?? '', /^bookclub-observability-[a-f0-9]{12}$/u,
  'Alert fixture requires the exact disposable verification project identity')
const startTimeUnixNano = String(BigInt(Date.now()) * 1000000n)
const attribute = (key, value) => ({ key, value: { stringValue: value } })
let healthy = 0, errors = 0
async function emit() {
  const timeUnixNano = String(BigInt(Date.now()) * 1000000n)
  const dataPoints = [[200, healthy], [500, errors]].map(([status, value]) => ({
    startTimeUnixNano, timeUnixNano, asInt: String(value), attributes: [
      attribute('http.route', '/api/books'), attribute('http.request.method', 'GET'),
      { key: 'http.response.status_code', value: { intValue: String(status) } },
    ],
  }))
  const response = await fetch('http://otel-collector:4318/v1/metrics', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceMetrics: [{ resource: { attributes: [
      attribute('service.name', 'small-bookclub-backend'),
      attribute('service.version', `release-${'4'.repeat(40)}`),
      attribute('deployment.environment.name', 'test'),
    ] }, scopeMetrics: [{ scope: { name: 'bookclub.alert.fixture' }, metrics: [{
      name: 'bookclub.http.requests', unit: '{request}',
      sum: { aggregationTemporality: 2, isMonotonic: true, dataPoints },
    }] }] }] }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(!result.partialSuccess?.rejectedDataPoints)
}
for (const [phase, ticks] of [['baseline', 4], ['failures', 16], ['recovery', 28]]) {
  console.log(`Fictional alert fixture: ${phase}`)
  for (let index = 0; index < ticks; index++) {
    healthy += phase === 'recovery' ? 5 : 1
    if (phase === 'failures') errors += 3
    await emit()
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}
console.log('Fictional alert fixture: completed')
