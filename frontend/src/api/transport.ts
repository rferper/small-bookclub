/* eslint-disable no-control-regex -- Reject control characters at untrusted HTTP boundaries. */
import { ApiError, type ApiResult } from './client'
import type { components, operations } from './generated'

type JsonOperation = { [N in keyof operations]: ApiResult<N> extends never ? never : N }[keyof operations]
type Parameter<N extends keyof operations, K extends 'path' | 'query'> = operations[N] extends { parameters: infer P } ? K extends keyof P ? Exclude<P[K], undefined> : never : never
type Body<N extends keyof operations> = operations[N] extends { requestBody: { content: infer C } } ? C extends { 'application/json': infer J } ? J : C extends { 'multipart/form-data': unknown } ? FormData : never : never
type Slot<K extends string, T> = [T] extends [never] ? { [P in K]?: never } : { [P in K]: T }
export type OperationRequest<N extends JsonOperation> = {
  method: 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  successStatus: Extract<keyof operations[N]['responses'], 200 | 201 | 204>
  signal?: AbortSignal
} & Slot<'pathParams', Parameter<N, 'path'>> & Slot<'query', Parameter<N, 'query'>> & Slot<'body', Body<N>>

type ErrorCode = components['schemas']['Error']['code']
const codes: readonly ErrorCode[] = ['invalid_input', 'unauthenticated', 'forbidden', 'not_found', 'conflict', 'reauthentication_required', 'internal_error', 'service_unavailable', 'rate_limited']
const defaults: Record<number, [ErrorCode, string]> = {
  400: ['invalid_input', 'No se ha podido enviar la solicitud.'],
  401: ['unauthenticated', 'Vuelve a iniciar sesión.'],
  403: ['forbidden', 'No tienes permiso para realizar esta acción.'],
  404: ['not_found', 'No encontramos lo que buscas.'],
  409: ['conflict', 'No se puede realizar esta acción ahora.'],
  429: ['rate_limited', 'Demasiadas solicitudes.'],
  503: ['service_unavailable', 'El servicio no está disponible. Inténtalo de nuevo.'],
}
export function safeError(status: number): ApiError {
  const [code, message] = defaults[status] ?? ['internal_error', 'No se ha podido completar la solicitud.']
  return new ApiError(status, message, code)
}

function valueText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw safeError(500)
  if (typeof value === 'number' && !Number.isFinite(value)) throw safeError(500)
  return String(value)
}

// Never give URL normalization an opportunity to turn traversal into another route.
function safePath(path: string): void {
  if (!path.startsWith('/api/') || /[?#\\\s\u0000-\u001f\u007f]/u.test(path)) throw safeError(500)
  let decoded = path
  for (let i = 0; i < 8; i++) {
    if (decoded.includes('\\') || decoded.includes('//') || decoded.split('/').some(s => s === '.' || s === '..')) throw safeError(500)
    const next = decodeURIComponent(decoded)
    if (next === decoded) return
    // Encoded separators and controls cannot be route syntax.
    if (next.split('/').length !== decoded.split('/').length || /[\\\u0000-\u001f\u007f]/u.test(next)) throw safeError(500)
    decoded = next
  }
  throw safeError(500)
}

export function operationUrl(path: string, pathParams?: unknown, query?: unknown): string {
  try {
    safePath(path)
    const params = pathParams && typeof pathParams === 'object' ? Object.entries(pathParams) : []
    for (const [name, value] of params) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/u.test(name) || !path.includes(`{${name}}`)) throw safeError(500)
      const text = valueText(value)
      if (!text || /[/\\%\u0000-\u001f\u007f]/u.test(text) || text === '.' || text === '..') throw safeError(500)
      path = path.replaceAll(`{${name}}`, encodeURIComponent(text))
    }
    if (/[{}]/u.test(path)) throw safeError(500)
    safePath(path)
    const search = new URLSearchParams()
    if (query !== undefined) {
      if (!query || typeof query !== 'object' || Array.isArray(query)) throw safeError(500)
      for (const [name, value] of Object.entries(query)) {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/u.test(name)) throw safeError(500)
        if (value !== undefined) search.append(name, valueText(value))
      }
    }
    return path + (search.size ? `?${search.toString()}` : '')
  } catch { throw safeError(500) }
}

function csrfToken(cookie: string): string | undefined {
  const values = cookie.split(';').map(s => s.trim()).filter(s => s.startsWith('csrftoken='))
  if (values.length !== 1) return undefined
  try {
    const token = decodeURIComponent(values[0].slice('csrftoken='.length))
    return /^[a-zA-Z0-9]{32}$|^[a-zA-Z0-9]{64}$/u.test(token) ? token : undefined
  } catch { return undefined }
}

function errorBody(value: unknown): value is components['schemas']['Error'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes('code') || !keys.includes('message')) return false
  const { code, message } = value as Record<string, unknown>
  return typeof code === 'string' && codes.some(c => c === code) && typeof message === 'string' && message.trim().length > 0 && !/[<>\u0000-\u001f\u007f]/u.test(message)
}

export function createTransport({ fetch: send = globalThis.fetch, cookie = () => document.cookie }: { fetch?: typeof fetch; cookie?: () => string } = {}) {
  async function responseFor(options: { method: string; path: string; successStatus: number; pathParams?: unknown; query?: unknown; body?: unknown; signal?: AbortSignal }, accept: string): Promise<Response> {
    const url = operationUrl(options.path, options.pathParams, options.query)
    const headers = new Headers({ Accept: accept })
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(options.method)
    if (!unsafe && options.body !== undefined) throw safeError(500)
    if (unsafe) {
      let token: string | undefined
      try { token = csrfToken(cookie()) } catch { /* A denied cookie read is equivalent to absent CSRF. */ }
      if (token) headers.set('X-CSRFToken', token)
    }
    let body: BodyInit | undefined
    const input: unknown = options.body
    try {
      if (input instanceof FormData) {
        // Snapshot the fields so callers cannot change an in-flight request.
        const form = new FormData()
        for (const [name, value] of input.entries()) form.append(name, value)
        body = form
      }
      else if (input !== undefined) {
        headers.set('Content-Type', 'application/json')
        body = JSON.stringify(input)
        if (body === undefined) throw safeError(500)
      }
    } catch { throw safeError(500) }
    let response: Response
    try { response = await send(url, { method: options.method, credentials: 'same-origin', redirect: 'error', headers, body, signal: options.signal }) }
    catch { throw safeError(503) }
    if (response.redirected || response.status >= 300 && response.status < 400) throw safeError(500)
    const json = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() === 'application/json'
    if (!response.ok) {
      if (json) {
        let parsed: unknown
        try { parsed = await response.json() } catch { throw safeError(response.status) }
        if (errorBody(parsed)) throw new ApiError(response.status, parsed.message, parsed.code)
      }
      throw safeError(response.status)
    }
    if (response.status !== options.successStatus) throw safeError(500)
    return response
  }
  const request = async function request<N extends JsonOperation>(options: OperationRequest<N>): Promise<ApiResult<N>> {
    const response = await responseFor(options, 'application/json')
    if (response.status === 204) return undefined as ApiResult<N>
    if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw safeError(500)
    try {
      const parsed: unknown = await response.json()
      // The operation declaration owns this boundary. Full runtime schema validation is deferred.
      return parsed as ApiResult<N>
    } catch { throw safeError(500) }
  }
  request.exportZip = async (): Promise<{ filename: 'club-de-lectura.zip'; blob: Blob }> => {
    const response = await responseFor({ method: 'POST', path: '/api/admin/export', successStatus: 200 }, 'application/zip')
    const disposition: operations['exportClubData']['responses'][200]['headers']['Content-Disposition'] = 'attachment; filename="club-de-lectura.zip"'
    if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/zip' || response.headers.get('Content-Disposition') !== disposition || response.headers.get('Cache-Control') !== 'no-store') throw safeError(500)
    try {
      const blob = await response.blob()
      if (blob.size === 0) throw safeError(500)
      return { filename: 'club-de-lectura.zip', blob }
    } catch { throw safeError(500) }
  }
  return request
}
