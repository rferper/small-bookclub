import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projectEvidence } from './collect.mjs'

const { default: Ajv } = createRequire(new URL('../../frontend/package.json', import.meta.url))('ajv')
const schema = JSON.parse(readFileSync(new URL('./diagnosis.schema.json', import.meta.url), 'utf8'))
const validate = new Ajv({ allErrors: false }).compile(schema)
export function validateDiagnosis(value, packet) {
  if (!validate(value)) throw new Error('Invalid diagnosis')
  const observed = packet.alertRule.state === 'firing' || packet.notifications.some(event => event.status === 'firing')
  const unhealthy = packet.services.some(item => item.status !== 'unknown' && item.status !== 'running'
    || item.health === 'unhealthy' || item.oomKilled || item.restarts > 0)
  const healthy = packet.services.every(item => item.status === 'running' && item.health === 'healthy' && !item.oomKilled && item.restarts === 0)
  if (value.assessment === 'api-errors-observed' && !observed
    || value.assessment === 'service-unhealthy' && !unhealthy
    || value.assessment === 'no-active-alert' && !(healthy && packet.alertRule.state === 'inactive' && packet.alertRule.health === 'ok')
    || value.evidenceRefs.includes('notifications') && packet.notifications.length === 0
    || value.evidenceRefs.includes('alert-rule') && packet.alertRule.state === 'unknown') throw new Error('Unsupported diagnosis')
  return value
}

export function agentEnvironment(input) {
  return Object.fromEntries(Object.entries(input).filter(([key]) =>
    /^(path|systemroot|windir|comspec|pathext|userprofile|home|temp|tmp|localappdata|appdata|codex_home)$/iu.test(key)))
}
export function agentArguments(workspace) {
  const args = ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--json', '--color', 'never', '--output-schema', join(workspace, 'schema.json'),
    '--output-last-message', join(workspace, 'diagnosis.json')]
  for (const setting of ['approval_policy="never"', 'web_search="disabled"', 'project_doc_max_bytes=0', 'analytics.enabled=false',
    'features.shell_tool=false', 'features.unified_exec=false', 'features.apps=false', 'features.plugins=false',
    'features.multi_agent=false', 'features.skill_search=false', 'features.skill_mcp_dependency_install=false',
    'features.skip_host_skill_discovery=true', 'features.in_app_browser=false']) args.push('-c', setting)
  return [...args, '-']
}
export function auditEvents(text) {
  const lines = text.trim().split('\n')
  if (lines.length > 128) throw new Error('Agent event limit')
  const types = new Set()
  for (const line of lines) {
    const event = JSON.parse(line)
    if (!['thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.completed'].includes(event.type)
      || event.type.startsWith('item.') && !['reasoning', 'agent_message'].includes(event.item?.type)) throw new Error('Agent tool activity denied')
    types.add(event.type)
  }
  if (!types.has('turn.completed') || !types.has('item.completed')) throw new Error('Incomplete agent run')
  return [...types].sort()
}

export function runDiagnosis(input, { run = spawnSync, allowLocal = false } = {}) {
  if (Buffer.byteLength(JSON.stringify(input)) > 65536) throw new Error('Evidence limit')
  const packet = projectEvidence(input)
  if (packet.source !== 'fictional-fixture' && !allowLocal) throw new Error('Local evidence needs explicit opt-in')
  const environment = agentEnvironment(process.env)
  const version = run('codex', ['--version'], { encoding: 'utf8', env: environment, timeout: 5000,
    maxBuffer: 4096, windowsHide: true, shell: false })
  if (version.error || version.status !== 0 || version.stdout?.trim() !== 'codex-cli 0.163.0') throw new Error('Tested Codex CLI 0.163.0 required')
  const workspace = mkdtempSync(join(tmpdir(), 'bookclub-oncall-'))
  try {
    writeFileSync(join(workspace, 'schema.json'), JSON.stringify(schema))
    const task = readFileSync(new URL('./task.md', import.meta.url), 'utf8')
    const result = run('codex', agentArguments(workspace), { cwd: workspace, env: environment, encoding: 'utf8',
      input: `${task}\n<operational-evidence>\n${JSON.stringify(packet)}\n</operational-evidence>`,
      timeout: 120000, maxBuffer: 131072, windowsHide: true, shell: false })
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string' || result.stdout.length > 131072) throw new Error('Agent run failed')
    const events = auditEvents(result.stdout)
    const output = join(workspace, 'diagnosis.json')
    if (statSync(output).size > 16384) throw new Error('Diagnosis limit')
    const diagnosis = validateDiagnosis(JSON.parse(readFileSync(output, 'utf8')), packet)
    return { diagnosis, provenance: { runner: 'codex-exec', cliVersion: '0.163.0', mode: 'read-only-no-tools',
      source: packet.source, inputSha256: createHash('sha256').update(JSON.stringify(packet)).digest('hex'),
      toolEvents: 0, events } }
  } catch { throw new Error('Read-only diagnosis failed') }
  finally {
    // Verify the exact generated temporary target before recursive Windows cleanup.
    try {
      if (resolve(workspace).startsWith(resolve(tmpdir()) + sep + 'bookclub-oncall-')) rmSync(workspace, { recursive: true, force: true })
    } catch { throw new Error('Read-only diagnosis cleanup failed') }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (![3, 4].includes(process.argv.length) || process.argv.length === 4 && process.argv[3] !== '--allow-local-evidence') throw new Error('Invalid runner arguments')
    if (statSync(process.argv[2]).size > 65536) throw new Error('Evidence limit')
    console.log(JSON.stringify(runDiagnosis(JSON.parse(readFileSync(process.argv[2], 'utf8')),
      { allowLocal: process.argv[3] === '--allow-local-evidence' }), null, 2))
  } catch { console.error('Read-only diagnosis failed; raw agent, credential and evidence details suppressed'); process.exitCode = 1 }
}
