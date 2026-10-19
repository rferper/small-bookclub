import assert from 'node:assert/strict'
import test from 'node:test'
import { projectAlert, receiver, summary } from './receiver.mjs'

const marker = 'fictional-private-token'
function alert(status = 'firing') {
  return { status, labels: { alertname: 'BookclubApiErrors', severity: 'critical',
    service: 'small-bookclub-backend', deployment_environment_name: 'test', service_version: `release-${'4'.repeat(40)}` },
    annotations: { error_ratio: '0.5', summary: marker, runbook: `https://${marker}.invalid` },
    generatorURL: `https://${marker}.invalid`, fingerprint: marker }
}
test('only closed operational fields survive incoming labels/annotations', () => {
  const input = alert()
  input.labels.private = marker
  const event = projectAlert(input, new Date('2026-10-19T00:00:00Z'))
  assert.equal(event.summary, summary)
  assert.equal(event.errorRatio, 0.5)
  assert.equal(event.runbook, 'ops/alerts/README.md')
  assert.equal(event.receivedAt, '2026-10-19T00:00:00.000Z')
  assert.ok(!JSON.stringify(event).includes(marker))
  assert.equal(projectAlert(alert('resolved')).status, 'resolved')
})
test('foreign alerts, arbitrary identity, malformed ratios and state are rejected', () => {
  for (const [section, key, value] of [
    ['labels', 'alertname', marker], ['labels', 'severity', marker], ['labels', 'service', marker],
    ['labels', 'deployment_environment_name', marker], ['labels', 'service_version', marker],
    ['annotations', 'error_ratio', marker], ['annotations', 'error_ratio', '1.1'],
    ['annotations', 'error_ratio', '-0.5'], ['annotations', 'error_ratio', 0.5],
  ]) {
    const input = alert(); input[section][key] = value
    assert.equal(projectAlert(input), null)
  }
  assert.equal(projectAlert(alert(marker)), null)
  assert.equal(projectAlert(null), null)
})
test('actual HTTP delivery keeps bounded private history and logs', async t => {
  const lines = [], server = receiver({ write: line => lines.push(line) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  async function send(value, path = '/alerts') {
    return fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: marker }, body: JSON.stringify(value) })
  }
  for (let index = 0; index < 70; index++) assert.equal((await send({ alerts: [alert(index % 2 ? 'resolved' : 'firing')] })).status, 204)
  const response = await fetch(`${origin}/events`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const events = await response.json()
  assert.equal(events.length, 64)
  assert.equal(events.at(-1).status, 'resolved')
  assert.equal(lines.length, 70)
  assert.ok(!lines.join('').includes(marker))
  assert.ok(!JSON.stringify(events).includes(marker))
  for (const payload of [{ alerts: [] }, { alerts: Array(9).fill(alert()) }, { alerts: [alert(marker)] }, null]) {
    const rejected = await send(payload)
    assert.equal(rejected.status, 400)
    assert.equal(await rejected.text(), '{}')
  }
  assert.equal((await send({ alerts: [alert()], private: marker.repeat(5000) })).status, 413)
  const malformed = await fetch(`${origin}/alerts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: marker })
  assert.equal(malformed.status, 400)
  assert.equal((await send({ alerts: [alert()] }, `/alerts?token=${marker}`)).status, 404)
  assert.equal((await fetch(`${origin}/events`, { method: 'DELETE' })).status, 404)
  assert.equal((await (await fetch(`${origin}/events`)).json()).length, 64)
})
