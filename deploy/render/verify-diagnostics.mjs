// Closed vocabulary only: never serialize an exception, request or response.
import { networkFailureCode } from '../smoke-diagnostics.mjs'

const environments = new Set(['fixture', 'staging', 'production-demo'])
const phases = new Set(['configuration', 'startup', 'tls-readiness', 'native-smoke', 'browser-startup',
  'api-bootstrap', 'profile-edit', 'profile-reload', 'profile-isolation', 'session-isolation',
  'spoiler-gate', 'restart', 'reset-session', 'reset-profile', 'cleanup'])
const paths = new Set(['/', '/mi-perfil', '/api/session', '/api/auth/demo', '/api/me/profile', '/api/home', '/api/books', '/api/me/reviews'])
const kinds = new Set(['COMMAND_FAILED', 'TLS_READINESS', 'NATIVE_SMOKE', 'REQUEST_FAILED', 'API_TIMEOUT', 'HTTP_STATUS', 'INVALID_JSON'])
export class VerificationFailure extends Error {
  constructor(kind) { super('Controlled verification failure'); this.kind = kinds.has(kind) ? kind : 'UNKNOWN_FAILURE' }
}
export function failureKind(error) {
  if (error instanceof VerificationFailure) return kinds.has(error.kind) ? error.kind : 'UNKNOWN_FAILURE'
  if (error?.code === 'ERR_ASSERTION') return 'ASSERTION'
  if (error?.name === 'TimeoutError') return 'TIMEOUT'
  return 'UNKNOWN_FAILURE'
}
export function diagnostics(write = line => console.log(line)) {
  let active = { environment: 'fixture', phase: 'configuration' }, completed = null
  const requests = []
  return {
    async phase(environment, phase, action) {
      if (!environments.has(environment) || !phases.has(phase)) throw new Error('Invalid diagnostic phase')
      active = { environment, phase }
      requests.length = 0
      write(`Render verification: ${JSON.stringify({ ...active, status: 'started' })}`)
      const result = await action()
      completed = active
      write(`Render verification: ${JSON.stringify({ ...active, status: 'completed' })}`)
      return result
    },
    request(method, url, result) {
      // URLs are inspected only in memory; no query, hostname or unknown path escapes.
      let path
      try { path = new URL(url).pathname } catch { return }
      if (!['GET', 'POST', 'PUT'].includes(method) || !paths.has(path)) return
      const outcome = Number.isInteger(result) && result >= 100 && result <= 599 ? result : networkFailureCode(result)
      if (requests.length < 8) requests.push({ method, path, outcome })
    },
    fail(error) {
      write(`Render verification failed: ${JSON.stringify({ ...active, lastCompleted: completed,
        classification: failureKind(error), requests })}`)
    },
  }
}

export async function apiRequest(context, method, path, options, expected, diagnostic, origin) {
  let response
  try { response = await context.request[method.toLowerCase()](path, options) }
  catch (error) {
    diagnostic.request(method, new URL(path, origin).href, 'unknown')
    throw new VerificationFailure(error?.name === 'TimeoutError' ? 'API_TIMEOUT' : 'REQUEST_FAILED')
  }
  diagnostic.request(method, new URL(path, origin).href, response.status())
  if (response.status() !== expected) throw new VerificationFailure('HTTP_STATUS')
  return response
}
export async function json(response) {
  try { return await response.json() } catch { throw new VerificationFailure('INVALID_JSON') }
}

// Observe the response wait immediately, including while the click is pending.
export async function saveProfile(page) {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/me/profile' && response.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Guardar cambios', exact: true }).click(),
  ])
  if (response.status() !== 200) throw new VerificationFailure('HTTP_STATUS')
}

// Explicit local verifier probes; the release runner never invokes this script.
export function faultProbe(args) {
  const probes = new Map([
    ['--fault=api-bootstrap', ['api-bootstrap', 'REQUEST_FAILED']],
    ['--fault=profile-edit', ['profile-edit', 'TIMEOUT']],
    ['--fault=cleanup', ['cleanup', 'COMMAND_FAILED']],
  ])
  if (!args.length) return () => {}
  if (args.length !== 1 || !probes.has(args[0])) throw new Error('Invalid verifier arguments')
  const [target, kind] = probes.get(args[0])
  let injected = false
  return (environment, phase) => {
    if (injected || environment !== 'staging' || phase !== target) return
    injected = true
    if (kind === 'TIMEOUT') throw Object.assign(new Error('Controlled fault injection'), { name: 'TimeoutError' })
    throw new VerificationFailure(kind)
  }
}
