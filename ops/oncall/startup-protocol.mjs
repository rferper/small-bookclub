import { zstdDecompressSync } from 'node:zlib'

export const observationLimit = 131072
const names = new Set(['update_plan', 'plan', 'function', 'custom', 'web_search', 'web_search_preview', 'image_generation', 'local_shell', 'shell', 'code_interpreter', 'mcp'])
const namespaces = new Set(['functions', 'clock', 'web', 'image_gen', 'skills'])
export function inspectDeclarations(packet) {
  const result = { fieldState: 'malformed', count: 0, names: [], embeddedState: 'malformed', embeddedCount: 0, wrappers: 0, leaves: 0, unknownNames: 0, nestedState: 'known', accepted: false }
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return result
  function scan(tools, present) {
    if (!present) return { state: 'omitted', count: 0 }
    if (!Array.isArray(tools) || tools.length > 32) return { state: 'malformed', count: 0 }
    for (const tool of tools) {
      if (!tool || typeof tool !== 'object' || Array.isArray(tool)) return { state: 'malformed', count: tools.length }
      if (tool.type === 'namespace') {
        result.wrappers++
        if (namespaces.has(tool.name)) result.names.push(tool.name)
        else result.unknownNames++
        if (!Array.isArray(tool.tools) || tool.tools.length > 32) result.nestedState = 'malformed'
        else for (const leaf of tool.tools) {
          if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf) || !['function', 'custom'].includes(leaf.type)
            || typeof leaf.name !== 'string' || leaf.tools !== undefined) { result.nestedState = 'malformed'; continue }
          result.leaves++
          if (result.wrappers + result.leaves > 64) { result.nestedState = 'malformed'; break }
          if (names.has(leaf.name)) result.names.push(leaf.name)
          else result.unknownNames++
        }
      } else {
        result.leaves++
        const name = tool.name ?? tool.function?.name ?? tool.type
        if (!['function', 'custom', 'web_search', 'web_search_preview'].includes(tool.type) || tool.tools !== undefined) result.nestedState = 'malformed'
        if (names.has(name)) result.names.push(name)
        else result.unknownNames++
      }
      if (result.wrappers + result.leaves > 64) return { state: 'malformed', count: tools.length }
    }
    return { state: tools.length ? 'nonempty' : 'empty', count: tools.length }
  }
  const top = scan(packet.tools, Object.hasOwn(packet, 'tools'))
  result.fieldState = top.state; result.count = top.count
  if (!Array.isArray(packet.input) || packet.input.length > 128) return result
  let embedded = { state: 'omitted', count: 0 }
  for (const item of packet.input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return result
    if (item.type === 'additional_tools') {
      const declaration = scan(item.tools, Object.hasOwn(item, 'tools'))
      if (['omitted', 'malformed'].includes(declaration.state)) return result
      embedded.count += declaration.count
      if (embedded.count > 32) return result
      embedded.state = embedded.count ? 'nonempty' : 'empty'
    } else if (item.type !== 'message') return result
  }
  result.embeddedState = embedded.state; result.embeddedCount = embedded.count
  result.names.sort()
  result.accepted = result.nestedState === 'known' && ['omitted', 'empty'].includes(result.fieldState) && ['omitted', 'empty'].includes(result.embeddedState)
  return result
}

export function decodeObservationRequest(bytes, encoding) {
  if (bytes.length > observationLimit || ![undefined, 'identity', 'zstd'].includes(encoding)) throw new Error('request-encoding-or-limit')
  const body = encoding === 'zstd' ? zstdDecompressSync(bytes, { maxOutputLength: observationLimit }) : bytes
  if (body.length > observationLimit) throw new Error('request-limit')
  return JSON.parse(body)
}
export function credentialHeadersPresent(headers) {
  return Object.keys(headers).some(key => /authorization|cookie|api.key|account.id/iu.test(key))
}
export function classifyStartup(text) {
  const result = { startup: [], eventState: 'known', completed: false }
  const lines = text.trim().split('\n')
  if (!text.trim() || lines.length > 128) return { ...result, eventState: 'malformed' }
  for (const line of lines) {
    let event
    try { event = JSON.parse(line) } catch { result.eventState = 'malformed'; continue }
    if (event.type === 'item.completed' && event.item?.type === 'error') {
      const message = event.item.message ?? event.item.text ?? ''
      const match = typeof message === 'string' && /^Under-development features enabled: ([^.]+)\./u.exec(message)
      result.startup.push(match && match[1] === 'skip_host_skill_discovery' ? 'under-development-feature-warning' : 'unclassified-error')
    } else if (!['thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.completed'].includes(event.type)
      || event.type.startsWith('item.') && !['agent_message', 'reasoning'].includes(event.item?.type)) result.eventState = 'unknown'
    if (event.type === 'turn.completed') result.completed = true
  }
  return result
}

// Matches the pinned Rust SSE parser's Message + Completed protocol. No inference.
export function fictionalResponseEvents() {
  const text = JSON.stringify({ schemaVersion: 1, assessment: 'insufficient-evidence', confidence: 'low', evidenceRefs: ['service-health'], hypotheses: ['unknown'], nextSteps: ['ask-owner'], humanApprovalRequired: true, actionsTaken: [], runbook: 'ops/runbooks/recovery.md' })
  const item = { type: 'message', id: 'fictional-message', role: 'assistant', phase: 'final_answer', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }
  return [
    { type: 'response.created', response: { id: 'fictional-response' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [] } },
    { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: text },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'fictional-response', end_turn: true } },
  ]
}
