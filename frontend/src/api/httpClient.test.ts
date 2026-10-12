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

describe('HTTP allowlist adapters', () => {
  it('uses the contract paths, bodies, status codes and current CSRF cookie', async () => {
    const members = { members: [], curator: null }
    const send = vi.fn<typeof fetch>(async (_url, init) => json(members, init?.method === 'POST' && init?.body ? 201 : 200))
    let token = 'a'.repeat(32)
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${token}` })
    await expect(client.getAdminMembers()).resolves.toEqual(members)
    await expect(client.addMember({ discordId: '000000000000000001', displayName: 'Alba' })).resolves.toEqual(members)
    token = 'b'.repeat(32)
    await expect(client.restoreMember('member-1')).resolves.toEqual(members)
    await expect(client.revokeMember('member-1')).resolves.toEqual(members)
    expect(send.mock.calls.map(([url]) => url)).toEqual([
      '/api/admin/members', '/api/admin/members',
      '/api/admin/members/member-1/restore', '/api/admin/members/member-1/revoke',
    ])
    expect(send.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'POST', 'POST'])
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual({ discordId: '000000000000000001', displayName: 'Alba' })
    expect(new Headers(send.mock.calls[0][1]?.headers).get('X-CSRFToken')).toBeNull()
    expect(new Headers(send.mock.calls[1][1]?.headers).get('X-CSRFToken')).toBe('a'.repeat(32))
    for (const call of send.mock.calls.slice(2)) expect(new Headers(call[1]?.headers).get('X-CSRFToken')).toBe('b'.repeat(32))
    for (const call of send.mock.calls) expect(call[1]).toMatchObject({ credentials: 'same-origin', redirect: 'error' })
  })

  it('keeps generic conflict and authorization failures and never sends unsafe path data', async () => {
    const send = vi.fn<typeof fetch>(async () => json({ code: 'conflict', message: 'La acción no está disponible en este estado.' }, 409))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'c'.repeat(32)}` })
    await expect(client.addMember({ discordId: '12345678901234567', displayName: 'Alba' })).rejects.toMatchObject({ status: 409, code: 'conflict' })
    await expect(client.revokeMember('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe('HTTP own-profile adapters', () => {
  it('reads the session-owned profile and sends one multipart save with CSRF', async () => {
    const profile = { member: { id: 'fictional-member-1', displayName: 'Alba ficticia', avatarUrl: null }, bio: null, favouriteQuote: null, favouriteBooks: [], favouriteOptions: [] }
    const send = vi.fn<typeof fetch>(async () => json(profile))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'c'.repeat(32)}` })
    expect(await client.getMyProfile()).toEqual(profile)
    const file = new File(['fictional-image'], 'avatar.png', { type: 'image/png' })
    expect(await client.updateMyProfile({ displayName: 'Alba ficticia', bio: 'Bio', favouriteQuote: null, favouriteBookIds: [], avatar: { action: 'replace', file } })).toEqual(profile)
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/me/profile', '/api/me/profile'])
    expect(send.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'PUT'])
    const init = send.mock.calls[1][1]!
    expect(new Headers(init.headers).get('X-CSRFToken')).toBe('c'.repeat(32))
    expect(new Headers(init.headers).get('Content-Type')).toBeNull()
    const form = init.body as FormData
    expect([...form.keys()]).toEqual(['metadata', 'avatar'])
    expect(JSON.parse(await (form.get('metadata') as Blob).text())).toEqual({
      displayName: 'Alba ficticia', bio: 'Bio', favouriteQuote: null, favouriteBookIds: [], avatarAction: 'replace',
    })
    expect((form.get('avatar') as File).name).toBe('avatar.png')
  })
})
