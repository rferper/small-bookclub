// Manual non-inference investigation only. Never run this from CI or the diagnosis runner.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { agentArguments, agentEnvironment } from './diagnose.mjs'
import { sendStartupFixture } from './startup-input.mjs'

const suppress = process.argv.slice(2)
if (suppress.length > 1 || suppress.length && suppress[0] !== '--suppress-warning') throw new Error('Invalid observation mode')
const directory = mkdtempSync(join(tmpdir(), 'bookclub-startup-'))
const home = join(directory, 'home')
mkdirSync(home)
writeFileSync(join(directory, 'schema.json'), readFileSync(new URL('./diagnosis.schema.json', import.meta.url)))
const result = { requestCount: 0, credentialHeaders: false, tools: [], startup: [], outcome: 'unknown', cleanup: false }
let child
let bytes = 0
let rejected = false
const known = new Set(['update_plan', 'plan', 'function', 'custom', 'web_search', 'web_search_preview', 'image_generation', 'local_shell', 'shell', 'code_interpreter', 'mcp'])
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'POST' || request.url !== '/responses' || ++result.requestCount > 1) throw new Error()
    if (Object.keys(request.headers).some(key => /authorization|cookie|api.key|account.id/iu.test(key))) {
      result.credentialHeaders = true
      throw new Error()
    }
    const chunks = []
    for await (const chunk of request) {
      bytes += chunk.length
      if (bytes > 131072) throw new Error()
      chunks.push(chunk)
    }
    const compressed = Buffer.concat(chunks)
    const body = request.headers['content-encoding'] === 'zstd' ? zstdDecompressSync(compressed, { maxOutputLength: 131072 }) : compressed
    if (body.length > 131072) throw new Error()
    const packet = JSON.parse(body)
    if (!Array.isArray(packet.tools) || packet.tools.length > 32) throw new Error()
    result.tools = packet.tools.map(tool => {
      const name = tool.name ?? tool.function?.name ?? tool.type
      if (!known.has(name)) throw new Error()
      return name
    }).sort()
    const text = JSON.stringify({ schemaVersion: 1, assessment: 'insufficient-evidence', confidence: 'low', evidenceRefs: ['service-health'], hypotheses: ['unknown'], nextSteps: ['ask-owner'], humanApprovalRequired: true, actionsTaken: [], runbook: 'ops/runbooks/recovery.md' })
    const item = { type: 'message', id: 'fictional-message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const event of [
      { type: 'response.created', response: { id: 'fictional-response', status: 'in_progress', output: [] } },
      { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: text },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: { id: 'fictional-response', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
    ]) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    response.end()
  } catch {
    rejected = true
    result.outcome = 'fixture-rejected'
    response.writeHead(400).end()
    child?.kill()
  }
})
let timer
try {
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
    'model_providers.fictional_loopback.supports_websockets=false',
    ...(suppress.length ? ['suppress_unstable_features_warning=true'] : [])]) args.push('-c', setting)
  args.push('-')
  child = spawn('codex', args, { cwd: directory, env: environment, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
  bytes += sendStartupFixture(child, () => {
    rejected = true
    result.outcome = 'input-failed'
    child.kill()
  })
  const output = []
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    bytes += chunk.length
    if (bytes > 131072) { rejected = true; result.outcome = 'output-limit'; child.kill() }
    else if (stream === child.stdout) output.push(chunk)
  })
  timer = setTimeout(() => { rejected = true; result.outcome = 'timeout'; child.kill() }, 30000)
  const status = await new Promise(resolve => { child.on('error', () => resolve(null)); child.on('close', resolve) })
  if (!rejected) {
    let unknown = false
    for (const line of Buffer.concat(output).toString('utf8').trim().split('\n')) {
      const event = JSON.parse(line)
      if (event.type === 'item.completed' && event.item?.type === 'error') {
        const message = event.item.message ?? event.item.text ?? ''
        result.startup.push(typeof message === 'string' && message.includes('Under-development features enabled:') && message.includes('skip_host_skill_discovery') ? 'under-development-feature-warning' : 'unclassified-error')
      } else if (!['thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.completed'].includes(event.type)
        || event.type.startsWith('item.') && !['agent_message', 'reasoning'].includes(event.item?.type)) unknown = true
    }
    result.outcome = unknown ? 'unknown-event' : status === 0 ? 'completed' : 'subprocess-failed'
  }
} catch { result.outcome = 'observation-failed' }
finally {
  clearTimeout(timer)
  child?.kill()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  if (resolve(directory).startsWith(resolve(tmpdir()) + sep + 'bookclub-startup-')) {
    rmSync(directory, { recursive: true, force: true })
    result.cleanup = true
  }
}
console.log(JSON.stringify(result))
