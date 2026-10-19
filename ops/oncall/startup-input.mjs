import { readFileSync } from 'node:fs'
import { projectEvidence } from './collect.mjs'

// Fixed fictional input only; never read operator-provided paths or local evidence.
export function startupFixturePrompt() {
  const task = readFileSync(new URL('./task.md', import.meta.url), 'utf8')
  const packet = projectEvidence(JSON.parse(readFileSync(new URL('./fictional-evidence.json', import.meta.url), 'utf8')))
  if (packet.source !== 'fictional-fixture') throw new Error('Invalid startup fixture')
  const prompt = Buffer.from(`${task}\n<operational-evidence>\n${JSON.stringify(packet)}\n</operational-evidence>`, 'utf8')
  if (prompt.length > 65536) throw new Error('Startup fixture input limit')
  return prompt
}

export function sendStartupFixture(child, onFailure) {
  const prompt = startupFixturePrompt()
  // '-' makes Codex read the prompt until EOF. Sending bytes without closing
  // this pipe leaves startup waiting before it can declare model capabilities.
  child.stdin.on('error', () => onFailure())
  child.stdin.end(prompt)
  return prompt.length
}
