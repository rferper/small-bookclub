// Opt-in evidence for #110's disposable loopback investigation. Never serialize
// CDP objects: they can include automatic Cookie/Authorization headers.
import { networkFailureCode } from '../smoke-diagnostics.mjs'

const environments = new Set(['staging', 'production-demo'])
const phases = new Set(['bootstrap', 'navigation', 'demo-sign-in', 'home', 'library', 'sign-out', 'profile-edit', 'profile-reload'])
const paths = new Set(['/', '/mi-perfil', '/biblioteca', '/api/session', '/api/auth/demo', '/api/auth/logout', '/api/home', '/api/books', '/api/me/profile', '/api/me/reviews'])
const methods = new Set(['GET', 'POST', 'PUT'])
const protocols = new Set(['http/1.0', 'http/1.1', 'h2', 'h3'])
const states = new Set(['created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead'])
export function evidenceEnabled(env, origin, localCa) {
  if (env.BOOKCLUB_RENDER_EVIDENCE !== '1' || !localCa || !environments.has(env.BOOKCLUB_RENDER_WORLD)) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'
  } catch { return false }
}
export function version(value) {
  return typeof value === 'string' && /^v?\d+(?:\.\d+){1,3}$/u.test(value) ? value.replace(/^v/u, '') : 'unknown'
}
export function containerState(value) {
  return {
    status: states.has(value?.status) ? value.status : 'unknown',
    running: value?.running === true, oomKilled: value?.oomKilled === true,
    exitCode: Number.isInteger(value?.exitCode) && value.exitCode >= -1 && value.exitCode <= 255 ? value.exitCode : -1,
    restartCount: Number.isInteger(value?.restartCount) && value.restartCount >= 0 && value.restartCount <= 1000000 ? value.restartCount : -1,
  }
}
export function transportRecorder({ environment, origin, phase, write = console.log, now = performance.now.bind(performance) }) {
  if (!environments.has(environment)) throw new Error('Invalid transport evidence environment')
  const requests = new Map()
  let emitted = 0
  function emit(request, event, extra = {}) {
    if (emitted++ >= 64) return
    const durationMs = Math.max(0, Math.min(180000, Math.round(now() - request.started)))
    write(`Render transport evidence: ${JSON.stringify({ environment, phase: request.phase,
      method: request.method, path: request.path, event, protocol: request.protocol,
      status: request.status, durationMs, ...extra })}`)
  }
  return {
    request(event) {
      let url
      try { url = new URL(event.request.url) } catch { return }
      if (url.origin !== origin || !paths.has(url.pathname) || !methods.has(event.request.method) || requests.size >= 64) return
      const current = phase()
      requests.set(event.requestId, { method: event.request.method, path: url.pathname,
        phase: phases.has(current) ? current : 'unknown', protocol: 'unknown', status: 0, started: now() })
    },
    response(event) {
      const request = requests.get(event.requestId)
      if (!request) return
      request.protocol = protocols.has(event.response.protocol) ? event.response.protocol : 'unknown'
      const status = event.response.status
      request.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0
    },
    finished(event) {
      const request = requests.get(event.requestId)
      if (!request) return
      emit(request, 'complete')
      requests.delete(event.requestId)
    },
    failed(event) {
      const request = requests.get(event.requestId)
      if (!request) return
      emit(request, 'failed', { code: networkFailureCode(event.errorText), canceled: event.canceled === true,
        blocked: typeof event.blockedReason === 'string' && event.blockedReason.length > 0 })
      requests.delete(event.requestId)
    },
    flush() {
      for (const request of requests.values()) emit(request, 'pending')
      requests.clear()
    },
  }
}
export async function observeTransport(context, page, options) {
  const recorder = transportRecorder(options)
  const session = await context.newCDPSession(page)
  session.on('Network.requestWillBeSent', event => recorder.request(event))
  session.on('Network.responseReceived', event => recorder.response(event))
  session.on('Network.loadingFinished', event => recorder.finished(event))
  session.on('Network.loadingFailed', event => recorder.failed(event))
  await session.send('Network.enable')
  return recorder
}
