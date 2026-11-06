import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actions, auditPath, commandFor, cooldownMs, executeAction, lastActionAt, planAction, respond, validProject } from './remediate.mjs'

const project = 'bookclub-monitor-abc123'
const file = '/private/audit.jsonl'
const service = (name, status = 'running') => ({ service: name, status, health: 'healthy', oomKilled: false, restarts: 0 })
const packet = (state = 'firing', source = 'local-compose', backend = service('backend')) =>
  ({ source, alertRule: { state, health: 'ok' }, services: [backend, service('frontend')], notifications: [] })
const diagnosis = assessment => ({ assessment })

test('only none and restart-backend exist', () => assert.deepEqual([...actions], ['none', 'restart-backend']))

test('plan restarts only for a firing local alert with an agreeing diagnosis', () => {
  assert.equal(planAction(diagnosis('api-errors-observed'), packet()), 'restart-backend')
  assert.equal(planAction(diagnosis('service-unhealthy'), packet()), 'restart-backend')
  for (const assessment of ['no-active-alert', 'insufficient-evidence', 'rm -rf', undefined]) {
    assert.equal(planAction(diagnosis(assessment), packet()), 'none')
  }
  assert.equal(planAction(diagnosis('api-errors-observed'), packet('inactive')), 'none')
  assert.equal(planAction(diagnosis('api-errors-observed'), packet('pending')), 'none')
  assert.equal(planAction(diagnosis('api-errors-observed'), packet('firing', 'fictional-fixture')), 'none')
  assert.equal(planAction(diagnosis('api-errors-observed'), packet('firing', 'local-compose', service('backend', 'unknown'))), 'none')
  assert.equal(planAction(diagnosis('api-errors-observed'), { ...packet(), services: [service('frontend')] }), 'none')
})

test('project names and the command are fixed and validated', () => {
  for (const bad of ['', 'prod', 'bookclub-monitor-', 'bookclub-monitor-a;rm', 'bookclub-monitor-A', `bookclub-monitor-${'a'.repeat(80)}`, undefined, null, 5]) {
    assert.equal(validProject(bad), false)
    assert.throws(() => commandFor('restart-backend', bad))
  }
  assert.deepEqual(commandFor('restart-backend', project),
    ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'ops/compose.observability.yml', 'restart', 'backend'])
  for (const action of ['none', 'restart-frontend', 'down', 'restart-backend; id', undefined]) assert.throws(() => commandFor(action, project))
})

test('execution runs docker without a shell and reports failure', () => {
  const calls = []
  const ok = executeAction('restart-backend', project, { run: (cmd, args, options) => { calls.push({ cmd, args, options }); return { status: 0 } } })
  assert.equal(ok, true)
  assert.equal(calls[0].cmd, 'docker')
  assert.equal(calls[0].options.shell, false)
  assert.equal(executeAction('restart-backend', project, { run: () => ({ status: 1 }) }), false)
  assert.equal(executeAction('restart-backend', project, { run: () => ({ error: new Error('x') }) }), false)
})

test('audit file must be absolute and outside the repository', () => {
  assert.throws(() => auditPath('relative.jsonl'))
  assert.throws(() => auditPath(undefined))
  assert.throws(() => auditPath('/repo/ops/audit.jsonl', '/repo'))
  assert.throws(() => auditPath('/repo', '/repo'))
  assert.equal(auditPath('/private/audit.jsonl', '/repo').endsWith('audit.jsonl'), true)
})

test('cooldown reads only executed actions of the same project', () => {
  const at = new Date(1000000).toISOString()
  const text = [JSON.stringify({ project, action: 'restart-backend', executed: true, at }), 'not json',
    JSON.stringify({ project: 'bookclub-monitor-other', action: 'restart-backend', executed: true, at: new Date(9e6).toISOString() }),
    JSON.stringify({ project, action: 'none', executed: false, at: new Date(9e6).toISOString() })].join('\n')
  assert.equal(lastActionAt(file, project, { exists: () => true, read: () => text }), 1000000)
  assert.equal(lastActionAt(file, project, { exists: () => false }), 0)
})

function harness({ packets, diagnose, execute = () => true, last = () => 0 } = {}) {
  const written = []
  let index = 0, time = 10 * cooldownMs, executions = 0
  return {
    written, get executions() { return executions },
    deps: {
      collect: () => packets[Math.min(index++, packets.length - 1)],
      diagnose: diagnose ?? (() => ({ diagnosis: diagnosis('api-errors-observed') })),
      execute: (...args) => { executions += 1; return execute(...args) },
      now: () => time, sleep: async ms => { time += ms }, write: (_file, text) => written.push(JSON.parse(text)), last,
    },
  }
}

test('firing alert: restart, then alert resolves', async () => {
  const h = harness({ packets: [packet('firing'), packet('firing'), packet('inactive')] })
  const result = await respond(project, file, h.deps)
  assert.deepEqual(result, { action: 'restart-backend', executed: true, resolved: true, reason: 'alert-resolved' })
  assert.equal(h.executions, 1)
  assert.deepEqual(h.written.map(entry => entry.reason), ['executed', 'alert-resolved'])
})

test('alert that never resolves is reported without a second restart', async () => {
  const h = harness({ packets: [packet('firing')] })
  const result = await respond(project, file, h.deps)
  assert.equal(result.reason, 'alert-still-firing')
  assert.equal(h.executions, 1)
})

test('no firing alert never diagnoses or acts', async () => {
  const h = harness({ packets: [packet('inactive')], diagnose: () => { throw new Error('must not run') } })
  assert.deepEqual(await respond(project, file, h.deps), { action: 'none', reason: 'no-firing-alert' })
  assert.equal(h.executions, 0)
})

test('failed diagnosis or non-agreeing diagnosis never acts', async () => {
  let h = harness({ packets: [packet()], diagnose: () => { throw new Error('model down') } })
  assert.equal((await respond(project, file, h.deps)).reason, 'diagnosis-failed')
  assert.equal(h.executions, 0)
  h = harness({ packets: [packet()], diagnose: () => ({ diagnosis: diagnosis('insufficient-evidence') }) })
  assert.equal((await respond(project, file, h.deps)).reason, 'no-action-planned')
  assert.equal(h.executions, 0)
})

test('rate limit blocks a second restart inside the cooldown', async () => {
  const h = harness({ packets: [packet()], last: () => 10 * cooldownMs - 1000 })
  assert.equal((await respond(project, file, h.deps)).reason, 'rate-limited')
  assert.equal(h.executions, 0)
  const later = harness({ packets: [packet(), packet('inactive')], last: () => 10 * cooldownMs - cooldownMs - 1 })
  assert.equal((await respond(project, file, later.deps)).executed, true)
})

test('execution failure is audited and not retried', async () => {
  const h = harness({ packets: [packet()], execute: () => false })
  const result = await respond(project, file, h.deps)
  assert.equal(result.reason, 'execution-failed')
  assert.equal(h.executions, 1)
})

test('invalid project is rejected before any collection', async () => {
  await assert.rejects(respond('prod', file, { collect: () => { throw new Error('must not run') } }))
})
