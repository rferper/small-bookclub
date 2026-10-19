import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { collectEvidence, projectEvidence, services, readSignals } from './collect.mjs'
import { agentArguments, agentEnvironment, auditEvents, runDiagnosis, validateDiagnosis } from './diagnose.mjs'
import { sendStartupFixture, startupFixturePrompt } from './startup-input.mjs'
import { observeStartup } from './observe-startup.mjs'
import { classifyStartup, credentialHeadersPresent, decodeObservationRequest, fictionalResponseEvents, inspectDeclarations, observationLimit } from './startup-protocol.mjs'

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

test('outbound declarations inspect both standard and responses-lite channels and deny every exposure', () => {
  for (const tools of [undefined, []]) {
    const result = inspectDeclarations({ input: [{ type: 'message' }], ...(tools ? { tools } : {}) })
    assert.equal(result.accepted, true)
    assert.equal(result.fieldState, tools ? 'empty' : 'omitted')
    assert.equal(result.embeddedState, 'omitted')
  }
  for (const tools of [null, {}, 'bad', Array(33).fill({}), [null]]) {
    assert.equal(inspectDeclarations({ input: [], tools }).accepted, false)
  }
  for (const tool of [{ type: 'function', name: 'update_plan' }, { type: marker }]) {
    for (const packet of [{ input: [], tools: [tool] }, { input: [{ type: 'additional_tools', tools: [tool] }] }]) {
      const result = inspectDeclarations(packet)
      assert.equal(result.accepted, false)
      assert.equal(result.count + result.embeddedCount, 1)
      assert.ok(!JSON.stringify(result).includes(marker))
    }
  }
  for (const input of [undefined, {}, [null], [{ type: marker }], [{ type: 'additional_tools' }], [{ type: 'additional_tools', tools: null }]]) {
    assert.equal(inspectDeclarations({ input }).accepted, false)
  }
  assert.equal(inspectDeclarations({ input: [{ type: 'additional_tools', tools: [] }] }).accepted, true)
})

test('startup projection keeps only the confirmed notice; errors, unknown events and malformed streams stay rejected', () => {
  const warning = JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'Under-development features enabled: skip_host_skill_discovery. Warning details omitted.' } })
  assert.deepEqual(classifyStartup(warning).startup, ['under-development-feature-warning'])
  assert.throws(() => auditEvents(`${warning}\n${events()}`), /denied/u)
  assert.deepEqual(classifyStartup(JSON.stringify({ type: 'item.completed', item: { type: 'error', message: marker } })).startup, ['unclassified-error'])
  for (const text of [JSON.stringify({ type: marker }), JSON.stringify({ type: 'item.completed', item: { type: 'command_execution' } })]) {
    assert.equal(classifyStartup(text).eventState, 'unknown')
  }
  for (const text of ['', marker, Array(129).fill('{}').join('\n')]) assert.equal(classifyStartup(text).eventState, 'malformed')
  assert.equal(classifyStartup(events()).completed, true)
})

test('request decoding, credential checks and pinned fictional SSE preserve closed bounds/protocol', () => {
  assert.deepEqual(decodeObservationRequest(Buffer.from('{"input":[]}')), { input: [] })
  for (const [body, encoding] of [[Buffer.alloc(observationLimit + 1), undefined], [Buffer.from('{}'), marker], [Buffer.from(marker), undefined]]) {
    assert.throws(() => decodeObservationRequest(body, encoding))
  }
  for (const key of ['Authorization', 'cookie', 'x-api-key', 'chatgpt-account-id']) assert.equal(credentialHeadersPresent({ [key]: marker }), true)
  assert.equal(credentialHeadersPresent({ 'content-type': 'application/json' }), false)
  const sse = fictionalResponseEvents()
  assert.deepEqual(sse.map(event => event.type), ['response.created', 'response.output_item.added', 'response.output_text.delta', 'response.output_item.done', 'response.completed'])
  assert.equal(sse.at(-1).response.end_turn, true)
  assert.deepEqual(sse[1].item.content, [])
  assert.equal(sse[3].item.phase, 'final_answer')
  assert.equal(sse[2].delta, sse[3].item.content[0].text)
})

test('offline injected child proves lifecycle, all closed rejection phases, startup-on-rejection and cleanup', async () => {
  for (const fault of ['none', 'credentials', 'declarations', 'decode', 'bytes', 'boundary', 'timeout', 'output']) {
    let directory, stdinReceived = false, url
    const result = await observeStartup({ timeout: fault === 'timeout' ? 100 : 5000, launch: (_program, args, options) => {
      directory = options.cwd
      assert.equal(options.env.OPENAI_API_KEY, undefined)
      assert.equal(options.env.CODEX_HOME, join(directory, 'home'))
      assert.ok(!args.includes('suppress_unstable_features_warning=true'))
      assert.ok(args.includes('model_providers.fictional_loopback.requires_openai_auth=false'))
      url = JSON.parse(args.find(arg => arg.startsWith('model_providers.fictional_loopback.base_url=')).split('=').slice(1).join('='))
      assert.equal(new URL(url).hostname, '127.0.0.1')
      const child = new EventEmitter()
      child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough()
      let closed = false
      child.kill = () => { if (!closed) { closed = true; setImmediate(() => child.emit('close', 0)) } }
      const parts = []
      child.stdin.on('data', part => parts.push(part))
      child.stdin.on('end', async () => {
        stdinReceived = true
        assert.deepEqual(Buffer.concat(parts), startupFixturePrompt())
        child.stdout.write(`${JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'Under-development features enabled: skip_host_skill_discovery. Details.' } })}\n`)
        if (fault === 'timeout') return
        if (fault === 'output') { child.stderr.write(marker.repeat(20000)); return }
        try {
          const response = await fetch(`${url}${fault === 'boundary' ? '/unknown' : '/responses'}`, { method: 'POST',
            headers: fault === 'credentials' ? { authorization: marker } : {},
            body: fault === 'bytes' ? 'x'.repeat(observationLimit + 1) : fault === 'decode' ? marker
              : JSON.stringify({ input: [], ...(fault === 'declarations' ? { tools: [{ type: 'function', name: 'update_plan' }] } : {}) }) })
          await response.text()
          if (fault === 'none') child.stdout.write(`${events()}\n`)
        } catch { /* The closed fixture failure is the only retained diagnostic. */ }
        child.kill()
      })
      return child
    } })
    assert.equal(stdinReceived, true)
    assert.equal(result.cleanup, true)
    assert.equal(existsSync(directory), false)
    if (!['output'].includes(fault)) assert.deepEqual(result.startup, ['under-development-feature-warning'])
    assert.ok(!JSON.stringify(result).includes(marker))
    const phases = { credentials: 'credential-boundary', declarations: 'capability-declarations', decode: 'request-decode', bytes: 'request-bytes', boundary: 'request-boundary', timeout: 'deadline', output: 'output-bytes' }
    if (fault === 'none') { assert.equal(result.outcome, 'completed'); assert.equal(result.declarations.accepted, true) }
    else assert.equal(result.phase, phases[fault])
    await assert.rejects(fetch(`${url}/responses`))
  }
})

test('startup observation sends the fixed projected fictional prompt and EOF to a real subprocess', async () => {
  const prompt = startupFixturePrompt()
  assert.ok(prompt.length > 0 && prompt.length <= 65536)
  const text = prompt.toString('utf8')
  assert.ok(text.includes('<operational-evidence>'))
  const evidence = JSON.parse(text.split('<operational-evidence>\n')[1].split('\n</operational-evidence>')[0])
  assert.deepEqual(evidence, projectEvidence(packet()))
  assert.equal(evidence.source, 'fictional-fixture')
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    "import {createHash} from 'node:crypto';const parts=[];for await(const part of process.stdin)parts.push(part);const input=Buffer.concat(parts);console.log(JSON.stringify({bytes:input.length,sha256:createHash('sha256').update(input).digest('hex')}))"],
  { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const output = []
  child.stdout.on('data', part => output.push(part))
  let failed = false
  const closed = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
  const timer = setTimeout(() => child.kill(), 5000)
  try {
    assert.equal(sendStartupFixture(child, () => { failed = true; child.kill() }), prompt.length)
    assert.equal(await closed, 0, 'subprocess must receive EOF before its timeout')
    assert.equal(failed, false)
    assert.deepEqual(JSON.parse(Buffer.concat(output).toString('utf8')), {
      bytes: prompt.length, sha256: createHash('sha256').update(prompt).digest('hex'),
    })
  } finally { clearTimeout(timer); child.kill() }
})

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
  assert.ok(args.includes('tools.update_plan.enabled=false'))
  assert.ok(args.includes('tools.experimental_request_user_input.enabled=false'))
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
