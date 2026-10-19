// Private local notifications only. Never serialize an incoming webhook object.
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export const summary = 'Errores del servidor afectan a la API del club'
const environments = new Set(['development', 'test', 'demo', 'production', 'staging', 'production-demo'])
export function projectAlert(alert, now = new Date()) {
  const labels = alert?.labels
  const ratio = alert?.annotations?.error_ratio
  if (!['firing', 'resolved'].includes(alert?.status) || labels?.alertname !== 'BookclubApiErrors'
    || labels.severity !== 'critical' || labels.service !== 'small-bookclub-backend'
    || !environments.has(labels.deployment_environment_name)
    || typeof labels.service_version !== 'string'
    || !/^(unversioned|release-[a-f0-9]{40})$/u.test(labels.service_version)
    || typeof ratio !== 'string' || !/^(0(?:\.\d{1,20})?|1(?:\.0{1,20})?)$/u.test(ratio)) return null
  return { alertname: 'BookclubApiErrors', status: alert.status, severity: 'critical',
    service: 'small-bookclub-backend', environment: labels.deployment_environment_name,
    version: labels.service_version, errorRatio: Number(ratio), summary,
    windowSeconds: 120, sustainedSeconds: 60, minimumErrors: 3, thresholdRatio: 0.2,
    runbook: 'ops/alerts/README.md', receivedAt: now.toISOString() }
}

export function receiver({ write = console.log } = {}) {
  const history = []
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'GET' && req.url === '/events') {
      res.end(JSON.stringify(history)); return
    }
    if (req.method !== 'POST' || req.url !== '/alerts') { res.writeHead(404).end('{}'); return }
    if (req.headers['content-type'] !== 'application/json'
      || !/^\d{1,5}$/u.test(req.headers['content-length'] ?? '')
      || Number(req.headers['content-length']) > 32768) { res.writeHead(413).end('{}'); req.resume(); return }
    try {
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > 32768) { res.writeHead(413).end('{}'); return }
        chunks.push(chunk)
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!Array.isArray(payload?.alerts) || payload.alerts.length < 1 || payload.alerts.length > 8) {
        res.writeHead(400).end('{}'); return
      }
      const events = payload.alerts.map(alert => projectAlert(alert))
      if (events.some(event => event === null)) { res.writeHead(400).end('{}'); return }
      for (const event of events) {
        history.push(event)
        if (history.length > 64) history.shift()
        write(JSON.stringify(event))
      }
      res.writeHead(204).end()
    } catch { res.writeHead(400).end('{}') }
  })
  server.maxConnections = 16
  server.maxRequestsPerSocket = 32
  server.headersTimeout = 5000
  server.requestTimeout = 5000
  server.timeout = 5000
  server.keepAliveTimeout = 1000
  // Invalid framing can contain secret-bearing raw packet data; never log it.
  server.on('clientError', (_error, socket) => socket.destroy())
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  receiver().listen(9099, '0.0.0.0')
}
