import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './httpClient'
import { createApiClient } from './factory'
import type { Session } from './types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const sessions: Session[] = [
  { status: 'anonymous', demoSignInAvailable: false },
  { status: 'denied', demoSignInAvailable: false },
  { status: 'signedIn', user: { id: 'fictional-website-7', displayName: 'Alba ficticia', avatarUrl: null, role: 'member' } },
]

describe('HTTP session adapters', () => {
  it.each(sessions)('reads the $status session using the central same-origin transport', async session => {
    const send = vi.fn<typeof fetch>(async () => json(session))
    expect(await createHttpClient({ fetch: send }).getSession()).toEqual(session)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]).toEqual(['/api/session', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', redirect: 'error', body: undefined,
    })])
    expect(new Headers(send.mock.calls[0][1]?.headers).get('Accept')).toBe('application/json')
  })

  it('explicit HTTP selection ignores fictional admin/demo query controls and reads the server session', async () => {
    const send = vi.fn<typeof fetch>(async () => json(sessions[0]))
    vi.stubGlobal('fetch', send)
    try {
      expect(await createApiClient('http', '?mock-session=admin&mock-demo=1&mock-sign-in=admin').getSession()).toEqual(sessions[0])
      expect(send.mock.calls[0][0]).toBe('/api/session')
    } finally { vi.unstubAllGlobals() }
  })

  it('starts OAuth through top-level navigation without fetching or parsing redirects', async () => {
    const send = vi.fn<typeof fetch>()
    const navigate = vi.fn()
    await expect(createHttpClient({ fetch: send, navigate }).startSignIn()).resolves.toBeUndefined()
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/api/auth/discord/start')
    expect(send).not.toHaveBeenCalled()
  })

  it('posts logout with the current CSRF cookie and consumes the empty 204', async () => {
    let token = 'a'.repeat(32)
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${token}` })
    await expect(client.signOut()).resolves.toBeUndefined()
    token = 'B'.repeat(32)
    await expect(client.signOut()).resolves.toBeUndefined()
    for (const [index, expected] of ['a'.repeat(32), token].entries()) {
      expect(send.mock.calls[index][0]).toBe('/api/auth/logout')
      const init = send.mock.calls[index][1]
      expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'error', body: undefined })
      expect(new Headers(init?.headers).get('X-CSRFToken')).toBe(expected)
    }
  })

  it('preserves safe CSRF refusal without treating it as successful logout', async () => {
    const client = createHttpClient({ fetch: async () => json({ code: 'forbidden', message: 'No tienes permiso para realizar esta acción.' }, 403) })
    await expect(client.signOut()).rejects.toMatchObject({ status: 403, code: 'forbidden' })
  })
})
