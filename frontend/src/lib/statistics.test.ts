import { describe, expect, it } from 'vitest'
import type { BookSummary, CriterionScores, MemberSummary, RatingStatistics } from '../api/types'
import { type CountedReview, populationStandardDeviation, ratingStatistics, STATISTICS_THRESHOLDS } from './statistics'

// Fictional books and members for the maths; only ids and names matter.
const book = (id: string, title: string): BookSummary => ({ id, title, authors: ['Autora Ficticia'], coverUrl: null })
const member = (id: string, displayName: string): MemberSummary => ({ id, displayName, avatarUrl: null })

const scores = ([disfrute, estilo, personajes, trama, huella]: number[]): CriterionScores => ({
  disfrute,
  estilo,
  personajes,
  trama,
  huella,
})
// Five equal scores, so the review's overall is `value`.
const flat = (value: number) => scores([value, value, value, value, value])
const review = (bookId: string, memberId: string, s: CriterionScores): CountedReview => ({ bookId, memberId, scores: s })

const BOOKS = [
  book('x1', 'Ángeles de papel'),
  book('x2', 'Barro y ceniza'),
  book('x3', 'Cartas al mar'),
  book('x4', 'Duna'),
  book('x5', 'El último faro'),
]
const MEMBERS = [
  member('a', 'Ana'),
  member('b', 'Bruno'),
  member('c', 'Clara'),
  member('d', 'Dario'),
  member('e', 'Élida'),
]

function stats(reviews: CountedReview[], viewerId = 'a') {
  return ratingStatistics({ reviews, books: BOOKS, members: MEMBERS, viewerId, thresholds: STATISTICS_THRESHOLDS })
}

function available(result: RatingStatistics) {
  if (result.status !== 'available') throw new Error('expected available statistics')
  return result
}

const ids = (entries: { book: BookSummary }[]) => entries.map((entry) => entry.book.id)
const names = (entries: { member: MemberSummary }[]) => entries.map((entry) => entry.member.displayName)

describe('ratingStatistics: book figures', () => {
  it('gives the «Cumbres borrascosas» fixture mean 4.05 and population deviation √0.0475', () => {
    // Overalls 3,8 / 4,4 / 4,0 / 4,0.
    const result = available(
      stats([
        review('x1', 'a', scores([5, 4.5, 3, 4, 2.5])),
        review('x1', 'b', scores([4, 5, 4.5, 3.5, 5])),
        review('x1', 'c', scores([3, 3.5, 5, 4, 4.5])),
        review('x1', 'd', scores([4, 4, 4, 4.5, 3.5])),
      ]),
    )
    const [entry] = result.books
    expect(entry.reviewCount).toBe(4)
    expect(entry.overallMean).toBeCloseTo(4.05, 9)
    expect(entry.dispersion).toBeCloseTo(Math.sqrt(0.0475), 9)
    expect(entry.dispersion).toBeCloseTo(0.21794494717703386, 9)
  })

  it('gives the «Niebla» fixture mean 3.9333… and population deviation √(1.00666…/3)', () => {
    // Overalls 3,8 / 4,7 / 3,3.
    const result = available(
      stats([
        review('x2', 'a', scores([4, 4.5, 3.5, 3, 4])),
        review('x2', 'b', scores([5, 5, 4.5, 4, 5])),
        review('x2', 'c', scores([3.5, 4, 3, 2.5, 3.5])),
      ]),
    )
    const [entry] = result.books
    expect(entry.overallMean).toBeCloseTo(11.8 / 3, 9)
    expect(entry.dispersion).toBeCloseTo(Math.sqrt(1.00666666666666667 / 3), 9)
    expect(entry.dispersion).toBeCloseTo(0.579271573232759, 9)
  })

  it('gives a book with one rating a deviation of 0, lists it, and puts it in no highlight', () => {
    const result = available(
      stats([
        review('x1', 'a', flat(5)),
        review('x2', 'a', flat(4)),
        review('x2', 'b', flat(3)),
        review('x2', 'c', flat(2)),
        review('x3', 'a', flat(1)),
        review('x3', 'b', flat(2)),
        review('x3', 'c', flat(4)),
      ]),
    )
    const single = result.books.find((entry) => entry.book.id === 'x1')!
    expect(single).toMatchObject({ reviewCount: 1, overallMean: 5, dispersion: 0 })
    const { highlights } = result
    for (const list of [highlights.topRated, highlights.lowestRated, highlights.mostDivisive]) {
      expect(ids(list)).not.toContain('x1')
    }
    // 5 is the highest mean, but only x2 and x3 qualify.
    expect(ids(highlights.topRated)).toEqual(['x2'])
  })

  it('orders the books by mean, highest first, and equal means by title', () => {
    const result = available(
      stats([
        review('x4', 'a', flat(3)),
        review('x2', 'a', flat(4.5)),
        review('x5', 'a', flat(4.5)),
        review('x1', 'a', flat(4.5)),
        review('x3', 'a', flat(2)),
      ]),
    )
    expect(ids(result.books)).toEqual(['x1', 'x2', 'x5', 'x4', 'x3'])
  })

  it('computes the population deviation exactly', () => {
    expect(populationStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9], 5)).toBe(2)
    expect(populationStandardDeviation([3], 3)).toBe(0)
  })
})

describe('ratingStatistics: club and member figures', () => {
  it('weights every rating equally across books, and a member mean is the mean of their overalls', () => {
    const result = available(
      stats([
        // x1: overalls 4 and 2 (mean 3). x2: one overall of 5.
        review('x1', 'a', scores([5, 4, 4, 3, 4])),
        review('x1', 'b', scores([2, 2, 2, 2, 2])),
        review('x2', 'a', scores([5, 5, 5, 5, 5])),
      ]),
    )
    expect(result.bookCount).toBe(2)
    expect(result.reviewCount).toBe(3)
    // (4 + 2 + 5) / 3, not the mean of the book means (3 + 5) / 2.
    expect(result.overallMean).toBeCloseTo(11 / 3, 9)
    expect(result.criterionMeans.disfrute).toBeCloseTo(4, 9)
    expect(result.criterionMeans.estilo).toBeCloseTo(11 / 3, 9)
    expect(result.criterionMeans.personajes).toBeCloseTo(11 / 3, 9)
    expect(result.criterionMeans.trama).toBeCloseTo(10 / 3, 9)
    expect(result.criterionMeans.huella).toBeCloseTo(11 / 3, 9)
    expect(Object.keys(result.criterionMeans)).toEqual(['disfrute', 'estilo', 'personajes', 'trama', 'huella'])

    const ana = result.members.find((entry) => entry.member.id === 'a')!
    expect(ana).toMatchObject({ isMe: true, reviewCount: 2 })
    expect(ana.overallMean).toBeCloseTo(4.5, 9)
    expect(result.members.find((entry) => entry.member.id === 'b')).toMatchObject({ isMe: false, reviewCount: 1, overallMean: 2 })
  })

  it('lists the viewer first, then the others by name with Spanish collation, never by score', () => {
    const result = available(
      stats(
        [review('x1', 'e', flat(5)), review('x1', 'a', flat(1)), review('x1', 'd', flat(3)), review('x1', 'b', flat(4))],
        'd',
      ),
    )
    // «Élida» sorts with the E's, after «Bruno»; Clara has no rating and is not listed.
    expect(names(result.members)).toEqual(['Dario', 'Ana', 'Bruno', 'Élida'])
    expect(result.members.map((entry) => entry.isMe)).toEqual([true, false, false, false])
  })

  it('ignores reviews of books or members it was not given', () => {
    const result = available(
      ratingStatistics({
        reviews: [review('x1', 'a', flat(4)), review('zz', 'a', flat(1)), review('x1', 'zz', flat(1))],
        books: BOOKS,
        members: MEMBERS,
        viewerId: 'a',
        thresholds: STATISTICS_THRESHOLDS,
      }),
    )
    expect(result.reviewCount).toBe(1)
    expect(result.overallMean).toBe(4)
  })

  it('returns only `status` when there are no reviews at all', () => {
    expect(stats([])).toEqual({ status: 'empty' })
    expect(Object.keys(stats([]))).toEqual(['status'])
  })

  it('never rounds the values', () => {
    const result = available(stats([review('x1', 'a', scores([4, 4, 4, 4, 4.5])), review('x1', 'b', flat(4))]))
    expect(result.books[0].overallMean).toBeCloseTo(4.05, 9)
    expect(result.overallMean).toBeCloseTo(4.05, 9)
    expect(result.criterionMeans.huella).toBe(4.25)
  })
})

// Three ratings for each of the given books, all with the same overall.
const threeEach = (values: Record<string, number>) =>
  Object.entries(values).flatMap(([bookId, value]) => ['a', 'b', 'c'].map((m) => review(bookId, m, flat(value))))

describe('ratingStatistics: book highlights', () => {
  it('needs 3 ratings: a book with 2 is never in a highlight, one with 3 can be', () => {
    const reviews = [
      ...threeEach({ x1: 4, x2: 2 }),
      // x3: 2 ratings, the highest mean and the only spread.
      review('x3', 'a', flat(5)),
      review('x3', 'b', flat(4.5)),
    ]
    const result = available(stats(reviews))
    expect(ids(result.highlights.topRated)).toEqual(['x1'])
    expect(ids(result.highlights.lowestRated)).toEqual(['x2'])
    // x1 and x2 have no spread, and x3 does not qualify.
    expect(result.highlights.mostDivisive).toEqual([])

    const withThird = available(stats([...reviews, review('x3', 'c', flat(5))]))
    expect(ids(withThird.highlights.topRated)).toEqual(['x3'])
    expect(ids(withThird.highlights.mostDivisive)).toEqual(['x3'])
  })

  it('names every tied book in collation order', () => {
    const result = available(
      stats([
        ...threeEach({ x5: 4, x1: 4, x3: 2 }),
        // x4 and x2: the same mean (3) and the same spread.
        review('x4', 'a', flat(2)),
        review('x4', 'b', flat(3)),
        review('x4', 'c', flat(4)),
        review('x2', 'a', flat(4)),
        review('x2', 'b', flat(3)),
        review('x2', 'c', flat(2)),
      ]),
    )
    expect(ids(result.highlights.topRated)).toEqual(['x1', 'x5'])
    expect(ids(result.highlights.lowestRated)).toEqual(['x3'])
    expect(ids(result.highlights.mostDivisive)).toEqual(['x2', 'x4'])
  })

  it('treats values within 1e-9 as tied', () => {
    // x2 is x1 with every score one star lower: the same spread in exact
    // arithmetic, but floating point gives 0.21794494717703386 and …367.
    const x1 = [
      [5, 4.5, 3, 4, 2.5],
      [4, 5, 4.5, 3.5, 5],
      [3, 3.5, 5, 4, 4.5],
      [4, 4, 4, 4.5, 3.5],
    ]
    const members = ['a', 'b', 'c', 'd']
    const result = available(
      stats([
        ...x1.map((s, i) => review('x1', members[i], scores(s))),
        ...x1.map((s, i) => review('x2', members[i], scores(s.map((v) => v - 1)))),
      ]),
    )
    const [first, second] = result.books
    expect(first.dispersion).not.toBe(second.dispersion)
    expect(ids(result.highlights.mostDivisive)).toEqual(['x1', 'x2'])
  })

  it('has no highlights with fewer than 2 qualifying books', () => {
    const result = available(stats([...threeEach({ x1: 4 }), review('x2', 'a', flat(1)), review('x2', 'b', flat(5))]))
    expect(result.highlights.topRated).toEqual([])
    expect(result.highlights.lowestRated).toEqual([])
    expect(result.highlights.mostDivisive).toEqual([])
  })

  it('has no best or worst rated book when every qualifying book has the same mean', () => {
    const result = available(
      stats([
        ...threeEach({ x1: 3 }),
        review('x2', 'a', flat(2)),
        review('x2', 'b', flat(3)),
        review('x2', 'c', flat(4)),
      ]),
    )
    expect(result.highlights.topRated).toEqual([])
    expect(result.highlights.lowestRated).toEqual([])
    // The spread still differs.
    expect(ids(result.highlights.mostDivisive)).toEqual(['x2'])
  })

  it('has no most divisive book when the highest deviation is 0', () => {
    const result = available(stats(threeEach({ x1: 5, x2: 3 })))
    expect(result.highlights.mostDivisive).toEqual([])
    expect(ids(result.highlights.topRated)).toEqual(['x1'])
  })

  it('uses the same entry objects as the books list', () => {
    const result = available(stats(threeEach({ x1: 5, x2: 3 })))
    expect(result.highlights.topRated[0]).toBe(result.books[0])
    expect(result.highlights.lowestRated[0]).toBe(result.books[1])
  })
})

describe('ratingStatistics: member highlights', () => {
  // Each member rates three books with the same overall.
  const member3 = (values: Record<string, number>) =>
    Object.entries(values).flatMap(([memberId, value]) => ['x1', 'x2', 'x3'].map((b) => review(b, memberId, flat(value))))

  it('needs 3 ratings: a member with 2 is never in a highlight, one with 3 can be', () => {
    const reviews = [...member3({ a: 4, b: 3 }), review('x1', 'c', flat(5)), review('x2', 'c', flat(5))]
    const result = available(stats(reviews))
    expect(names(result.highlights.mostGenerous)).toEqual(['Ana'])
    expect(names(result.highlights.harshest)).toEqual(['Bruno'])

    const withThird = available(stats([...reviews, review('x3', 'c', flat(5))]))
    expect(names(withThird.highlights.mostGenerous)).toEqual(['Clara'])
    expect(withThird.highlights.mostGenerous[0]).toBe(withThird.members.find((entry) => entry.member.id === 'c'))
  })

  it('names every tied member in collation order', () => {
    const result = available(stats(member3({ e: 5, b: 5, d: 2, a: 2, c: 3 })))
    expect(names(result.highlights.mostGenerous)).toEqual(['Bruno', 'Élida'])
    expect(names(result.highlights.harshest)).toEqual(['Ana', 'Dario'])
  })

  it('has none with fewer than 2 qualifying members', () => {
    const result = available(stats([...member3({ a: 4 }), review('x1', 'b', flat(1))]))
    expect(result.highlights.mostGenerous).toEqual([])
    expect(result.highlights.harshest).toEqual([])
  })

  it('has none when every qualifying member has the same mean', () => {
    const result = available(stats(member3({ a: 4, b: 4, c: 4 })))
    expect(result.highlights.mostGenerous).toEqual([])
    expect(result.highlights.harshest).toEqual([])
  })
})
