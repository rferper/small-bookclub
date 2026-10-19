import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projectEvidence } from './collect.mjs'
import { loadCatalog, prepareCatalog, reviewedModel } from './model-catalog.mjs'

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
  const args = ['exec', '--model', reviewedModel, '--strict-config', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--json', '--color', 'never', '--output-schema', join(workspace, 'schema.json'),
    '--output-last-message', join(workspace, 'diagnosis.json')]
  for (const setting of ['approval_policy="never"', 'web_search="disabled"', 'project_doc_max_bytes=0', 'analytics.enabled=false',
    'suppress_unstable_features_warning=true',
    'tools.update_plan.enabled=false', 'tools.experimental_request_user_input.enabled=false',
    `model_catalog_json=${JSON.stringify(join(workspace, 'model-catalog.json'))}`,
    'cloud.skills.enabled=false', 'orchestrator.mcp.enabled=false',
    'features.memories=false', 'features.agent_message_board=false', 'features.multi_agent_v2=false',
    'features.deferred_executor=false', 'features.request_permissions_tool=false',
    'features.token_budget={enabled=false,use_history_notes_extension=false}',
    'features.current_time_reminder=false', 'features.send_message_to_user_async=false',
    'features.code_mode=false', 'features.code_mode_only=false', 'features.code_mode_tool_search=false',
    'features.guardian_conversation_history_tools=false',
    'features.shell_tool=false', 'features.apps=false', 'features.plugins=false',
    'features.multi_agent=false', 'features.skill_search=false', 'features.skill_mcp_dependency_install=false',
    'features.skip_host_skill_discovery=true', 'features.in_app_browser=false', 'features.hooks=false',
    'features.browser_use=false', 'features.browser_use_external=false', 'features.browser_use_full_cdp_access=false',
    'features.browser_annotation_api=false', 'features.computer_use=false', 'features.view_image=false',
    'features.image_generation=false', 'features.code_mode_host=false', 'features.in_app_local_automation=false',
    'features.remote_plugin=false', 'features.plugin_sharing=false', 'features.tool_suggest=false',
    'features.auth_elicitation=false', 'features.tool_call_mcp_elicitation=false', 'features.workspace_dependencies=false',
    'features.daemon_auto_start=false', 'features.goals=false', 'features.sleep_tool=false',
    'features.shell_snapshot=false', 'features.unbounded_connection_retries=false']) args.push('-c', setting)
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

export function runDiagnosis(input, { run = spawnSync, allowLocal = false, readCatalog = readFileSync } = {}) {
  // Before even version/auth subprocesses: malformed/missing metadata never falls back.
  loadCatalog(readCatalog)
  if (Buffer.byteLength(JSON.stringify(input)) > 65536) throw new Error('Evidence limit')
  const packet = projectEvidence(input)
  if (packet.source !== 'fictional-fixture' && !allowLocal) throw new Error('Local evidence needs explicit opt-in')
  const environment = agentEnvironment(process.env)
  const version = run('codex', ['--version'], { encoding: 'utf8', env: environment, timeout: 5000,
    maxBuffer: 4096, windowsHide: true, shell: false })
  if (version.error || version.status !== 0 || version.stdout?.trim() !== 'codex-cli 0.163.0') throw new Error('Tested Codex CLI 0.163.0 required')
  const auth = run('codex', ['login', 'status'], { encoding: 'utf8', env: environment, timeout: 5000,
    maxBuffer: 4096, windowsHide: true, shell: false })
  if (auth.error || auth.status !== 0 || `${auth.stdout ?? ''}${auth.stderr ?? ''}`.trim() !== 'Logged in using ChatGPT') throw new Error('Existing ChatGPT CLI login required')
  const workspace = mkdtempSync(join(tmpdir(), 'bookclub-oncall-'))
  let phase = 'agent-startup'
  try {
    writeFileSync(join(workspace, 'schema.json'), JSON.stringify(schema))
    prepareCatalog(workspace)
    const task = readFileSync(new URL('./task.md', import.meta.url), 'utf8')
    const result = run('codex', agentArguments(workspace), { cwd: workspace, env: environment, encoding: 'utf8',
      input: `${task}\n<operational-evidence>\n${JSON.stringify(packet)}\n</operational-evidence>`,
      timeout: 120000, maxBuffer: 131072, windowsHide: true, shell: false })
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string' || result.stdout.length > 131072) throw new Error('Agent run failed')
    phase = 'event-audit'
    const events = auditEvents(result.stdout)
    phase = 'output-file'
    const output = join(workspace, 'diagnosis.json')
    if (statSync(output).size > 16384) throw new Error('Diagnosis limit')
    const parsed = JSON.parse(readFileSync(output, 'utf8'))
    phase = 'schema-and-facts'
    const diagnosis = validateDiagnosis(parsed, packet)
    return { diagnosis, provenance: { runner: 'codex-exec', cliVersion: '0.163.0', mode: 'read-only-no-tools',
      source: packet.source, inputSha256: createHash('sha256').update(JSON.stringify(packet)).digest('hex'),
      toolEvents: 0, events } }
  } catch {
    const error = new Error('Read-only diagnosis failed')
    error.phase = phase
    throw error
  }
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
  } catch (error) {
    const phase = ['agent-startup', 'event-audit', 'output-file', 'schema-and-facts'].includes(error.phase) ? error.phase : 'preflight'
    console.error(`Read-only diagnosis failed at ${phase}; raw agent, credential and evidence details suppressed`)
    process.exitCode = 1
  }
}
