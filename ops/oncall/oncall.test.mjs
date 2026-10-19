import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { collectEvidence, projectEvidence, services, readSignals } from './collect.mjs'
import { agentArguments, agentEnvironment, auditEvents, runDiagnosis, validateDiagnosis } from './diagnose.mjs'

const marker = 'fictional-private-token'
const packet = () => JSON.parse(readFileSync(new URL('./fictional-evidence.json', import.meta.url), 'utf8'))
const diagnosis = () => ({ schemaVersion: 1, assessment: 'api-errors-observed', confidence: 'low',
  evidenceRefs: ['alert-rule', 'notifications'], hypotheses: ['unknown'], nextSteps: ['inspect-release', 'ask-owner'],
  humanApprovalRequired: true, actionsTaken: [], runbook: 'ops/runbooks/api-errors.md' })
const events = () => [
  { type: 'thread.started', thread_id: marker }, { type: 'turn.started' },
  { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(diagnosis()) } },
  { type: 'turn.completed' },
].map(value => JSON.stringify(value)).join('\n')

test('projection discards untrusted prose, labels, config and raw logs', () => {
  const input = packet()
  input.instructions = marker; input.services[0].Config = { Env: [marker] }
  input.notifications[0].summary = marker; input.alertRule.lastError = marker
  const safe = projectEvidence(input)
  assert.ok(!JSON.stringify(safe).includes(marker))
  assert.equal(safe.notifications[0].version, `release-${'4'.repeat(40)}`)
  input.notifications[0].environment = marker
  assert.deepEqual(projectEvidence(input).notifications, [])
  input.notifications = Array(65).fill({})
  assert.throws(() => projectEvidence(input), /Invalid operational packet/u)
  input.notifications = []; input.collectedAt = marker
  assert.throws(() => projectEvidence(input), /Invalid operational packet/u)
})
test('collector constructs only exact read-only commands and projects secret-bearing responses', () => {
  const calls = []
  const result = collectEvidence('bookclub-monitor-fictional', { run: (program, args, options) => {
    calls.push(args)
    assert.equal(program, 'docker'); assert.equal(options.shell, false)
    assert.ok(options.timeout > 0 && options.timeout <= 15000)
    assert.equal(options.maxBuffer, 65536)
    if (args[0] === 'compose') {
      assert.ok(services.includes(args.at(-1)))
      return { status: 0, stdout: 'a'.repeat(64) }
    }
    if (args[0] === 'inspect') {
      assert.ok(!args[2].includes('Config') && !args[2].includes('Error') && !args[2].includes('Log'))
      return { status: 0, stdout: JSON.stringify({ status: 'running', health: 'healthy', oomKilled: false, restarts: 0, private: marker }) }
    }
    assert.equal(args[0], 'exec'); assert.equal(args[1], 'a'.repeat(64)); assert.equal(args.at(-1), readSignals)
    assert.ok(readSignals.includes("method:'GET'")); assert.ok(!readSignals.includes('POST'))
    return { status: 0, stdout: JSON.stringify({ alertRule: { state: 'firing', health: 'ok', private: marker }, notifications: packet().notifications }) }
  } })
  assert.equal(calls.length, 19)
  assert.equal(result.alertRule.state, 'firing')
  assert.ok(!JSON.stringify(result).includes(marker))
  let called = false
  for (const value of ['main', '../bookclub-monitor-x', 'bookclub-monitor-x;whoami', 'bookclub-observability-x'.repeat(10)]) {
    assert.throws(() => collectEvidence(value, { run: () => { called = true } }), /Invalid monitoring project/u)
  }
  assert.equal(called, false)
})
test('missing, malformed, oversized and secret-bearing command failures remain unknown', () => {
  for (const response of [{ status: 1, stderr: marker }, { error: new Error(marker) },
    { status: 0, stdout: marker }, { status: 0, stdout: 'a'.repeat(65537) }]) {
    const result = collectEvidence('bookclub-monitor-fictional', { run: () => response })
    assert.ok(result.services.every(item => item.status === 'unknown'))
    assert.equal(result.alertRule.state, 'unknown')
    assert.deepEqual(result.notifications, [])
    assert.ok(!JSON.stringify(result).includes(marker))
  }
})
test('diagnosis schema and evidence gates reject actions, text and invented observations', () => {
  const safe = projectEvidence(packet())
  assert.deepEqual(validateDiagnosis(diagnosis(), safe), diagnosis())
  for (const change of [{ commands: [marker] }, { actionsTaken: [marker] }, { humanApprovalRequired: false },
    { confidence: 'high' }, { nextSteps: [marker] }, { assessment: 'service-unhealthy' }, { assessment: 'no-active-alert' }]) {
    assert.throws(() => validateDiagnosis({ ...diagnosis(), ...change }, safe))
  }
  safe.alertRule.state = 'unknown'; safe.notifications = []
  assert.throws(() => validateDiagnosis(diagnosis(), safe), /Unsupported diagnosis/u)
  const unknown = { ...diagnosis(), assessment: 'insufficient-evidence', evidenceRefs: ['service-health'] }
  assert.equal(validateDiagnosis(unknown, safe).assessment, 'insufficient-evidence')
})
test('agent environment excludes API/deploy/Docker/GitHub secrets and tool settings are explicit', () => {
  assert.deepEqual(agentEnvironment({ PATH: 'bin', USERPROFILE: 'fictional-home', OPENAI_API_KEY: marker,
    CODEX_API_KEY: marker, GITHUB_TOKEN: marker, SECRET_KEY: marker, DOCKER_HOST: marker, RENDER_DEPLOY_HOOK: marker }),
  { PATH: 'bin', USERPROFILE: 'fictional-home' })
  const args = agentArguments('fictional-temp')
  for (const flag of ['--ignore-user-config', '--ignore-rules', '--ephemeral', '--output-schema', '--json']) assert.ok(args.includes(flag))
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only')
  for (const setting of ['features.shell_tool=false', 'features.plugins=false', 'features.apps=false', 'features.multi_agent=false', 'web_search="disabled"', 'project_doc_max_bytes=0', 'features.hooks=false', 'features.browser_use=false', 'features.computer_use=false', 'features.view_image=false', 'features.image_generation=false', 'features.code_mode_host=false', 'features.daemon_auto_start=false']) assert.ok(args.includes(setting))
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'))
  assert.ok(!args.includes('features.unified_exec=false'), 'CLI ignores this override; shell_tool is the command-tool gate')
})
test('headless runner audits completion, validates output and cleans exact isolated directory', () => {
  let directory
  const result = runDiagnosis(packet(), { run: (_program, args, options) => {
    if (args[0] === '--version') return { status: 0, stdout: 'codex-cli 0.163.0' }
    if (args[0] === 'login') return { status: 0, stderr: 'Logged in using ChatGPT' }
    directory = options.cwd
    assert.equal(options.shell, false); assert.equal(options.timeout, 120000)
    assert.ok(!options.input.includes(marker)); assert.equal(options.env.OPENAI_API_KEY, undefined)
    assert.equal(dirname(args[args.indexOf('--output-schema') + 1]), directory)
    writeFileSync(join(directory, 'diagnosis.json'), JSON.stringify(diagnosis()))
    return { status: 0, stdout: events(), stderr: marker }
  } })
  assert.equal(result.provenance.toolEvents, 0)
  assert.equal(result.provenance.inputSha256.length, 64)
  assert.ok(!JSON.stringify(result).includes(marker))
  assert.equal(existsSync(directory), false)
  assert.throws(() => runDiagnosis({ ...packet(), source: 'local-compose' }), /explicit opt-in/u)
})
test('tool activity, subprocess faults, raw malformed output and unknown event types fail closed', () => {
  for (const fault of ['tool', 'timeout', 'invalid-json', 'status', 'oversized', 'unknown-event']) {
    let directory
    assert.throws(() => runDiagnosis(packet(), { run: (_program, args, options) => {
      if (args[0] === '--version') return { status: 0, stdout: 'codex-cli 0.163.0' }
    if (args[0] === 'login') return { status: 0, stderr: 'Logged in using ChatGPT' }
      directory = options.cwd
      writeFileSync(join(directory, 'diagnosis.json'), fault === 'invalid-json' ? marker : JSON.stringify(diagnosis()))
      return { status: fault === 'status' ? 1 : 0, error: fault === 'timeout' ? new Error(marker) : undefined,
        stdout: fault === 'tool' ? JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: marker } })
          : fault === 'unknown-event' ? JSON.stringify({ type: marker }) : fault === 'oversized' ? marker.repeat(20000) : events(), stderr: marker }
    } }), { message: 'Read-only diagnosis failed' })
    assert.equal(existsSync(directory), false)
  }
  assert.throws(() => auditEvents(''), /./u)
  assert.throws(() => auditEvents(Array(129).fill('{}').join('\n')), /event limit/u)
  assert.throws(() => auditEvents(JSON.stringify({ type: 'turn.started' })), /Incomplete/u)
})
test('actual shell entrypoint rejects injected project input before Docker', () => {
  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'sh'
  const result = spawnSync(shell, ['ops/collect-evidence.sh', `../${marker};whoami`], { encoding: 'utf8', timeout: 10000, windowsHide: true })
  assert.equal(result.status, 1)
  assert.ok(!`${result.stdout}${result.stderr}`.includes(marker))
})

test('API-key authentication or unreviewed CLI versions fail before model execution', () => {
  for (const value of ['api-key', 'new-cli']) {
    let called = false
    assert.throws(() => runDiagnosis(packet(), { run: (_program, args) => {
      if (args[0] === '--version') return { status: 0, stdout: value === 'new-cli' ? 'codex-cli 9.9.9' : 'codex-cli 0.163.0' }
      if (args[0] === 'login') return { status: 0, stderr: 'Logged in using an API key: fictional-private-token' }
      called = true
    } }))
    assert.equal(called, false)
  }
})
