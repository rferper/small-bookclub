import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { multipartFormData } from './adapters'
import { createTransport, operationUrl } from './transport'
import { createHttpClient } from './httpClient'

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const health = { method: 'GET', path: '/api/health', successStatus: 200 } as const

describe('central HTTP operation transport', () => {
  it('every unavailable feature adapter sends zero HTTP requests', async () => {
    const send = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', send)
    try {
      const client = createHttpClient()
      for (const name of Object.keys(client)) {
        if (['getSession', 'startSignIn', 'signOut', 'getAdminMembers', 'addMember', 'revokeMember', 'restoreMember'].includes(name)) continue
        await expect(Reflect.apply(Reflect.get(client, name), client, [])).rejects.toMatchObject({ status: 503 })
      }
      expect(send).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('sends same-origin JSON health and returns the generated body', async () => {
    const send = vi.fn<typeof fetch>(async () => ok({ status: 'ok' }))
    const result = await createTransport({ fetch: send })<'getHealth'>(health)
    expect(result.status).toBe('ok')
    const [url, init] = send.mock.calls[0]
    expect(url).toBe('/api/health')
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', redirect: 'error' })
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
    expect(new Headers(init?.headers).has('X-CSRFToken')).toBe(false)
    expect(init?.body).toBeUndefined()
  })

  it('encodes path values and query values without creating syntax', () => {
    expect(operationUrl('/api/books/{bookId}', { bookId: 'libro & uno' })).toBe('/api/books/libro%20%26%20uno')
    expect(operationUrl('/api/admin/book-metadata', undefined, { query: 'a&b /?#ñ' })).toBe('/api/admin/book-metadata?query=a%26b+%2F%3F%23%C3%B1')
  })

  it.each(['https://evil.test/api/health', '//evil.test/api/health', '/books', '/api', '/api/../health', '/api/./health', '/api/%2e%2e/health', '/api/%252e%252e/health', '/api/%2Fhealth', '/api/%255chealth', '/api/\\health', '/api//health', '/api/health?x=1', '/api/health#fragment', '/api/%', '/api/%00health', '/api/health\n'])('rejects unsafe URL %j before fetch', async path => {
    const send = vi.fn<typeof fetch>()
    await expect(createTransport({ fetch: send })<'getHealth'>({ ...health, path })).rejects.toMatchObject({ status: 500, code: 'internal_error' })
    expect(send).not.toHaveBeenCalled()
  })

  it.each(['../x', '.', '..', 'x/y', 'x\\y', '%2e%2e', '', '\u0000'])('refuses unsafe path value %j', value => {
    expect(() => operationUrl('/api/books/{bookId}', { bookId: value })).toThrow(ApiError)
  })

  it('rejects unresolved/extra parameters and non-scalar query without exposing inputs', () => {
    for (const action of [() => operationUrl('/api/books/{bookId}'), () => operationUrl('/api/books', { bookId: 'secret' }), () => operationUrl('/api/books', undefined, { query: {} }), () => operationUrl('/api/books', undefined, { 'x&token': 'secret' })]) {
      expect(action).toThrow('No se ha podido completar la solicitud.')
    }
  })

  it('sends operation JSON and reads the current CSRF cookie separately each time', async () => {
    const a = 'a'.repeat(32), b = 'B'.repeat(64)
    let cookie = `other=secret; csrftoken=${a}`
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    const transport = createTransport({ fetch: send, cookie: () => cookie })
    const input = { completed: true }
    await transport<'setWeekCompleted'>({ method: 'PUT', path: '/api/weeks/{weekId}/completion', pathParams: { weekId: 'fiction-1' }, successStatus: 204, body: input })
    cookie = `csrftoken=${b}`
    await transport<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 })
    expect(new Headers(send.mock.calls[0][1]?.headers).get('X-CSRFToken')).toBe(a)
    expect(new Headers(send.mock.calls[1][1]?.headers).get('X-CSRFToken')).toBe(b)
    expect(new Headers(send.mock.calls[0][1]?.headers).get('Content-Type')).toBe('application/json')
    expect(send.mock.calls[0][1]?.body).toBe('{"completed":true}')
    expect(input).toEqual({ completed: true })
    expect(new Headers(send.mock.calls[1][1]?.headers).has('Content-Type')).toBe(false)
  })

  it.each(['', 'csrftoken=%E0%A4%A', 'csrftoken=short', 'csrftoken=secret\r\nHeader', `csrftoken=${'a'.repeat(32)}; csrftoken=${'b'.repeat(32)}`])('missing/invalid CSRF %j adds no token or hidden request', async cookie => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    await createTransport({ fetch: send, cookie: () => cookie })<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(new Headers(send.mock.calls[0][1]?.headers).has('X-CSRFToken')).toBe(false)
  })

  it('uses multipart helpers and snapshots form fields without setting a boundary', async () => {
    const avatar = new File(['fictional bytes'], 'avatar.png', { type: 'image/png' })
    const form = multipartFormData({ metadata: { displayName: 'Ficción', favouriteBookIds: [], avatarAction: 'replace' }, avatar })
    const send = vi.fn<typeof fetch>(async () => ok({}))
    await createTransport({ fetch: send })<'updateMyProfile'>({ method: 'PUT', path: '/api/me/profile', successStatus: 200, body: form })
    const sent = send.mock.calls[0][1]?.body
    expect(sent).toBeInstanceOf(FormData)
    expect(sent).not.toBe(form)
    expect(new Headers(send.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false)
    if (!(sent instanceof FormData)) throw new Error('Expected FormData')
    expect(sent.get('avatar')).toBeInstanceOf(File)
    expect(sent.get('metadata')).toBeInstanceOf(Blob)
    form.delete('avatar')
    expect(sent.has('avatar')).toBe(true)
  })

  it('204 never attempts JSON parsing', async () => {
    const response = new Response(null, { status: 204 })
    const parse = vi.spyOn(response, 'json')
    expect(await createTransport({ fetch: async () => response })<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 })).toBeUndefined()
    expect(parse).not.toHaveBeenCalled()
  })

  it('supports typed search and creation success statuses', async () => {
    const send = vi.fn<typeof fetch>(async () => ok([]))
    expect(await createTransport({ fetch: send })<'searchBookMetadata'>({ method: 'GET', path: '/api/admin/book-metadata', query: { query: 'fiction & title' }, successStatus: 200 })).toEqual([])
    expect(send.mock.calls[0][0]).toBe('/api/admin/book-metadata?query=fiction+%26+title')
    const create = createTransport({ fetch: async () => ok({ id: 'fiction' }, 201) })
    expect(await create<'createVote'>({ method: 'POST', path: '/api/votes', successStatus: 201 })).toEqual({ id: 'fiction' })
  })

  it.each([new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }), new Response('{secret', { headers: { 'Content-Type': 'application/json' } }), new Response('<h1>secret</h1>'), ok({}, 201), new Response(null, { status: 204 }), new Response(null, { status: 302 })])('turns malformed success/protocol into a safe 500', async response => {
    await expect(createTransport({ fetch: async () => response })<'getHealth'>(health)).rejects.toMatchObject({ status: 500, code: 'internal_error', message: 'No se ha podido completar la solicitud.' })
  })

  it.each([400, 401, 403, 404, 409, 500, 503])('retains HTTP status %i and valid closed Spanish envelope', async status => {
    await expect(createTransport({ fetch: async () => ok({ code: 'conflict', message: 'No se puede realizar esta acción ahora.' }, status) })<'getHealth'>(health)).rejects.toMatchObject({ status, code: 'conflict', message: 'No se puede realizar esta acción ahora.' })
  })

  it.each([{ code: 'unknown', message: 'secret' }, { code: 'conflict', message: '' }, { code: 'conflict', message: ' ' }, { code: 'conflict', message: '<script>secret</script>' }, { code: 'conflict', message: 'safe', privateToken: 'secret' }, { message: 'secret' }, ['secret'], null])('refuses untrusted envelope %j', async body => {
    await expect(createTransport({ fetch: async () => ok(body, 403) })<'getHealth'>(health)).rejects.toMatchObject({ status: 403, code: 'forbidden', message: 'No tienes permiso para realizar esta acción.' })
  })

  it.each([new Response('private traceback', { status: 500, headers: { 'Content-Type': 'text/html' } }), new Response('secret', { status: 401, headers: { 'Content-Type': 'application/json' } })])('never displays raw failure response', async response => {
    await expect(createTransport({ fetch: async () => response })<'getHealth'>(health)).rejects.toBeInstanceOf(ApiError)
  })

  it('maps network and abort failures to safe 503 without retrying or leaking exceptions', async () => {
    for (const failure of [new Error('secret URL and traceback'), new DOMException('secret', 'AbortError')]) {
      const send = vi.fn<typeof fetch>(async () => { throw failure })
      await expect(createTransport({ fetch: send })<'getHealth'>(health)).rejects.toMatchObject({ status: 503, code: 'service_unavailable', message: 'El servicio no está disponible. Inténtalo de nuevo.' })
      expect(send).toHaveBeenCalledTimes(1)
    }
  })

  it('isolates concurrent requests, headers, body snapshots and cancellation', async () => {
    const send = vi.fn<typeof fetch>((_url, options) => new Promise((resolve, reject) => {
      if (options?.signal) options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      else resolve(ok({ status: 'ok' }))
    }))
    const controller = new AbortController()
    const transport = createTransport({ fetch: send })
    const first = transport<'getHealth'>({ ...health, signal: controller.signal })
    const second = transport<'getHealth'>(health)
    controller.abort()
    await expect(first).rejects.toMatchObject({ status: 503 })
    await expect(second).resolves.toEqual({ status: 'ok' })
    expect(send.mock.calls[0][1]?.headers).not.toBe(send.mock.calls[1][1]?.headers)
    expect(send.mock.calls[1][1]?.signal).toBeUndefined()
  })
})
