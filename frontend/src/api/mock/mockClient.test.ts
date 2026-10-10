import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient } from './mockClient'

describe('mock API client', () => {
  it('picks the reading week linked to the next meeting', async () => {
    const home = await createMockClient().getHome()

    expect(home.currentBook?.title).toBe('La Regenta')
    expect(home.currentWeek).toMatchObject({ weekNumber: 3, percentStart: 25, percentEnd: 40, pageStart: 205, pageEnd: 330 })
    expect(home.nextMeeting?.assignment).toEqual({
      weekNumber: 3,
      percentStart: 25,
      percentEnd: 40,
      pageStart: 205,
      pageEnd: 330,
    })
  })

  it('marking a week read changes only the signed-in member', async () => {
    const state = createClubState()
    const api = createMockClient({ state })

    await api.setWeekCompleted('w3', true)
    const home = await api.getHome()

    expect(home.currentWeek?.completedByMe).toBe(true)
    expect(state.completions.w3.sort()).toEqual(['m1', 'm3', 'm6'])

    await api.setWeekCompleted('w3', false)
    expect(state.completions.w3.sort()).toEqual(['m3', 'm6'])
  })

  it('rejects an unknown week', async () => {
    await expect(createMockClient().setWeekCompleted('nope', true)).rejects.toBeInstanceOf(ApiError)
  })

  it('returns empty sections for a new club', async () => {
    const home = await createMockClient({ state: createEmptyState() }).getHome()

    expect(home).toMatchObject({
      currentBook: null,
      currentWeek: null,
      nextMeeting: null,
      memberProgress: [],
      recentActivity: [],
      quote: null,
    })
  })

  it('can be configured to fail a call a number of times', async () => {
    const api = createMockClient({ failures: { getHome: 1, setWeekCompleted: Infinity } })

    await expect(api.getHome()).rejects.toMatchObject({ status: 500 })
    await expect(api.getHome()).resolves.toMatchObject({ currentBook: { title: 'La Regenta' } })
    await expect(api.setWeekCompleted('w3', true)).rejects.toBeInstanceOf(ApiError)
    await expect(api.setWeekCompleted('w3', true)).rejects.toBeInstanceOf(ApiError)
    await expect(api.getSession()).resolves.toMatchObject({ user: { id: 'm1' } })
  })

  it('chooses the quote with the injected random source', async () => {
    const home = await createMockClient({ random: () => 0.99 }).getHome()
    expect(home.quote?.source).toBe('Francisco de Quevedo')
  })
})

describe('mock library', () => {
  it('lists every book with catalogue fields only', async () => {
    const books = await createMockClient().listBooks()

    expect(books.map((b) => b.status).sort()).toEqual([
      'archivado',
      'archivado',
      'archivado',
      'archivado',
      'elegido',
      'leyendo',
      'propuesto',
      'propuesto',
      'propuesto',
      'propuesto',
      'propuesto',
      'propuesto',
      'terminado',
      'terminado',
    ])
    expect(books.find((b) => b.id === 'b2')).toEqual({
      id: 'b2',
      title: 'Cumbres borrascosas',
      authors: ['Emily Brontë'],
      coverUrl: null,
      status: 'terminado',
      readingStartDate: '2024-10-01',
      readingEndDate: '2024-11-30',
      datesApproximate: true,
    })
  })

  it('serves fixture covers locally', async () => {
    const covers = (await createMockClient().listBooks()).map((b) => b.coverUrl).filter((url) => url !== null)
    expect(covers.length).toBeGreaterThan(0)
    for (const url of covers) expect(url).toMatch(/^\/[^/]/)
  })

  it('returns a book with its plan in week order and its meetings oldest first', async () => {
    const book = await createMockClient().getBook('b3')

    expect(book).toMatchObject({ title: 'La Regenta', publicationDate: '1884–1885', pageCount: 864 })
    expect(book.schedule.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5])
    expect(book.schedule[0].meeting).toEqual({ id: 'mt1', startsAt: '2026-09-24T19:30:00+02:00' })
    expect(book.schedule[4]).toMatchObject({ meeting: null, dueDate: '2026-10-29' })
    expect(book.meetings.map((m) => [m.id, m.cancelled, m.weekNumber])).toEqual([
      ['mt0', true, null],
      ['mt1', false, 1],
      ['mt2', false, 2],
      ['mt3', false, 3],
      ['mt4', false, 4],
    ])
    expect(book.originVote).toEqual({ id: 'v1', label: 'Votación de Carmen (septiembre de 2026)' })
  })

  it('never sends ratings, reviews or meeting summaries', async () => {
    const api = createMockClient()
    const payload = JSON.stringify([await api.listBooks(), await api.getBook('b3'), await api.getBook('b1')])
    expect(payload).not.toMatch(/rating|review|score|average|summary|highlight/i)
  })

  it('rejects an unknown book with a 404', async () => {
    const error = await createMockClient().getBook('no-existe').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })

  it('has no books for a new club', async () => {
    await expect(createMockClient({ state: createEmptyState() }).listBooks()).resolves.toEqual([])
  })

  it('can fail the library calls', async () => {
    const api = createMockClient({ failures: { listBooks: 1, getBook: 1 } })

    await expect(api.listBooks()).rejects.toMatchObject({ status: 500 })
    await expect(api.listBooks()).resolves.toHaveLength(14)
    await expect(api.getBook('b3')).rejects.toMatchObject({ status: 500 })
    await expect(api.getBook('b3')).resolves.toMatchObject({ id: 'b3' })
  })
})

describe('mock session', () => {
  it('is signed in as the fixture admin by default', async () => {
    await expect(createMockClient().getSession()).resolves.toEqual({
      status: 'signedIn',
      user: { id: 'm1', displayName: 'Lucía', role: 'admin', avatarUrl: null },
    })
  })

  it('can start as a member, an admin, anonymous or denied', async () => {
    await expect(createMockClient({ session: 'member' }).getSession()).resolves.toMatchObject({
      status: 'signedIn',
      user: { role: 'member' },
    })
    await expect(createMockClient({ session: 'admin' }).getSession()).resolves.toMatchObject({
      status: 'signedIn',
      user: { role: 'admin' },
    })
    await expect(createMockClient({ session: 'anonymous' }).getSession()).resolves.toEqual({
      status: 'anonymous',
      demoSignInAvailable: false,
    })
    await expect(createMockClient({ session: 'denied' }).getSession()).resolves.toEqual({
      status: 'denied',
      demoSignInAvailable: false,
    })
  })

  it('says when the demo sign-in is offered', async () => {
    const api = createMockClient({ session: 'anonymous', demoSignInAvailable: true })
    await expect(api.getSession()).resolves.toEqual({ status: 'anonymous', demoSignInAvailable: true })
  })

  it('signs in as a member by default, or to the configured result', async () => {
    const api = createMockClient({ session: 'anonymous' })
    await api.startSignIn()
    await expect(api.getSession()).resolves.toMatchObject({ status: 'signedIn', user: { role: 'member' } })

    const refused = createMockClient({ session: 'anonymous', signInResult: 'denied' })
    await refused.startSignIn()
    await expect(refused.getSession()).resolves.toMatchObject({ status: 'denied' })
  })

  it('offers the demo sign-in only when it is available', async () => {
    await expect(createMockClient({ session: 'anonymous' }).startDemoSignIn()).rejects.toMatchObject({ status: 404 })

    const api = createMockClient({ session: 'anonymous', demoSignInAvailable: true })
    await api.startDemoSignIn()
    await expect(api.getSession()).resolves.toMatchObject({ status: 'signedIn', user: { role: 'member' } })
  })

  it('signs out to an anonymous session', async () => {
    const api = createMockClient()
    await api.signOut()
    await expect(api.getSession()).resolves.toMatchObject({ status: 'anonymous' })
  })

  it('can fail the session calls', async () => {
    const api = createMockClient({ session: 'anonymous', failures: { getSession: 1, startSignIn: 1, signOut: 1 } })

    await expect(api.getSession()).rejects.toMatchObject({ status: 500 })
    await expect(api.startSignIn()).rejects.toMatchObject({ status: 500 })
    await expect(api.getSession()).resolves.toMatchObject({ status: 'anonymous' })
    await api.startSignIn()
    await expect(api.signOut()).rejects.toMatchObject({ status: 500 })
    await expect(api.getSession()).resolves.toMatchObject({ status: 'signedIn' })
  })

  describe.each(['anonymous', 'denied'] as const)('while the session is %s', (session) => {
    it('refuses getHome with a 401 and no data', async () => {
      const api = createMockClient({ session })
      const error = await api.getHome().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 401 })
    })

    it('refuses the library calls with a 401 and no data', async () => {
      const api = createMockClient({ session })
      await expect(api.listBooks()).rejects.toMatchObject({ status: 401 })
      // 401 comes before 404: an anonymous visitor cannot probe which books exist.
      await expect(api.getBook('b3')).rejects.toMatchObject({ status: 401 })
      await expect(api.getBook('no-existe')).rejects.toMatchObject({ status: 401 })
    })

    it('refuses setWeekCompleted with a 401 and changes nothing', async () => {
      const state = createClubState()
      const api = createMockClient({ state, session })
      await expect(api.setWeekCompleted('w3', true)).rejects.toMatchObject({ status: 401 })
      expect(state.completions.w3).toEqual(['m3', 'm6'])
    })
  })
})
