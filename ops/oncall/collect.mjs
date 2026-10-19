import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const services = ['backend', 'frontend', 'otel-collector', 'prometheus', 'loki', 'tempo', 'grafana', 'alertmanager', 'alert-receiver']
const states = new Set(['created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead'])
const environments = new Set(['development', 'test', 'demo', 'production', 'staging', 'production-demo'])
const release = value => typeof value === 'string' && /^(unversioned|release-[a-f0-9]{40})$/u.test(value)
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value))
const bounded = (value, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : 0

export function projectEvidence(input) {
  if (!input || !['local-compose', 'fictional-fixture'].includes(input.source) || !timestamp(input.collectedAt)
    || !Array.isArray(input.services) || input.services.length > 9
    || !Array.isArray(input.notifications) || input.notifications.length > 64) throw new Error('Invalid operational packet')
  const notifications = input.notifications.slice(-8).flatMap(event => {
    if (!event || event.alertname !== 'BookclubApiErrors' || !['firing', 'resolved'].includes(event.status)
      || !environments.has(event.environment) || !release(event.version) || !timestamp(event.receivedAt)
      || typeof event.errorRatio !== 'number' || !Number.isFinite(event.errorRatio) || event.errorRatio < 0 || event.errorRatio > 1) return []
    return [{ alertname: 'BookclubApiErrors', status: event.status, environment: event.environment,
      version: event.version, errorRatio: event.errorRatio, receivedAt: event.receivedAt }]
  })
  return { schemaVersion: 1, source: input.source, collectedAt: input.collectedAt,
    services: services.map(service => {
      const item = input.services.find(item => item?.service === service)
      return { service, status: states.has(item?.status) ? item.status : 'unknown',
        health: ['healthy', 'unhealthy', 'starting'].includes(item?.health) ? item.health : 'unknown',
        oomKilled: item?.oomKilled === true, restarts: bounded(item?.restarts, 1000000) }
    }), notifications,
    alertRule: { state: ['inactive', 'pending', 'firing'].includes(input.alertRule?.state) ? input.alertRule.state : 'unknown',
      health: ['ok', 'err'].includes(input.alertRule?.health) ? input.alertRule.health : 'unknown' } }
}

// Fixed GETs only; no URL, query or code from an alert/model reaches this script.
export const readSignals = `
const values = await Promise.all(['http://prometheus:9090/api/v1/rules','http://127.0.0.1:9099/events'].map(async url => {
  try {
    const response = await fetch(url, {method:'GET',redirect:'error',signal:AbortSignal.timeout(5000)});
    if (!response.ok) return null;
    let size=0; const parts=[];
    for await (const chunk of response.body) {size+=chunk.length; if(size>65536) return null; parts.push(chunk)}
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch {return null}
}));
const rule=values[0]?.data?.groups?.flatMap(group=>group.rules).find(rule=>rule.name==='BookclubApiErrors');
console.log(JSON.stringify({alertRule:{state:rule?.state,health:rule?.health},notifications:values[1]??[]}));
`

export function collectEvidence(project, { run = spawnSync } = {}) {
  if (!/^bookclub-(monitor|observability)-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(project ?? '') || project.length > 80) throw new Error('Invalid monitoring project')
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const deadline = Date.now() + 90000
  const command = args => {
    if (Date.now() >= deadline) return ''
    const result = run('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: Math.min(15000, deadline - Date.now()), maxBuffer: 65536, windowsHide: true, shell: false })
    return result.error || result.status !== 0 || result.stdout?.length > 65536 ? '' : result.stdout?.trim() ?? ''
  }
  const items = [], ids = new Map()
  for (const service of services) {
    const id = command(['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'ops/compose.observability.yml', 'ps', '-a', '-q', service])
    if (!/^[a-f0-9]{64}$/u.test(id)) { items.push({ service }); continue }
    ids.set(service, id)
    const format = '{"status":{{json .State.Status}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"unknown"{{end}},"oomKilled":{{.State.OOMKilled}},"restarts":{{.RestartCount}}}'
    try { items.push({ service, ...JSON.parse(command(['inspect', '--format', format, id])) }) }
    catch { items.push({ service }) }
  }
  let signals = {}
  if (ids.has('alert-receiver')) {
    try { signals = JSON.parse(command(['exec', ids.get('alert-receiver'), 'node', '--input-type=module', '-e', readSignals])) }
    catch { /* Missing evidence stays unknown; raw output is never retained. */ }
  }
  return projectEvidence({ ...signals, source: 'local-compose', collectedAt: new Date().toISOString(),
    services: items, notifications: Array.isArray(signals.notifications) ? signals.notifications : [] })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Invalid collector arguments')
    console.log(JSON.stringify(collectEvidence(process.argv[2]), null, 2))
  } catch { console.error('Operational collection failed; raw details suppressed'); process.exitCode = 1 }
}
