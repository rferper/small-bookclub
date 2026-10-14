import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './httpClient'
import { createApiClient } from './factory'
import type { Session } from './types'
import type { BookInput } from './types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const sessions: Session[] = [
  { status: 'anonymous', demoSignInAvailable: false },
  { status: 'denied', demoSignInAvailable: false },
  { status: 'signedIn', user: { id: 'fictional-website-7', displayName: 'Alba ficticia', avatarUrl: null, role: 'member' } },
]

describe('authenticated ZIP export transport', () => {
  const headers = { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="club-de-lectura.zip"', 'Cache-Control': 'no-store' }
  it('gets truthful backup metadata and downloads private ZIP through the central CSRF transport', async () => {
    const send = vi.fn<typeof fetch>(async url => String(url).endsWith('/backups') ? json({policy:'pending',lastBackupAt:null}) : new Response('fictional ZIP bytes', {headers}))
    const api = createHttpClient({fetch:send,cookie:()=>`csrftoken=${'a'.repeat(32)}`})
    expect(await api.getBackupInfo()).toEqual({policy:'pending',lastBackupAt:null})
    const result = await api.exportClubData()
    expect(result.filename).toBe('club-de-lectura.zip')
    if (!('blob' in result)) throw new Error('Expected ZIP blob')
    expect(result.blob.type).toBe('application/zip')
    expect(result.blob.size).toBeGreaterThan(0)
    const [url,init] = send.mock.calls[1]
    expect(url).toBe('/api/admin/export')
    expect(init).toMatchObject({method:'POST',credentials:'same-origin',redirect:'error',body:undefined})
    expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('a'.repeat(32))
    expect(new Headers(init?.headers).get('Accept')).toBe('application/zip')
  })
  it('preserves reauthentication-required without pretending it is a session expiry', async () => {
    const api = createHttpClient({fetch:async()=>json({code:'reauthentication_required',message:'Vuelve a identificarte con Discord.'},409)})
    await expect(api.exportClubData()).rejects.toMatchObject({status:409,code:'reauthentication_required'})
  })
  it('hands export reauthentication to the existing top-level OAuth route', async () => {
    const navigate = vi.fn(), send = vi.fn<typeof fetch>()
    await createHttpClient({navigate,fetch:send}).startSignIn('export')
    expect(navigate).toHaveBeenCalledWith('/api/auth/discord/start?purpose=export')
    expect(send).not.toHaveBeenCalled()
  })
  it.each([
    {'Content-Type':'text/html'}, {'Content-Disposition':'attachment; filename="../../private.zip"'}, {'Cache-Control':'public'},
  ])('rejects an unexpected ZIP attachment boundary %j', async extra => {
    const api = createHttpClient({fetch:async()=>new Response('fictional bytes',{headers:{...headers,...extra}})})
    await expect(api.exportClubData()).rejects.toMatchObject({status:500})
  })
  it('rejects an empty attachment and redirects', async () => {
    for(const response of [new Response('',{headers}),new Response(null,{status:302,headers:{Location:'https://invalid.example'}})]) {
      await expect(createHttpClient({fetch:async()=>response}).exportClubData()).rejects.toMatchObject({status:500})
    }
  })
})

describe('native safe audit transport', () => {
  it('returns only the server metadata through the central authenticated JSON adapter', async () => {
    const events=[{id:'event-fiction',action:'purged',target:{type:'quote',id:'8',label:'Cita literaria'},actor:{id:'1',displayName:'Persona ficticia'},occurredAt:'2026-10-14T12:00:00Z'}]
    const send=vi.fn<typeof fetch>(async()=>json(events))
    expect(await createHttpClient({fetch:send}).getAuditLog()).toEqual(events)
    expect(send.mock.calls[0]).toEqual(['/api/admin/audit-log',expect.objectContaining({method:'GET',credentials:'same-origin',body:undefined})])
  })
})

describe('HTTP taste compatibility adapter', () => {
  it('uses the central session transport and preserves the server comparison union', async () => {
    const body = { minSharedBooks: 3, members: [{ member: { id: '2', displayName: 'Lector ficticio', avatarUrl: null }, sharedBookCount: 2, comparison: { status: 'insufficient' as const } }] }
    const send = vi.fn<typeof fetch>(async () => json(body))
    expect(await createHttpClient({ fetch: send }).getTasteCompatibility()).toEqual(body)
    expect(send.mock.calls[0]).toEqual(['/api/statistics/compatibility', expect.objectContaining({ method: 'GET', credentials: 'same-origin', body: undefined })])
  })

  it('preserves authentication errors', async () => {
    const client = createHttpClient({ fetch: async () => json({ code: 'unauthenticated', message: 'Debes iniciar sesión.' }, 401) })
    await expect(client.getTasteCompatibility()).rejects.toMatchObject({ status: 401, code: 'unauthenticated' })
  })
})

describe('HTTP statistics adapter', () => {
  it('returns the server empty union and explicit independent counts through the central transport', async () => {
    const body = { booksRead: 4, meetingsHeld: 2, thresholds: { bookRatings: 3, memberRatings: 3 }, ratings: { status: 'empty' as const } }
    const send = vi.fn<typeof fetch>(async () => json(body))
    expect(await createHttpClient({ fetch: send }).getStatistics()).toEqual(body)
    expect(send.mock.calls[0]).toEqual(['/api/statistics', expect.objectContaining({ method: 'GET', credentials: 'same-origin', body: undefined })])
  })
})

describe('HTTP literary quote adapters', () => {
  it('lists, creates, updates and soft-removes through the contract paths and current CSRF cookie', async () => {
    const input = { text: 'Cita ficticia.', author: null, source: null, active: true }
    const quote = { id: '8', ...input }
    const send = vi.fn<typeof fetch>(async (_url, init) => json(init?.method === 'GET' ? [quote] : init?.method === 'DELETE' ? [] : quote, init?.method === 'POST' ? 201 : 200))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'q'.repeat(32)}` })
    expect(await client.listAdminQuotes()).toEqual([quote])
    expect(await client.addLiteraryQuote(input)).toEqual(quote)
    expect(await client.updateLiteraryQuote('8', input)).toEqual(quote)
    expect(await client.deleteLiteraryQuote('8')).toEqual([])
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/admin/quotes', '/api/admin/quotes', '/api/admin/quotes/8', '/api/admin/quotes/8'])
    for (const [, init] of send.mock.calls.slice(1)) expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('q'.repeat(32))
    expect(JSON.parse(send.mock.calls[1][1]!.body as string)).toEqual(input)
    expect(JSON.parse(send.mock.calls[2][1]!.body as string)).toEqual(input)
    expect(send.mock.calls[3][1]?.body).toBeUndefined()
  })
})

describe('HTTP recycle-bin adapters', () => {
  it('uses canonical paths and CSRF for native delete, restore and purge without sending content', async () => {
    const send = vi.fn<typeof fetch>(async () => json([]))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'r'.repeat(32)}` })
    expect(await client.getRecycleBin()).toEqual([])
    expect(await client.deleteBook('9')).toEqual([])
    expect(await client.restoreDeleted('week', '4')).toEqual([])
    expect(await client.purgeDeleted('quote', '5')).toEqual([])
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/admin/bin', '/api/admin/books/9', '/api/admin/bin/week/4/restore', '/api/admin/bin/quote/5'])
    expect(send.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'DELETE', 'POST', 'DELETE'])
    for (const [, init] of send.mock.calls) {
      expect(init?.body).toBeUndefined()
      expect(init?.credentials).toBe('same-origin')
    }
    for (const [, init] of send.mock.calls.slice(1)) expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('r'.repeat(32))
  })
})

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

describe('HTTP member directory adapters', () => {
  it('reads the directory and encodes native profile keys using the central transport', async () => {
    const directory = { currentWeekNumber: null, members: [] }
    const profile = { member: { id: '7', displayName: 'Alba ficticia', avatarUrl: null }, bio: null, favouriteQuote: null, favouriteBooks: [], isMe: false, currentWeek: null }
    const send = vi.fn<typeof fetch>(async url => json(url === '/api/members' ? directory : profile))
    const client = createHttpClient({ fetch: send })
    expect(await client.listMembers()).toEqual(directory)
    expect(await client.getMemberProfile('7')).toEqual(profile)
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/members', '/api/members/7'])
    for (const [, init] of send.mock.calls) expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', body: undefined })
    await expect(client.getMemberProfile('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(2)
  })
})

describe('HTTP manual catalogue adapters', () => {
  it('reads protected book detail by safe native key and preserves generic 404', async () => {
    const send = vi.fn<typeof fetch>(async () => json({ code: 'not_found', message: 'No se ha encontrado.' }, 404))
    const client = createHttpClient({ fetch: send })
    await expect(client.getBook('7')).rejects.toMatchObject({ status: 404, code: 'not_found' })
    expect(send.mock.calls[0][0]).toBe('/api/books/7')
    await expect(client.getBook('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('reads the member bookshelf once without sending local view/filter/sort state', async () => {
    const books = [{ id: '7', title: 'Fictional', authors: [], coverUrl: null, status: 'terminado', readingStartDate: null, readingEndDate: null, datesApproximate: false }]
    const send = vi.fn<typeof fetch>(async () => json(books))
    expect(await createHttpClient({ fetch: send }).listBooks()).toEqual(books)
    expect(send).toHaveBeenCalledExactlyOnceWith('/api/books', expect.objectContaining({ method: 'GET', credentials: 'same-origin', body: undefined }))
  })
  it('encodes explicit metadata search terms and preserves safe provider failures', async () => {
    const send = vi.fn<typeof fetch>(async () => json([]))
    const client = createHttpClient({ fetch: send })
    expect(await client.searchBookMetadata('Fictional & author')).toEqual([])
    expect(send.mock.calls[0][0]).toBe('/api/admin/book-metadata?query=Fictional+%26+author')
    expect(send.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'same-origin', body: undefined })
    const unavailable = createHttpClient({ fetch: async () => json({ code: 'service_unavailable', message: 'El servicio no está disponible. Inténtalo de nuevo.' }, 503) })
    await expect(unavailable.searchBookMetadata('Fictional')).rejects.toMatchObject({ status: 503, code: 'service_unavailable' })
  })
  it('lists/reads and creates/updates through contract multipart routes and CSRF', async () => {
    const input: BookInput = { title: 'Fictional', authors: [], status: 'propuesto', description: null, publicationDate: null, publisher: null, isbn: null, pageCount: null, readingStartDate: null, readingEndDate: null, plannedStartDate: null, plannedEndDate: null, datesApproximate: false, cover: { action: 'replace', file: new File(['fictional'], 'cover.png', { type: 'image/png' }) } }
    const book = { id: '7', originVote: null, coverUrl: '/api/media/covers/fictional', title: input.title }
    const send = vi.fn<typeof fetch>(async (url, init) => json(url === '/api/admin/books' && init?.method === 'GET' ? [book] : book, init?.method === 'POST' ? 201 : 200))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'c'.repeat(32)}` })
    expect(await client.listAdminBooks()).toEqual([book])
    expect(await client.getAdminBook('7')).toEqual(book)
    expect(await client.createBook(input)).toEqual(book)
    expect(await client.updateBook('7', { ...input, cover: { action: 'remove' } })).toEqual(book)
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/admin/books', '/api/admin/books/7', '/api/admin/books', '/api/admin/books/7'])
    for (const [, init] of send.mock.calls.slice(2)) {
      expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('c'.repeat(32))
      expect(new Headers(init?.headers).get('Content-Type')).toBeNull()
    }
    const created = send.mock.calls[2][1]?.body as FormData
    expect([...created.keys()]).toEqual(['metadata', 'cover'])
    expect(JSON.parse(await (created.get('metadata') as Blob).text())).toMatchObject({ title: 'Fictional', coverAction: 'replace' })
    const updated = send.mock.calls[3][1]!.body as FormData
    expect([...updated.keys()]).toEqual(['metadata'])
    await expect(client.getAdminBook('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(4)
  })
})

describe('HTTP admin calendar adapters', () => {
  it('uses the contract JSON/status/cancellation/preview/delete paths and CSRF', async () => {
    const input = { startsAt: '2026-01-15T19:30:00Z', bookId: null, weekId: null }
    const send = vi.fn<typeof fetch>(async (_url, init) => json({}, init?.method === 'POST' ? 201 : 200))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'c'.repeat(32)}` })
    await client.listAdminMeetings()
    await client.getAdminMeeting('7')
    await client.createMeeting(input)
    await client.updateMeeting('7', input)
    await client.setMeetingCancelled('7', true)
    await client.getDeletionPreview('meeting', '7')
    await client.deleteMeeting('7')
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/admin/meetings', '/api/admin/meetings/7', '/api/admin/meetings', '/api/admin/meetings/7', '/api/admin/meetings/7/cancelled', '/api/admin/deletion-preview/meeting/7', '/api/admin/meetings/7'])
    expect(send.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'PUT', 'GET', 'DELETE'])
    expect(JSON.parse(send.mock.calls[2][1]?.body as string)).toEqual(input)
    expect(JSON.parse(send.mock.calls[4][1]?.body as string)).toEqual({ cancelled: true })
    for (const index of [2, 3, 4, 6]) expect(new Headers(send.mock.calls[index][1]?.headers).get('X-CSRFToken')).toBe('c'.repeat(32))
    await expect(client.deleteMeeting('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(7)
  })
})

describe('HTTP reading plan adapters', () => {
  it('routes all admin record operations with exact bodies and CSRF', async () => {
    const send = vi.fn<typeof fetch>(async (_url, init) => json({}, init?.method === 'POST' ? 201 : 200))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'w'.repeat(32)}` })
    const summary = { text: '<script>literal</script>', published: false }
    const highlight = { text: 'Ficticio', published: true, kind: 'quote' as const, speakerIds: ['2'] }
    await client.getAdminMeetingRecord('8')
    await client.saveMeetingSummary('8', summary)
    await client.createMeetingHighlight('8', highlight)
    await client.reorderMeetingHighlights('8', ['3'])
    await client.updateMeetingHighlight('8', '3', highlight)
    await client.removeMeetingHighlight('8', '3')
    await client.setMeetingRecordSafe('8', true)
    const root = '/api/admin/meetings/8/record'
    expect(send.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [root, 'GET'], [root + '/summary', 'PUT'], [root + '/highlights', 'POST'],
      [root + '/highlights/order', 'PUT'], [root + '/highlights/3', 'PUT'],
      [root + '/highlights/3', 'DELETE'], [root + '/safe', 'PUT'],
    ])
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual(summary)
    expect(JSON.parse(send.mock.calls[2][1]?.body as string)).toEqual(highlight)
    expect(JSON.parse(send.mock.calls[3][1]?.body as string)).toEqual({ ids: ['3'] })
    expect(JSON.parse(send.mock.calls[6][1]?.body as string)).toEqual({ safe: true })
    for (const [, init] of send.mock.calls.slice(1)) expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('w'.repeat(32))
  })
  it('reads meeting detail and writes attendance through guarded central routes', async () => {
    const send = vi.fn<typeof fetch>(async () => json({}))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'w'.repeat(32)}` })
    await client.getMeeting('8')
    await client.setMeetingAttendance('8', ['2'])
    expect(send.mock.calls[0][0]).toBe('/api/meetings/8')
    expect(send.mock.calls[1][0]).toBe('/api/admin/meetings/8/attendance')
    expect(send.mock.calls[1][1]?.method).toBe('PUT')
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual({ memberIds: ['2'] })
    expect(new Headers(send.mock.calls[1][1]?.headers).get('X-CSRFToken')).toBe('w'.repeat(32))
  })
  it('loads the member calendar from the central meetings route', async () => {
    const meetings = { upcoming: [], past: [] }
    const send = vi.fn<typeof fetch>(async () => json(meetings))
    await expect(createHttpClient({ fetch: send }).listMeetings()).resolves.toEqual(meetings)
    expect(send.mock.calls[0][0]).toBe('/api/meetings')
    expect(send.mock.calls[0][1]?.method).toBe('GET')
  })
  it('loads the native current-book and reading target from the home route', async () => {
    const home = { currentBook: null, currentWeek: null, nextMeeting: null, memberProgress: [], recentActivity: [], quote: null, stats: { booksCompleted: 0, reviews: 0, members: 0 } }
    const send = vi.fn<typeof fetch>(async () => json(home))
    await expect(createHttpClient({ fetch: send }).getHome()).resolves.toEqual(home)
    expect(send.mock.calls[0][0]).toBe('/api/home')
    expect(send.mock.calls[0][1]?.method).toBe('GET')
  })
  it('reads personal completion and writes only the session-owned finished flag', async () => {
    const ratings = { book: { id: '8', title: 'Libro ficticio', authors: [], coverUrl: null }, ratable: true, finishedByMe: true, myReview: null, club: { status: 'locked' } }
    const send = vi.fn<typeof fetch>(async () => json(ratings))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'w'.repeat(32)}` })
    await expect(client.getBookRatings('8')).resolves.toEqual(ratings)
    await expect(client.setBookFinished('8', true)).resolves.toEqual(ratings)
    expect(send.mock.calls[0][0]).toBe('/api/books/8/ratings')
    expect(send.mock.calls[0][1]?.method).toBe('GET')
    expect(send.mock.calls[1][0]).toBe('/api/books/8/finished')
    expect(send.mock.calls[1][1]?.method).toBe('PUT')
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual({ finished: true })
    expect(new Headers(send.mock.calls[1][1]?.headers).get('X-CSRFToken')).toBe('w'.repeat(32))
  })
  it('changes only the session-owned week flag and accepts an empty 204', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'w'.repeat(32)}` })
    await expect(client.setWeekCompleted('8', true)).resolves.toBeUndefined()
    expect(send.mock.calls[0][0]).toBe('/api/weeks/8/completion')
    expect(send.mock.calls[0][1]?.method).toBe('PUT')
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual({ completed: true })
    expect(new Headers(send.mock.calls[0][1]?.headers).get('X-CSRFToken')).toBe('w'.repeat(32))
  })
  it('submits exact independent facts, acknowledgement and order using CSRF', async () => {
    const input = { percentStart: 101.5, percentEnd: 120, pageStart: 2, pageEnd: 80, dueDate: null, notes: 'manual', meetingId: '7' }
    const send = vi.fn<typeof fetch>(async (_url, init) => json({}, init?.method === 'POST' ? 201 : 200))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'r'.repeat(32)}` })
    await client.getAdminReadingPlan('4')
    await client.createReadingWeek('4', input, true)
    await client.updateReadingWeek('4', '8', input, false)
    await client.reorderReadingWeeks('4', ['8', '9'], true)
    await client.removeReadingWeek('4', '8')
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/admin/books/4/reading-plan', '/api/admin/books/4/reading-plan/weeks', '/api/admin/books/4/reading-plan/weeks/8', '/api/admin/books/4/reading-plan/weeks/order', '/api/admin/books/4/reading-plan/weeks/8'])
    expect(send.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'PUT', 'PUT', 'DELETE'])
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual({ input, acknowledged: true })
    expect(JSON.parse(send.mock.calls[2][1]?.body as string)).toEqual({ input, acknowledged: false })
    expect(JSON.parse(send.mock.calls[3][1]?.body as string)).toEqual({ ids: ['8', '9'], acknowledged: true })
    for (const index of [1, 2, 3, 4]) expect(new Headers(send.mock.calls[index][1]?.headers).get('X-CSRFToken')).toBe('r'.repeat(32))
    await expect(client.getAdminReadingPlan('../session')).rejects.toMatchObject({ status: 500 })
    expect(send).toHaveBeenCalledTimes(5)
  })
})

describe('HTTP vote shortlist adapters', () => {
  it('maps shortlist operations to their routes, bodies and CSRF header', async () => {
    const vote = { id: 'v1', status: 'draft', curator: { id: 'm1', displayName: 'Alba ficticia', avatarUrl: null }, openedAt: null, closedAt: null, candidates: [], outcome: null, canManage: true, canRecordTieWinner: false, curatedByMe: true }
    const overview = { curator: null, current: null, history: [], canCreateVote: false }
    const send = vi.fn<typeof fetch>(async (url, init) => (url === '/api/votes' && init?.method === 'GET' ? json(overview) : json(vote, init?.method === 'POST' && url === '/api/votes' ? 201 : 200)))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'d'.repeat(32)}` })
    await expect(client.getVotes()).resolves.toEqual(overview)
    await expect(client.createVote()).resolves.toEqual(vote)
    await expect(client.getVote('v1')).resolves.toEqual(vote)
    await client.addCandidate('v1', 'b1')
    await client.reorderCandidates('v1', ['b2', 'b1'])
    await client.removeCandidate('v1', 'b1')
    await client.openVote('v1')
    await client.setApproval('v1', 'b2', true)
    await client.closeVote('v1')
    await client.recordTieWinner('v1', 'b2', 'Acuerdo del club')
    expect(send.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'GET /api/votes', 'POST /api/votes', 'GET /api/votes/v1',
      'POST /api/votes/v1/candidates', 'PUT /api/votes/v1/candidates/order',
      'DELETE /api/votes/v1/candidates/b1', 'POST /api/votes/v1/open',
      'PUT /api/votes/v1/candidates/b2/approval',
      'POST /api/votes/v1/close', 'POST /api/votes/v1/tie-winner',
    ])
    expect(JSON.parse(send.mock.calls[7][1]?.body as string)).toEqual({ approved: true })
    expect(send.mock.calls[8][1]?.body).toBeUndefined()
    expect(JSON.parse(send.mock.calls[9][1]?.body as string)).toEqual({ bookId: 'b2', note: 'Acuerdo del club' })
    expect(JSON.parse(send.mock.calls[3][1]?.body as string)).toEqual({ bookId: 'b1' })
    expect(JSON.parse(send.mock.calls[4][1]?.body as string)).toEqual({ bookIds: ['b2', 'b1'] })
    expect(new Headers(send.mock.calls[0][1]?.headers).get('X-CSRFToken')).toBeNull()
    for (const call of send.mock.calls.slice(1).filter(([, init]) => init?.method !== 'GET')) {
      expect(new Headers(call[1]?.headers).get('X-CSRFToken')).toBe('d'.repeat(32))
    }
  })
})

describe('HTTP rubric adapters', () => {
  it('reads all anchors and saves the whole rubric with CSRF', async () => {
    const rubric = { disfrute: { 1: null, 2: null, 3: null, 4: null, 5: null }, estilo: { 1: null, 2: null, 3: null, 4: null, 5: null }, personajes: { 1: null, 2: null, 3: null, 4: null, 5: null }, trama: { 1: null, 2: null, 3: null, 4: null, 5: null }, huella: { 1: null, 2: null, 3: null, 4: null, 5: null } }
    const send = vi.fn<typeof fetch>(async () => json(rubric))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'a'.repeat(32)}` })
    await expect(client.getRatingRubric()).resolves.toEqual(rubric)
    await expect(client.saveRatingRubric(rubric)).resolves.toEqual(rubric)
    expect(send.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual(['GET /api/rating-rubric', 'PUT /api/admin/rating-rubric'])
    expect(JSON.parse(send.mock.calls[1][1]?.body as string)).toEqual(rubric)
    expect(new Headers(send.mock.calls[1][1]?.headers).get('X-CSRFToken')).toBe('a'.repeat(32))
  })
})

describe('HTTP own-review adapter', () => {
  it('sends only scores and optional text to the current-session review route', async () => {
    const ratings = { book: { id: 'b1', title: 'Libro ficticio', authors: [], coverUrl: null }, ratable: true, finishedByMe: true, myReview: null, club: { status: 'locked' } }
    const send = vi.fn<typeof fetch>(async () => json(ratings))
    const client = createHttpClient({ fetch: send, cookie: () => `csrftoken=${'b'.repeat(32)}` })
    const input = { scores: { disfrute: 5, estilo: 4.5, personajes: 3, trama: 4, huella: 2.5 }, text: 'Reseña ficticia' }
    await expect(client.saveMyReview('b1', input)).resolves.toEqual(ratings)
    expect(send.mock.calls[0][0]).toBe('/api/books/b1/my-review')
    expect(send.mock.calls[0][1]?.method).toBe('PUT')
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual(input)
    expect(new Headers(send.mock.calls[0][1]?.headers).get('X-CSRFToken')).toBe('b'.repeat(32))
  })
})
