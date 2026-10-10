import { describe, expect, it, vi } from 'vitest'
import { ApiError, SESSION_METHODS, type ApiClient } from '../client'
import type { BookRatings, CriterionScores, ReviewInput } from '../types'
import { withUnauthorizedHandler } from '../unauthorized'
import { applyRubricExample, createClubState, createEmptyState, type MockState } from './fixtures'
import { createMockClient } from './mockClient'

const scores = (disfrute: number, estilo: number, personajes: number, trama: number, huella: number): CriterionScores => ({
  disfrute,
  estilo,
  personajes,
  trama,
  huella,
})

const visible = (ratings: BookRatings) => {
  if (ratings.club.status !== 'visible') throw new Error('Expected visible club ratings.')
  return ratings.club
}

const statusOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof ApiError ? error.status : error),
  )

// Every review text and every member other than the signed-in one.
const otherNames = (state: MockState) => state.members.filter((m) => m.id !== state.currentUserId).map((m) => m.displayName)
const otherTexts = (state: MockState) =>
  state.reviews.filter((r) => r.userId !== state.currentUserId && r.text).map((r) => r.text!.slice(0, 30))

const GATED_KEYS = ['reviewCount', 'overallMean', 'criterionMeans', 'reviews']

describe('mock ratings: fixtures', () => {
  it('shows «Cumbres borrascosas» to the default admin with n = 4 and exact means', async () => {
    const ratings = await createMockClient().getBookRatings('b2')

    expect(ratings).toMatchObject({ ratable: true, finishedByMe: true, book: { id: 'b2', title: 'Cumbres borrascosas' } })
    expect(ratings.myReview).toEqual({
      scores: scores(5, 4.5, 3, 4, 2.5),
      overall: 3.8,
      text: 'Me atrapó desde el principio, aunque el final se me hizo largo.',
      submittedAt: '2024-12-02T21:10:00+01:00',
      editedAt: null,
    })
    const club = visible(ratings)
    expect(club.reviewCount).toBe(4)
    expect(club.overallMean).toBe(4.05)
    expect(club.criterionMeans).toEqual({ disfrute: 4, estilo: 4.25, personajes: 4.125, trama: 4, huella: 3.875 })
    // Own first, then by name; never by score.
    expect(club.reviews.map((r) => [r.member.displayName, r.overall, r.isMine])).toEqual([
      ['Lucía', 3.8, true],
      ['Carmen', 4.4, false],
      ['Inés', 4, false],
      ['Jordi', 4, false],
    ])
    expect(club.reviews[1].text).toContain('<b>insoportable</b>')
    expect(club.reviews[1].text).toContain('<script>')
    expect(club.reviews[1].text).toContain('\n')
    expect(club.reviews[2].text).toBeNull()
  })

  it('keeps «Cumbres borrascosas» locked for the default member, who has not finished it', async () => {
    const ratings = await createMockClient({ session: 'member' }).getBookRatings('b2')
    expect(ratings).toEqual({
      book: { id: 'b2', title: 'Cumbres borrascosas', authors: ['Emily Brontë'], coverUrl: null },
      ratable: true,
      finishedByMe: false,
      myReview: null,
      club: { status: 'locked' },
    })
  })

  it('shows «Niebla» locked but finished to the admin, and visible to the member', async () => {
    const admin = await createMockClient().getBookRatings('b1')
    expect(admin).toMatchObject({ ratable: true, finishedByMe: true, myReview: null, club: { status: 'locked' } })

    const member = await createMockClient({ session: 'member' }).getBookRatings('b1')
    expect(member).toMatchObject({ finishedByMe: true, myReview: { overall: 3.8 } })
    const club = visible(member)
    expect(club.reviewCount).toBe(3)
    expect(club.overallMean).toBeCloseTo(59 / 15, 12)
    expect(club.reviews.map((r) => r.member.displayName)).toEqual(['Mateo', 'Elena', 'Pablo'])
  })

  it('keeps «La Regenta» locked and unfinished for the admin although Carmen rated it', async () => {
    const state = createClubState()
    expect(state.reviews.some((r) => r.bookId === 'b3' && r.userId !== 'm1')).toBe(true)
    const ratings = await createMockClient({ state }).getBookRatings('b3')
    expect(ratings).toMatchObject({ ratable: true, finishedByMe: false, myReview: null, club: { status: 'locked' } })
  })

  it('has nobody finished or rated «Ángel Guerra»', async () => {
    const state = createClubState()
    expect(state.finished.b6 ?? []).toEqual([])
    expect(state.reviews.filter((r) => r.bookId === 'b6')).toEqual([])
    const ratings = await createMockClient({ state }).getBookRatings('b6')
    expect(ratings).toMatchObject({ ratable: true, finishedByMe: false, myReview: null, club: { status: 'locked' } })
  })

  it.each([
    ['b4', 'elegido'],
    ['b5', 'propuesto'],
  ])('does not let anyone rate %s (%s)', async (bookId) => {
    const ratings = await createMockClient().getBookRatings(bookId)
    expect(ratings).toMatchObject({ ratable: false, finishedByMe: false, myReview: null, club: { status: 'locked' } })
  })

  it('has a rubric with no descriptions at all', async () => {
    const rubric = await createMockClient().getRatingRubric()
    expect(Object.keys(rubric)).toEqual(['disfrute', 'estilo', 'personajes', 'trama', 'huella'])
    for (const anchors of Object.values(rubric)) expect(anchors).toEqual({ 1: null, 2: null, 3: null, 4: null, 5: null })
    expect(await createMockClient({ session: 'member' }).getRatingRubric()).toEqual(rubric)
  })

  it('fills only some anchors with obvious placeholders in the example rubric', async () => {
    const rubric = await createMockClient({ state: applyRubricExample(createClubState()) }).getRatingRubric()
    expect(rubric.trama[3]).toBe('[Texto de ejemplo] Trama, 3 estrellas')
    expect(rubric.trama[1]).toBeNull()
    expect(rubric.trama[5]).toBeNull()
    expect(rubric.personajes).toEqual({ 1: null, 2: null, 3: null, 4: null, 5: null })
    const texts = Object.values(rubric).flatMap((anchors) => Object.values(anchors).filter((t) => t !== null))
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) expect(text).toMatch(/^\[Texto de ejemplo\] /)
  })

  it('starts a new club with no books, finishes or reviews and an empty rubric', async () => {
    const state = createEmptyState()
    expect(state).toMatchObject({ books: [], finished: {}, reviews: [] })
    const rubric = await createMockClient({ state }).getRatingRubric()
    for (const anchors of Object.values(rubric)) expect(Object.values(anchors)).toEqual([null, null, null, null, null])
  })
})

describe('mock ratings: nothing leaks', () => {
  it.each([
    ['admin', 'b1'],
    ['admin', 'b3'],
    ['admin', 'b6'],
    ['admin', 'b4'],
    ['member', 'b2'],
    ['member', 'b3'],
  ] as const)('a locked result for the %s on %s has no aggregate keys, names or texts', async (session, bookId) => {
    const state = createClubState()
    const ratings = await createMockClient({ state, session }).getBookRatings(bookId)
    expect(ratings.club).toEqual({ status: 'locked' })
    const json = JSON.stringify(ratings)
    for (const key of GATED_KEYS) expect(json).not.toContain(`"${key}"`)
    for (const name of otherNames(state)) expect(json).not.toContain(name)
    for (const text of otherTexts(state)) expect(json).not.toContain(text)
  })

  it.each(['admin', 'member'] as const)('the other club calls carry no ratings for the %s', async (session) => {
    const state = createClubState()
    const api = createMockClient({ state, session })
    const books = await api.listBooks()
    const details = await Promise.all(books.map((b) => api.getBook(b.id)))
    const home = await api.getHome()
    // Inicio's club-wide review count (#44) is the only "reviews" key, and it is a number.
    expect(home.stats.reviews).toBe(12)
    const { reviews: _clubWideCount, ...stats } = home.stats
    const others = [{ ...home, stats }, await api.listMeetings(), await api.getVotes(), await api.getVote('v0')]
    const catalogue = JSON.stringify([books, details])
    expect(catalogue).not.toMatch(/rating|review|score|average|overall|mean|finished/i)
    const json = JSON.stringify([catalogue, others])
    for (const key of [...GATED_KEYS, 'scores', 'overall', 'myReview', 'finishedByMe', 'criterion']) {
      expect(json).not.toContain(`"${key}"`)
    }
    for (const text of state.reviews.flatMap((r) => (r.text ? [r.text.slice(0, 30)] : []))) {
      expect(json).not.toContain(text)
    }
  })
})

describe('mock ratings: rules', () => {
  const review: ReviewInput = { scores: scores(4, 4, 4, 4, 4), text: 'Una lectura muy agradable.' }

  const calls = (api: ApiClient, bookId = 'b6') =>
    [
      ['getBookRatings', () => api.getBookRatings(bookId)],
      ['getRatingRubric', () => api.getRatingRubric()],
      ['setBookFinished', () => api.setBookFinished(bookId, true)],
      ['saveMyReview', () => api.saveMyReview(bookId, review)],
    ] as const

  it.each(['anonymous', 'denied'] as const)('refuses all four calls with 401 while %s, before 404', async (session) => {
    const state = createClubState()
    const api = createMockClient({ state, session })
    const before = JSON.stringify(state)
    for (const bookId of ['b6', 'no-existe', 'b5']) {
      for (const [, call] of calls(api, bookId)) expect(await statusOf(call())).toBe(401)
    }
    expect(JSON.stringify(state)).toBe(before)
  })

  it('goes through the unauthorized handler, so a 401 leads to the sign-in screen', async () => {
    for (const method of ['getBookRatings', 'getRatingRubric', 'setBookFinished', 'saveMyReview'] as const) {
      expect(SESSION_METHODS).not.toContain(method)
    }
    const onUnauthorized = vi.fn()
    const api = withUnauthorizedHandler(createMockClient({ session: 'anonymous' }), onUnauthorized)
    for (const [, call] of calls(api)) await call().catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(4)
  })

  it('can fail each call, before any other check, without changing anything', async () => {
    const state = createClubState()
    const before = JSON.stringify(state)
    const api = createMockClient({
      state,
      failures: { getBookRatings: 1, getRatingRubric: 1, setBookFinished: 1, saveMyReview: 1 },
    })
    for (const [, call] of calls(api, 'no-existe')) expect(await statusOf(call())).toBe(500)
    expect(JSON.stringify(state)).toBe(before)
    await expect(api.getRatingRubric()).resolves.toHaveProperty('trama')
    await expect(api.setBookFinished('b6', true)).resolves.toMatchObject({ finishedByMe: true })
  })

  it('answers 404 for an unknown book, before 409 and 400', async () => {
    const api = createMockClient()
    expect(await statusOf(api.getBookRatings('no-existe'))).toBe(404)
    expect(await statusOf(api.setBookFinished('no-existe', true))).toBe(404)
    expect(await statusOf(api.saveMyReview('no-existe', { scores: scores(0, 0, 0, 0, 0), text: null }))).toBe(404)
  })

  it.each(['b4', 'b5'])('refuses to finish or rate a book that is not ratable (%s) with 409, before 400', async (bookId) => {
    const state = createClubState()
    state.finished[bookId] = ['m1']
    const before = JSON.stringify(state)
    const api = createMockClient({ state })
    expect(await statusOf(api.setBookFinished(bookId, true))).toBe(409)
    expect(await statusOf(api.saveMyReview(bookId, review))).toBe(409)
    expect(await statusOf(api.saveMyReview(bookId, { scores: scores(0, 0, 0, 0, 0), text: null }))).toBe(409)
    expect(JSON.stringify(state)).toBe(before)
  })

  it.each(['leyendo', 'terminado', 'archivado'] as const)('lets a %s book be finished and rated', async (status) => {
    const state = createClubState()
    state.books.find((b) => b.id === 'b6')!.status = status
    const api = createMockClient({ state })
    await api.setBookFinished('b6', true)
    await expect(api.saveMyReview('b6', review)).resolves.toMatchObject({ club: { status: 'visible' } })
  })

  it('refuses a review with 409 until the user has finished the book, before 400', async () => {
    const state = createClubState()
    const before = JSON.stringify(state)
    const api = createMockClient({ state })
    expect(await statusOf(api.saveMyReview('b3', review))).toBe(409)
    expect(await statusOf(api.saveMyReview('b3', { scores: scores(9, 9, 9, 9, 9), text: null }))).toBe(409)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('keeps a rated book finished: clearing the flag is refused with 409', async () => {
    const state = createClubState()
    const before = JSON.stringify(state)
    const api = createMockClient({ state })
    expect(await statusOf(api.setBookFinished('b2', false))).toBe(409)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('sets and clears the flag while the user has no review', async () => {
    const api = createMockClient()
    await expect(api.setBookFinished('b3', true)).resolves.toMatchObject({ finishedByMe: true, club: { status: 'locked' } })
    await expect(api.setBookFinished('b3', true)).resolves.toMatchObject({ finishedByMe: true })
    await expect(api.setBookFinished('b1', false)).resolves.toMatchObject({ finishedByMe: false, club: { status: 'locked' } })
    await expect(api.getBookRatings('b3')).resolves.toMatchObject({ finishedByMe: true })
  })

  it.each([
    ['a missing criterion', { disfrute: 4, estilo: 4, personajes: 4, trama: 4 }],
    ['zero', scores(0, 4, 4, 4, 4)],
    ['half a star', scores(4, 0.5, 4, 4, 4)],
    ['above 5', scores(4, 4, 5.5, 4, 4)],
    ['not a half step', scores(4, 4, 4, 3.3, 4)],
    ['NaN', scores(4, 4, 4, 4, Number.NaN)],
    ['a string', { ...scores(4, 4, 4, 4, 4), trama: '4' }],
  ])('refuses a score with %s (400) and changes nothing', async (_case, given) => {
    const state = createClubState()
    const before = JSON.stringify(state)
    const api = createMockClient({ state })
    expect(await statusOf(api.saveMyReview('b1', { scores: given as CriterionScores, text: null }))).toBe(400)
    expect(await statusOf(api.saveMyReview('b2', { scores: given as CriterionScores, text: null }))).toBe(400)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('accepts 5000 characters after trimming, refuses more with 400, and saves a blank text as null', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = JSON.stringify(state)
    expect(await statusOf(api.saveMyReview('b1', { ...review, text: 'a'.repeat(5001) }))).toBe(400)
    expect(JSON.stringify(state)).toBe(before)

    const long = await api.saveMyReview('b1', { ...review, text: `  ${'a'.repeat(5000)}\n ` })
    expect(long.myReview?.text).toBe('a'.repeat(5000))
    const blank = await api.saveMyReview('b1', { ...review, text: '  \n  ' })
    expect(blank.myReview?.text).toBeNull()
    const none = await api.saveMyReview('b1', { ...review, text: null })
    expect(none.myReview?.text).toBeNull()
  })

  it('creates the signed-in user’s review only, and unlocks the club’s ratings', async () => {
    const state = createClubState()
    const othersBefore = JSON.stringify(state.reviews.filter((r) => r.userId !== 'm1'))
    const api = createMockClient({ state })

    const saved = await api.saveMyReview('b1', { scores: scores(5, 4.5, 3, 4, 2.5), text: '  Muy buena.  ' })

    expect(saved.myReview).toEqual({
      scores: scores(5, 4.5, 3, 4, 2.5),
      overall: 3.8,
      text: 'Muy buena.',
      submittedAt: state.now,
      editedAt: null,
    })
    const club = visible(saved)
    expect(club.reviewCount).toBe(4)
    expect(club.reviews[0]).toMatchObject({ member: { id: 'm1' }, isMine: true, overall: 3.8 })
    expect(JSON.stringify(state.reviews.filter((r) => r.userId !== 'm1'))).toBe(othersBefore)
  })

  it('edits in place: keeps submittedAt, sets editedAt and updates the means, with the same n', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = await api.getBookRatings('b2')

    const edited = await api.saveMyReview('b2', { scores: scores(5, 5, 5, 5, 5), text: 'Ahora me gusta más.' })

    expect(edited.myReview).toMatchObject({
      overall: 5,
      text: 'Ahora me gusta más.',
      submittedAt: before.myReview!.submittedAt,
      editedAt: state.now,
    })
    const club = visible(edited)
    expect(club.reviewCount).toBe(4)
    expect(club.overallMean).toBe((25 + 22 + 20 + 20) / 20)
    expect(club.criterionMeans).toEqual({ disfrute: 4, estilo: 4.375, personajes: 4.625, trama: 4.25, huella: 4.5 })
    expect(state.reviews.filter((r) => r.bookId === 'b2' && r.userId === 'm1')).toHaveLength(1)
    // The other reviews are unchanged.
    expect(club.reviews.slice(1)).toEqual(visible(before).reviews.slice(1))
    expect(state.finished.b2).toEqual(['m1', 'm3', 'm5', 'm6', 'm7'])
  })

  it('rates «Ángel Guerra» from nothing to n = 1, with the club means equal to the user’s scores', async () => {
    const api = createMockClient()
    await api.setBookFinished('b6', true)
    const saved = await api.saveMyReview('b6', { scores: scores(4, 3.5, 5, 2, 4.5), text: null })
    const club = visible(saved)
    expect(club.reviewCount).toBe(1)
    expect(club.criterionMeans).toEqual(scores(4, 3.5, 5, 2, 4.5))
    expect(club.overallMean).toBe(3.8)
  })

  it('acts only for the signed-in member', async () => {
    const state = createClubState()
    const api = createMockClient({ state, session: 'member' })
    await api.setBookFinished('b3', true)
    await api.saveMyReview('b3', review)
    expect(state.finished.b3).toEqual(['m3', 'm2'])
    expect(state.reviews.filter((r) => r.bookId === 'b3').map((r) => r.userId)).toEqual(['m3', 'm2'])
  })

  it('gives the admin and a member the same answer in the same situation', async () => {
    const asAdmin = createClubState()
    const asMember = createClubState()
    // Give the member exactly the admin's flags on every book.
    for (const state of [asMember]) {
      for (const [bookId, ids] of Object.entries(state.finished)) {
        const admin = ids.includes('m1')
        state.finished[bookId] = [...ids.filter((id) => id !== 'm2' && id !== 'm1'), ...(admin ? ['m2'] : [])]
      }
      state.reviews = state.reviews
        .filter((r) => r.userId !== 'm2')
        .map((r) => (r.userId === 'm1' ? { ...r, userId: 'm2' } : r))
    }
    const admin = createMockClient({ state: asAdmin, session: 'admin' })
    const member = createMockClient({ state: asMember, session: 'member' })
    for (const bookId of ['b1', 'b2', 'b3', 'b6']) {
      const a = await admin.getBookRatings(bookId)
      const m = await member.getBookRatings(bookId)
      expect(m.club.status).toBe(a.club.status)
      expect(m.finishedByMe).toBe(a.finishedByMe)
      expect(m.myReview).toEqual(a.myReview)
    }
  })
})

describe('mock ratings: separate from weekly reading', () => {
  it('marking every week of a book read leaves it unfinished', async () => {
    const state = createClubState()
    const api = createMockClient({ state, session: 'member' })
    for (const week of state.weeks.filter((w) => w.bookId === 'b3')) await api.setWeekCompleted(week.id, true)
    await expect(api.getBookRatings('b3')).resolves.toMatchObject({ finishedByMe: false })
    expect(state.finished.b3).toEqual(['m3'])
  })

  it('setting or clearing the finished flag changes no weekly completion and nothing on Inicio', async () => {
    const state = createClubState()
    const api = createMockClient({ state, random: () => 0 })
    const completions = JSON.stringify(state.completions)
    const home = await api.getHome()

    await api.setBookFinished('b3', true)
    expect(JSON.stringify(state.completions)).toBe(completions)
    expect(await api.getHome()).toEqual(home)

    await api.setBookFinished('b3', false)
    expect(JSON.stringify(state.completions)).toBe(completions)
    expect(await api.getHome()).toEqual(home)
  })
})
