// TEMPORARY #110 diagnostic (disposable branch only, never merged to main).
// Records WHEN host network interfaces/addresses/routes change while the smoke
// browser runs, using a closed vocabulary: event kind + interface class + ms offset.
// No addresses, names, hostnames, headers, cookies or bodies are retained.
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'

const KINDS = new Set(['LINK', 'ADDR', 'ROUTE', 'NEIGH'])
export function interfaceClass(name) {
  if (/^lo$/u.test(name)) return 'lo'
  if (/^veth/u.test(name)) return 'veth'
  if (/^br-/u.test(name)) return 'bridge'
  if (/^docker\d*$/u.test(name)) return 'docker0'
  if (/^(eth|ens|enp|en)\w*$/u.test(name)) return 'eth'
  return 'other'
}
export function classifyLine(line) {
  const kind = /^\[(\w+)\]/u.exec(line)?.[1]
  if (!KINDS.has(kind)) return null
  const name = /^\[\w+\](?:Deleted )?\s*\d+:\s+([\w.-]+)/u.exec(line)?.[1] ?? /\bdev\s+([\w.-]+)/u.exec(line)?.[1]
  return { kind, iface: name ? interfaceClass(name) : 'unknown', deleted: /^\[\w+\]Deleted/u.test(line) }
}
function snapshot() {
  const out = []
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) out.push(`${interfaceClass(name)}:${a.family}:${a.internal ? 'i' : 'x'}`)
  }
  return out.sort().join(',')
}

export function startNetDiag() {
  const t0 = performance.now()
  const events = []
  let last = snapshot()
  const poll = setInterval(() => {
    const now = snapshot()
    if (now !== last) { events.push({ t: Math.round(performance.now() - t0), src: 'poll', kind: 'ADDRSET', iface: 'all' }); last = now }
  }, 20)
  let monitor
  try {
    monitor = spawn('ip', ['monitor', 'link', 'address', 'route', 'neigh'], { stdio: ['ignore', 'pipe', 'ignore'] })
    let buffer = ''
    monitor.stdout.setEncoding('utf8').on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        const event = classifyLine(line)
        if (event) events.push({ t: Math.round(performance.now() - t0), src: 'ip', ...event })
      }
    })
    monitor.on('error', () => { monitor = undefined })
  } catch { monitor = undefined }
  return {
    mark: () => Math.round(performance.now() - t0),
    stop() {
      clearInterval(poll)
      monitor?.kill()
      const counts = {}
      for (const e of events) { const key = `${e.src}:${e.kind}:${e.iface}${e.deleted ? ':del' : ''}`; counts[key] = (counts[key] ?? 0) + 1 }
      return { monitorAvailable: Boolean(monitor), totalMs: Math.round(performance.now() - t0), counts, events: events.slice(0, 60) }
    },
  }
}
