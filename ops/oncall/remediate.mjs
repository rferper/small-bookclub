// Bounded remediation for the private local monitoring stack only.
// The model never emits a command: its validated diagnosis is a required gate, and fixed
// code maps it to one allowlisted action (restart the backend of the named Compose project).
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectEvidence } from './collect.mjs'
import { runDiagnosis } from './diagnose.mjs'

export const actions = Object.freeze(['none', 'restart-backend'])
export const cooldownMs = 15 * 60 * 1000
const projectPattern = /^bookclub-(monitor|observability)-[a-z0-9]+(?:-[a-z0-9]+)*$/u
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))

export function validProject(project) {
  return typeof project === 'string' && project.length <= 80 && projectPattern.test(project)
}

// Pure decision. Local evidence only; the alert must be firing and the model must agree.
export function planAction(diagnosis, packet) {
  if (packet?.source !== 'local-compose' || packet.alertRule?.state !== 'firing') return 'none'
  if (!['api-errors-observed', 'service-unhealthy'].includes(diagnosis?.assessment)) return 'none'
  const backend = packet.services?.find(item => item.service === 'backend')
  if (!backend || backend.status === 'unknown') return 'none'
  return 'restart-backend'
}

export function commandFor(action, project) {
  if (action !== 'restart-backend' || !validProject(project)) throw new Error('Action not allowed')
  return ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'ops/compose.observability.yml', 'restart', 'backend']
}

export function executeAction(action, project, { run = spawnSync } = {}) {
  const args = commandFor(action, project)
  const result = run('docker', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000, maxBuffer: 65536, windowsHide: true, shell: false })
  return !result.error && result.status === 0
}

// The audit log and cooldown state must live outside the repository so they are never committed.
export function auditPath(value, root = repositoryRoot) {
  if (typeof value !== 'string' || !isAbsolute(value)) throw new Error('BOOKCLUB_ONCALL_AUDIT must be an absolute path')
  const location = resolve(value)
  const inside = relative(resolve(root), location)
  if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) throw new Error('Audit file must be outside the repository')
  return location
}

export function lastActionAt(file, project, { read = readFileSync, exists = existsSync } = {}) {
  if (!exists(file)) return 0
  let latest = 0
  for (const line of read(file, 'utf8').split('\n')) {
    try {
      const entry = JSON.parse(line)
      if (entry.project === project && entry.action !== 'none' && entry.executed === true) latest = Math.max(latest, Date.parse(entry.at) || 0)
    } catch { /* Ignore malformed lines; they never enable an action. */ }
  }
  return latest
}

const audit = (file, entry, write) => write(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)

// One alert response: collect -> diagnose -> plan -> rate limit -> execute -> verify.
export async function respond(project, file, {
  collect = collectEvidence, diagnose = runDiagnosis, execute = executeAction, now = Date.now,
  sleep = ms => new Promise(done => setTimeout(done, ms)), write = appendFileSync, last = lastActionAt,
  verifyMs = 90000, pollMs = 10000,
} = {}) {
  if (!validProject(project)) throw new Error('Invalid monitoring project')
  const packet = collect(project)
  if (packet.alertRule.state !== 'firing') return { action: 'none', reason: 'no-firing-alert' }
  let diagnosis
  try { diagnosis = diagnose(packet, { allowLocal: true }).diagnosis }
  catch {
    audit(file, { project, action: 'none', executed: false, reason: 'diagnosis-failed' }, write)
    return { action: 'none', reason: 'diagnosis-failed' }
  }
  const action = planAction(diagnosis, packet)
  if (action === 'none') {
    audit(file, { project, action, executed: false, reason: 'no-action-planned', assessment: diagnosis.assessment }, write)
    return { action, reason: 'no-action-planned' }
  }
  if (now() - last(file, project) < cooldownMs) {
    audit(file, { project, action, executed: false, reason: 'rate-limited' }, write)
    return { action: 'none', reason: 'rate-limited' }
  }
  const executed = execute(action, project)
  audit(file, { project, action, executed, reason: executed ? 'executed' : 'execution-failed', assessment: diagnosis.assessment }, write)
  if (!executed) return { action, executed, resolved: false, reason: 'execution-failed' }
  const deadline = now() + verifyMs
  let resolved = false
  while (!resolved && now() < deadline) {
    await sleep(pollMs)
    resolved = collect(project).alertRule.state !== 'firing'
  }
  audit(file, { project, action, executed, reason: resolved ? 'alert-resolved' : 'alert-still-firing' }, write)
  return { action, executed, resolved, reason: resolved ? 'alert-resolved' : 'alert-still-firing' }
}

export async function watch(project, file, { intervalMs = 30000, ...dependencies } = {}) {
  const sleep = dependencies.sleep ?? (ms => new Promise(done => setTimeout(done, ms)))
  for (;;) {
    try { await respond(project, file, dependencies) } catch { /* Raw errors are never printed; the next cycle retries. */ }
    await sleep(intervalMs)
  }
}

export function initAuditFile(file) {
  appendFileSync(file, '')
  return file
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Invalid arguments')
    const file = initAuditFile(auditPath(process.env.BOOKCLUB_ONCALL_AUDIT))
    console.log('On-call watcher started: restart-backend is the only allowed action; audit written outside git.')
    await watch(process.argv[2], file)
  } catch (error) {
    console.error(`On-call watcher failed to start: ${error.message === 'Invalid arguments' || /absolute|outside|Invalid monitoring/u.test(error.message) ? error.message : 'internal error'}`)
    process.exitCode = 1
  }
}
