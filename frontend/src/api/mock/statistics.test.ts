import { describe, expect, it } from 'vitest'
import type { CriterionScores, RatingStatistics, Statistics } from '../types'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient, type MockOptions } from './mockClient'

const available = (ratings: RatingStatistics) => {
  if (ratings.status !== 'available') throw new Error('expected available statistics')
  return ratings
}
const getStatistics = (options: MockOptions = {}) => createMockClient(options).getStatistics()
const bookIds = (statistics: Statistics) => available(statistics.ratings).books.map((entry) => entry.book.id)
const entryOf = (statistics: Statistics, name: string) =>
  available(statistics.ratings).members.find((entry) => entry.member.displayName === name)
const flat = (value: number): CriterionScores => ({ disfrute: value, estilo: value, personajes: value, trama: value, huella: value })

// The exact figures in frontend/README.md «Fixture statistics».
describe('getStatistics with the default fixtures', () => {
  it('gives the default admin her figures and every highlight', async () => {
    const statistics = await getStatistics()
    expect(statistics.booksRead).toBe(6)
    expect(statistics.meetingsHeld).toBe(5)
    expect(statistics.thresholds).toEqual({ bookRatings: 3, memberRatings: 3 })

    const ratings = available(statistics.ratings)
    expect(ratings.bookCount).toBe(4)
    expect(ratings.reviewCount).toBe(13)
    expect(ratings.overallMean).toBeCloseTo(51.9 / 13, 9)
    expect(ratings.criterionMeans.disfrute).toBeCloseTo(52.5 / 13, 9)
    expect(ratings.criterionMeans.estilo).toBeCloseTo(53 / 13, 9)
    expect(ratings.criterionMeans.personajes).toBeCloseTo(52 / 13, 9)
    expect(ratings.criterionMeans.trama).toBeCloseTo(50 / 13, 9)
    expect(ratings.criterionMeans.huella).toBeCloseTo(52 / 13, 9)

    expect(ratings.books.map((e) => [e.book.id, e.reviewCount])).toEqual([
      ['b12', 4],
      ['b2', 4],
      ['b14', 2],
      ['b13', 3],
    ])
    const [b12, b2, b14, b13] = ratings.books
    expect(b12.overallMean).toBeCloseTo(4.525, 9)
    expect(b12.dispersion).toBeCloseTo(Math.sqrt(0.066875), 9)
    expect(b2.overallMean).toBeCloseTo(4.05, 9)
    expect(b2.dispersion).toBeCloseTo(0.21794494717703386, 9)
    expect(b14.overallMean).toBeCloseTo(4, 9)
    expect(b14.dispersion).toBeCloseTo(0.2, 9)
    expect(b13.overallMean).toBeCloseTo(3.2, 9)
    expect(b13.dispersion).toBeCloseTo(Math.sqrt(2.06 / 3), 9)

    expect(ratings.members.map((e) => [e.member.displayName, e.isMe, e.reviewCount])).toEqual([
      ['Lucía', true, 4],
      ['Carmen', false, 3],
      ['Elena', false, 1],
      ['Inés', false, 2],
      ['Jordi', false, 1],
      ['Mateo', false, 1],
      ['Pablo', false, 1],
    ])
    expect(ratings.members.map((e) => e.overallMean)).toEqual(
      [3.775, 13.3 / 3, 4.6, 3.5, 4, 3.8, 4.1].map((value) => expect.closeTo(value, 9)),
    )

    const { highlights } = ratings
    expect(highlights.topRated.map((e) => e.book.id)).toEqual(['b12'])
    expect(highlights.lowestRated.map((e) => e.book.id)).toEqual(['b13'])
    expect(highlights.mostDivisive.map((e) => e.book.id)).toEqual(['b13'])
    expect(highlights.mostGenerous.map((e) => e.member.displayName)).toEqual(['Carmen'])
    expect(highlights.harshest.map((e) => e.member.displayName)).toEqual(['Lucía'])
  })

  it('gives the default member his own books and no book highlights', async () => {
    const statistics = await getStatistics({ session: 'member' })
    const ratings = available(statistics.ratings)
    expect(statistics.booksRead).toBe(6)
    expect(statistics.meetingsHeld).toBe(5)
    expect(ratings.bookCount).toBe(2)
    expect(ratings.reviewCount).toBe(5)
    expect(ratings.overallMean).toBeCloseTo(3.96, 9)
    expect(ratings.criterionMeans).toEqual({
      disfrute: expect.closeTo(4.2, 9),
      estilo: expect.closeTo(4.2, 9),
      personajes: expect.closeTo(3.9, 9),
      trama: expect.closeTo(3.2, 9),
      huella: expect.closeTo(4.3, 9),
    })
    expect(ratings.books.map((e) => [e.book.id, e.reviewCount])).toEqual([
      ['b14', 2],
      ['b1', 3],
    ])
    expect(ratings.books[1].overallMean).toBeCloseTo(11.8 / 3, 9)
    expect(ratings.books[1].dispersion).toBeCloseTo(0.579271573232759, 9)
    expect(ratings.members.map((e) => [e.member.displayName, e.isMe, e.reviewCount, e.overallMean])).toEqual([
      ['Mateo', true, 2, expect.closeTo(3.8, 9)],
      ['Elena', false, 1, expect.closeTo(3.3, 9)],
      ['Lucía', false, 1, expect.closeTo(4.2, 9)],
      ['Pablo', false, 1, expect.closeTo(4.7, 9)],
    ])
    expect(ratings.highlights).toEqual({ topRated: [], lowestRated: [], mostDivisive: [], mostGenerous: [], harshest: [] })
  })

  it('gives the curator only «Cumbres borrascosas»', async () => {
    const ratings = available((await getStatistics({ session: 'curator' })).ratings)
    expect(ratings.bookCount).toBe(1)
    expect(ratings.reviewCount).toBe(4)
    expect(ratings.overallMean).toBeCloseTo(4.05, 9)
    expect(ratings.books.map((e) => e.book.id)).toEqual(['b2'])
    expect(ratings.members.map((e) => [e.member.displayName, e.isMe])).toEqual([
      ['Jordi', true],
      ['Carmen', false],
      ['Inés', false],
      ['Lucía', false],
    ])
    expect(ratings.highlights).toEqual({ topRated: [], lowestRated: [], mostDivisive: [], mostGenerous: [], harshest: [] })
  })

  it('gives a new club the counts and an empty `ratings` with no other key', async () => {
    const statistics = await getStatistics({ state: createEmptyState() })
    expect(statistics).toEqual({
      booksRead: 0,
      meetingsHeld: 0,
      thresholds: { bookRatings: 3, memberRatings: 3 },
      ratings: { status: 'empty' },
    })
  })
})

describe('getStatistics spoiler gating', () => {
  it.each(['admin', 'member', 'curator'] as const)('leaves «La Regenta» (Carmen’s review) out for %s', async (session) => {
    const statistics = await getStatistics({ session })
    const json = JSON.stringify(statistics)
    expect(json).not.toContain('"b3"')
    expect(json).not.toContain('La Regenta')
    expect(json).not.toContain('Clarín')
    // Its figures would be one review with an overall of 4,4 and no spread.
    const books = available(statistics.ratings).books
    expect(books.some((e) => e.reviewCount === 1 && Math.abs(e.overallMean - 4.4) < 1e-9 && e.dispersion === 0)).toBe(false)
  })

  it('counts none of Carmen’s «La Regenta» rating in her entry for the admin', async () => {
    const carmen = entryOf(await getStatistics(), 'Carmen')!
    expect(carmen.reviewCount).toBe(3)
    // «Cumbres borrascosas», «Fortunata y Jacinta» and «El sí de las niñas» only.
    expect(carmen.overallMean).toBeCloseTo((4.4 + 4.6 + 4.3) / 3, 9)
  })

  it('leaves «Niebla» out for the admin, who has finished it but not rated it', async () => {
    const statistics = await getStatistics()
    const json = JSON.stringify(statistics)
    expect(json).not.toContain('"b1"')
    expect(json).not.toContain('Niebla')
    expect(json).not.toContain('Unamuno')
    expect(json).not.toContain('3.9333')
    expect(json).not.toContain('0.5792')
    // Pablo and Elena rated it; only their «Fortunata y Jacinta» counts.
    expect(entryOf(statistics, 'Pablo')).toMatchObject({ reviewCount: 1, overallMean: expect.closeTo(4.1, 9) })
    expect(entryOf(statistics, 'Elena')).toMatchObject({ reviewCount: 1, overallMean: expect.closeTo(4.6, 9) })
  })

  it('leaves out books the member has not finished, even with many ratings', async () => {
    const statistics = await getStatistics({ session: 'member' })
    expect(bookIds(statistics)).toEqual(['b14', 'b1'])
    const json = JSON.stringify(statistics)
    for (const text of ['"b2"', '"b12"', '"b13"', 'Cumbres', 'Fortunata', 'El sí de las niñas', 'Carmen', 'Inés']) {
      expect(json).not.toContain(text)
    }
  })

  it('never counts a finished flag without a review, or an absent review', async () => {
    // Jordi has finished «Fortunata y Jacinta» but not rated it.
    const jordi = await getStatistics({ session: 'curator' })
    expect(bookIds(jordi)).toEqual(['b2'])
    // For the admin, Jordi is listed only with his «Cumbres borrascosas» rating.
    expect(entryOf(await getStatistics(), 'Jordi')).toMatchObject({ reviewCount: 1, overallMean: 4 })
    // A member with no counted rating is not listed, never shown as 0.
    const state = createClubState()
    state.reviews = state.reviews.filter((r) => r.userId !== 'm7' || r.bookId !== 'b12')
    expect(entryOf(await getStatistics({ state }), 'Elena')).toBeUndefined()
  })

  it('changes when the admin unlocks «Niebla» and edits a rating, without reloading the mock', async () => {
    const api = createMockClient()
    const before = await api.getStatistics()
    expect(bookIds(before)).not.toContain('b1')

    await api.saveMyReview('b1', { scores: flat(4), text: null })
    const after = await api.getStatistics()
    const ratings = available(after.ratings)
    expect(ratings.books.map((e) => [e.book.id, e.reviewCount])).toEqual([
      ['b12', 4],
      ['b2', 4],
      ['b14', 2],
      ['b1', 4],
      ['b13', 3],
    ])
    const niebla = ratings.books[3]
    expect(niebla.overallMean).toBeCloseTo(15.8 / 4, 9)
    expect(niebla.dispersion).toBeCloseTo(Math.sqrt(1.01 / 4), 9)
    expect(ratings.bookCount).toBe(5)
    expect(ratings.reviewCount).toBe(17)
    expect(ratings.overallMean).toBeCloseTo(67.7 / 17, 9)
    expect(ratings.criterionMeans).toEqual({
      disfrute: expect.closeTo(69 / 17, 9),
      estilo: expect.closeTo(70.5 / 17, 9),
      personajes: expect.closeTo(67 / 17, 9),
      trama: expect.closeTo(63.5 / 17, 9),
      huella: expect.closeTo(68.5 / 17, 9),
    })
    expect(ratings.members[0]).toMatchObject({ isMe: true, reviewCount: 5, overallMean: expect.closeTo(3.82, 9) })
    expect(entryOf(after, 'Pablo')).toMatchObject({ reviewCount: 2, overallMean: expect.closeTo(4.4, 9) })

    // Editing her «Cumbres borrascosas» rating (3,8) to all fives.
    await api.saveMyReview('b2', { scores: flat(5), text: null })
    const edited = available((await api.getStatistics()).ratings)
    const b2 = edited.books.find((e) => e.book.id === 'b2')!
    expect(b2.reviewCount).toBe(4)
    expect(b2.overallMean).toBeCloseTo(17.4 / 4, 9)
    expect(edited.reviewCount).toBe(17)
  })

  it('gives the same answer for the same user whether their role is admin or member', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const asAdmin = await api.getStatistics()
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    const asMember = await api.getStatistics()
    expect(asMember).toEqual(asAdmin)

    // And the default member promoted to admin sees only his own books.
    const other = createClubState()
    other.members.find((m) => m.id === 'm2')!.role = 'admin'
    other.members.find((m) => m.id === 'm1')!.role = 'member'
    expect(await getStatistics({ state: other, session: 'admin' })).toEqual(await getStatistics({ session: 'member' }))
  })
})

describe('getStatistics response shape', () => {
  const keys = (value: object) => Object.keys(value).sort()

  it('has exactly the documented keys, and no locked, hidden or club-total field', async () => {
    const statistics = await getStatistics()
    expect(keys(statistics)).toEqual(['booksRead', 'meetingsHeld', 'ratings', 'thresholds'])
    expect(keys(statistics.thresholds)).toEqual(['bookRatings', 'memberRatings'])
    const ratings = available(statistics.ratings)
    expect(keys(ratings)).toEqual([
      'bookCount',
      'books',
      'criterionMeans',
      'highlights',
      'members',
      'overallMean',
      'reviewCount',
      'status',
    ])
    expect(keys(ratings.criterionMeans)).toEqual(['disfrute', 'estilo', 'huella', 'personajes', 'trama'])
    expect(keys(ratings.highlights)).toEqual(['harshest', 'lowestRated', 'mostDivisive', 'mostGenerous', 'topRated'])
    const highlighted = [...ratings.highlights.topRated, ...ratings.highlights.lowestRated, ...ratings.highlights.mostDivisive]
    for (const entry of [...ratings.books, ...highlighted]) {
      expect(keys(entry)).toEqual(['book', 'dispersion', 'overallMean', 'reviewCount'])
      expect(keys(entry.book)).toEqual(['authors', 'coverUrl', 'id', 'title'])
    }
    for (const entry of [...ratings.members, ...ratings.highlights.mostGenerous, ...ratings.highlights.harshest]) {
      expect(keys(entry)).toEqual(['isMe', 'member', 'overallMean', 'reviewCount'])
      expect(keys(entry.member)).toEqual(['avatarUrl', 'displayName', 'id'])
    }
    expect(JSON.stringify(statistics)).not.toMatch(/locked|hidden|total|club/i)
  })

  it('has only `status` in the empty variant, also when others have rated but the viewer has unlocked nothing', async () => {
    const state = createClubState()
    // Lucía (m1) has finished several books but rated none.
    state.reviews = state.reviews.filter((r) => r.userId !== 'm1')
    const statistics = await getStatistics({ state })
    expect(statistics.ratings).toEqual({ status: 'empty' })
    expect(keys(statistics.ratings)).toEqual(['status'])
    expect(keys(statistics)).toEqual(['booksRead', 'meetingsHeld', 'ratings', 'thresholds'])
  })

  it('counts the read books and the meetings held by the server’s clock', async () => {
    const state = createClubState()
    state.books.find((b) => b.id === 'b3')!.status = 'terminado'
    // mt3 starts on 15 October; moving the clock past it makes it held.
    state.now = '2026-10-16T12:00:00+02:00'
    const statistics = await getStatistics({ state })
    expect(statistics.booksRead).toBe(7)
    expect(statistics.meetingsHeld).toBe(6)
  })
})

describe('getStatistics errors', () => {
  it('gives 401 when nobody is signed in', async () => {
    await expect(getStatistics({ session: 'anonymous' })).rejects.toMatchObject({ status: 401 })
    await expect(getStatistics({ session: 'denied' })).rejects.toMatchObject({ status: 401 })
  })

  it('supports the failures option', async () => {
    const api = createMockClient({ failures: { getStatistics: 1 } })
    await expect(api.getStatistics()).rejects.toMatchObject({ status: 500 })
    await expect(api.getStatistics()).resolves.toMatchObject({ booksRead: 6 })
  })
})
