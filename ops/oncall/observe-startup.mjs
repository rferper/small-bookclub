// Manual non-inference investigation only. Never run this from CI or the diagnosis runner.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { agentArguments, agentEnvironment } from './diagnose.mjs'
import { sendStartupFixture } from './startup-input.mjs'
import { loadCatalog, prepareCatalog } from './model-catalog.mjs'
import { classifyStartup, credentialHeadersPresent, decodeObservationRequest, fictionalResponseEvents, inspectDeclarations, observationLimit } from './startup-protocol.mjs'

export async function observeStartup({ launch = spawn, timeout = 30000 } = {}) {
  if (timeout <= 0 || timeout > 30000) throw new Error('Invalid observation bound')
  loadCatalog()
  const directory = mkdtempSync(join(tmpdir(), 'bookclub-startup-'))
  const home = join(directory, 'home')
  const result = { requestCount: 0, credentialHeaders: false, declarations: null, startup: [], eventState: 'unobserved', completed: false, phase: 'setup', outcome: 'unknown', cleanup: false }
  let child, timer, bytes = 0, rejected = false
  const output = []
  function fail(phase, outcome = 'fixture-rejected') {
    if (!rejected) { result.phase = phase; result.outcome = outcome }
    rejected = true
    child?.kill()
  }
  const server = createServer(async (request, response) => {
    let phase = 'request-boundary'
    try {
      if (++result.requestCount > 1 || request.method !== 'POST' || request.url !== '/responses') throw new Error()
      phase = 'credential-boundary'
      if (credentialHeadersPresent(request.headers)) { result.credentialHeaders = true; throw new Error() }
      phase = 'request-bytes'
      const chunks = []
      for await (const chunk of request) {
        bytes += chunk.length
        if (bytes > observationLimit) throw new Error()
        chunks.push(chunk)
      }
      phase = 'request-decode'
      const packet = decodeObservationRequest(Buffer.concat(chunks), request.headers['content-encoding'])
      phase = 'capability-declarations'
      result.declarations = inspectDeclarations(packet)
      if (!result.declarations.accepted) throw new Error()
      phase = 'fictional-sse'
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of fictionalResponseEvents()) {
        const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        bytes += Buffer.byteLength(frame)
        if (bytes > observationLimit) throw new Error()
        response.write(frame)
      }
      response.end()
      result.phase = 'response-sent'
    } catch {
      if (!response.headersSent) response.writeHead(400)
      response.end()
      fail(phase)
    }
  })
  try {
    timer = setTimeout(() => fail('deadline', 'timeout'), timeout)
    mkdirSync(home)
    writeFileSync(join(directory, 'schema.json'), readFileSync(new URL('./diagnosis.schema.json', import.meta.url)))
    prepareCatalog(directory)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const environment = agentEnvironment(process.env)
    for (const key of Object.keys(environment)) if (/^(codex_home|userprofile|home|appdata|localappdata)$/iu.test(key)) delete environment[key]
    Object.assign(environment, { CODEX_HOME: home, USERPROFILE: home, HOME: home, APPDATA: home, LOCALAPPDATA: home })
    const args = agentArguments(directory)
    args.pop()
    for (const setting of ['model_provider="fictional_loopback"', 'model_providers.fictional_loopback.name="fictional loopback"',
      `model_providers.fictional_loopback.base_url="http://127.0.0.1:${server.address().port}"`,
      'model_providers.fictional_loopback.requires_openai_auth=false', 'model_providers.fictional_loopback.wire_api="responses"',
      'model_providers.fictional_loopback.request_max_retries=0', 'model_providers.fictional_loopback.stream_max_retries=0',
      'model_providers.fictional_loopback.supports_websockets=false']) args.push('-c', setting)
    args.push('-')
    result.phase = 'subprocess-startup'
    child = launch('codex', args, { cwd: directory, env: environment, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    const closed = new Promise(resolve => { child.on('error', () => resolve(null)); child.on('close', resolve) })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      bytes += chunk.length
      if (bytes > observationLimit) fail('output-bytes', 'output-limit')
      else if (stream === child.stdout) output.push(chunk)
    })
    bytes += sendStartupFixture(child, () => fail('input-pipe', 'input-failed'))
    const status = await closed
    Object.assign(result, classifyStartup(Buffer.concat(output).toString('utf8')))
    if (!rejected) {
      result.phase = 'event-classification'
      result.outcome = result.eventState !== 'known' || result.startup.includes('unclassified-error') ? 'unknown-event'
        : status !== 0 ? 'subprocess-failed' : !result.completed || result.requestCount !== 1 ? 'incomplete' : 'completed'
    }
  } catch { fail('observation-lifecycle', 'observation-failed') }
  finally {
    clearTimeout(timer)
    child?.kill()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    try {
      if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + 'bookclub-startup-')) throw new Error()
      rmSync(directory, { recursive: true, force: true })
      result.cleanup = !existsSync(directory) && !server.listening
    } catch { result.cleanup = false }
    if (!result.cleanup) { result.phase = 'cleanup'; result.outcome = 'cleanup-failed' }
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw new Error('Invalid observation arguments')
  console.log(JSON.stringify(await observeStartup()))
}
