// Disposable end-to-end check for #127. Owns an exact random project and always removes it.
// The alert is the project's synthetic fixture (not a real application failure), so the
// restart is real but the alert is resolved by the fixture's recovery phase, not by the restart.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectEvidence } from './collect.mjs'
import { respond } from './remediate.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const project = `bookclub-observability-${randomBytes(6).toString('hex')}`
const directory = mkdtempSync(join(tmpdir(), 'bookclub-remediation-check-'))
const audit = join(directory, 'audit.jsonl')
async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port: value } = server.address()
  await new Promise(resolve => server.close(resolve))
  return value
}
const env = { ...process.env, BOOKCLUB_PORT: String(await port()), BOOKCLUB_GRAFANA_PORT: String(await port()),
  BOOKCLUB_REVISION: '3'.repeat(40), DEMO_MODE: 'false', SECRET_KEY: randomBytes(48).toString('hex'),
  DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '' }
const compose = ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'ops/compose.observability.yml']
function docker(args) {
  const result = spawnSync('docker', args, { cwd: root, env, timeout: 600000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  if (result.error || result.status !== 0) throw new Error('Docker command failed')
  return result.stdout.trim()
}
const startedAt = () => docker(['inspect', '--format', '{{.State.StartedAt}}', docker([...compose, 'ps', '-q', 'backend'])])
let phase = 'startup', failed = false, fixture
try {
  console.log(`Disposable project: ${project}; audit: ${audit}`)
  docker([...compose, 'up', '--build', '-d', '--wait', '--wait-timeout', '240'])
  const before = startedAt()
  phase = 'fixture'
  fixture = spawn('docker', [...compose, 'run', '--rm', '--no-deps', '-e', `ALERT_FIXTURE_PROJECT=${project}`, 'alert-fixture'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let fixtureOutput = ''
  for (const stream of [fixture.stdout, fixture.stderr]) stream.on('data', chunk => { fixtureOutput = (fixtureOutput + chunk).slice(-4000) })
  const fixtureDone = new Promise(resolve => fixture.once('exit', code => { console.log(`Fixture exited with ${code}`); resolve(code) }))
  phase = 'wait-for-firing'
  const deadline = Date.now() + 240000
  for (let packet = collectEvidence(project); packet.alertRule.state !== 'firing'; packet = collectEvidence(project)) {
    console.log(`Rule ${packet.alertRule.state}/${packet.alertRule.health}; receiver events ${packet.notifications.length}`)
    assert.ok(Date.now() < deadline, `Alert never fired. Fixture output tail: ${fixtureOutput}`)
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  phase = 'respond'
  const result = await respond(project, audit, { verifyMs: 300000, pollMs: 10000 })
  console.log(`Responder result: ${JSON.stringify(result)}`)
  assert.equal(result.action, 'restart-backend')
  assert.equal(result.executed, true)
  phase = 'assert-restart'
  assert.notEqual(startedAt(), before, 'Backend container was not restarted')
  const entries = readFileSync(audit, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.ok(entries.some(entry => entry.reason === 'executed'))
  console.log(`Audit reasons: ${entries.map(entry => entry.reason).join(', ')}`)
  await fixtureDone
  console.log('PASS: alert fired, real diagnosis passed the gate, backend was restarted; synthetic alert later resolved.')
} catch (error) {
  failed = true
  console.error(`Remediation verification failed in ${phase}: ${error.message}`)
} finally {
  try { fixture?.kill() } catch { /* Already exited. */ }
  try {
    docker([...compose, 'down', '--volumes', '--remove-orphans'])
    for (const args of [['ps', '-aq'], ['network', 'ls', '-q'], ['volume', 'ls', '-q']]) {
      assert.equal(docker([...args, '--filter',`label=com.docker.compose.project=${project}`]), '')
    }
  } catch { failed = true; console.error('Exact-project cleanup failed') }
}
console.log(failed ? 'FAIL: remediation verification.' : 'PASS: exact-project cleanup verified.')
process.exitCode = failed ? 1 : 0
