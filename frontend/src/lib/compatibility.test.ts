import { describe, expect, it } from 'vitest'
import type { BookSummary, CriterionScores, MemberCompatibility, MemberSummary, TasteComparison } from '../api/types'
import { MIN_SHARED_BOOKS, tasteCompatibility } from './compatibility'
import type { CountedReview } from './statistics'

// Fictional books and members for the maths; only ids, titles and names matter.
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

const BOOKS = [book('x1', 'Duna'), book('x2', 'Ángeles de papel'), book('x3', 'Cartas al mar'), book('x4', 'Barro y ceniza')]
const MEMBERS = [member('a', 'Ana'), member('b', 'Bruno'), member('c', 'Clara')]

function compare(reviews: CountedReview[], { viewerId = 'a', members = MEMBERS, books = BOOKS } = {}) {
  return tasteCompatibility({ reviews, viewerId, members, books, minSharedBooks: MIN_SHARED_BOOKS })
}

const entryOf = (entries: MemberCompatibility[], id: string) => entries.find((entry) => entry.member.id === id)!

function available(comparison: TasteComparison) {
  if (comparison.status !== 'available') throw new Error('expected an available comparison')
  return comparison
}

const close = (value: number) => expect.closeTo(value, 9)

describe('tasteCompatibility: exact values', () => {
  it('gives Lucía and Carmen (the default fixtures) 2.8/3 overall and each criterion on its own', () => {
    const books = [book('b2', 'Cumbres borrascosas'), book('b12', 'Fortunata y Jacinta'), book('b13', 'El sí de las niñas')]
    const members = [member('m1', 'Lucía'), member('m3', 'Carmen')]
    const result = compare(
      [
        review('b2', 'm1', scores([5, 4.5, 3, 4, 2.5])),
        review('b2', 'm3', scores([4, 5, 4.5, 3.5, 5])),
        review('b12', 'm1', scores([5, 5, 4.5, 4.5, 5])),
        review('b12', 'm3', scores([4.5, 5, 5, 4, 4.5])),
        review('b13', 'm1', scores([2, 2.5, 2, 3, 2])),
        review('b13', 'm3', scores([4.5, 4, 4, 4.5, 4.5])),
      ],
      { viewerId: 'm1', members, books },
    )

    expect(result).toHaveLength(1)
    expect(result[0].member).toEqual(member('m3', 'Carmen'))
    expect(result[0].sharedBookCount).toBe(3)
    const comparison = available(result[0].comparison)
    expect(comparison.overallDifference).toEqual(close(2.8 / 3))
    expect(comparison.criterionDifferences).toEqual({
      disfrute: close(4 / 3),
      estilo: close(2 / 3),
      personajes: close(4 / 3),
      trama: close(2.5 / 3),
      huella: close(5.5 / 3),
    })
    // By title: Cumbres, El sí, Fortunata.
    expect(comparison.books.map((entry) => [entry.book.id, entry.myOverall, entry.theirOverall, entry.difference])).toEqual([
      ['b2', close(3.8), close(4.4), close(0.6)],
      ['b13', close(2.3), close(4.3), close(2)],
      ['b12', close(4.8), close(4.6), close(0.2)],
    ])
  })

  it('gives 0 everywhere for identical reviews', () => {
    const same = [scores([5, 4.5, 3, 4, 2.5]), scores([1, 2, 3, 4, 5]), flat(3.5)]
    const result = compare(same.flatMap((s, i) => [review(BOOKS[i].id, 'a', s), review(BOOKS[i].id, 'b', s)]))
    const comparison = available(entryOf(result, 'b').comparison)
    expect(comparison.overallDifference).toBe(0)
    expect(comparison.criterionDifferences).toEqual({ disfrute: 0, estilo: 0, personajes: 0, trama: 0, huella: 0 })
    expect(comparison.books.map((entry) => entry.difference)).toEqual([0, 0, 0])
  })

  it('gives 4 everywhere for all 1s against all 5s', () => {
    const result = compare(BOOKS.slice(0, 3).flatMap((b) => [review(b.id, 'a', flat(1)), review(b.id, 'b', flat(5))]))
    const comparison = available(entryOf(result, 'b').comparison)
    expect(comparison.overallDifference).toBe(4)
    expect(comparison.criterionDifferences).toEqual({ disfrute: 4, estilo: 4, personajes: 4, trama: 4, huella: 4 })
    expect(comparison.books.map((entry) => [entry.myOverall, entry.theirOverall, entry.difference])).toEqual([
      [1, 5, 4],
      [1, 5, 4],
      [1, 5, 4],
    ])
  })

  it('computes each criterion on its own and the overall difference from the overalls', () => {
    // Ana and Bruno agree on Trama (difference 0) and differ by 2 on Estilo;
    // the other criteria are equal, so their overalls differ by 2/5 = 0.4.
    const result = compare(
      BOOKS.slice(0, 3).flatMap((b) => [
        review(b.id, 'a', scores([3, 2, 3, 4, 3])),
        review(b.id, 'b', scores([3, 4, 3, 4, 3])),
        // Clara differs from Ana in opposite directions, so the mean of her
        // criterion differences is 0.8 while their overalls are equal.
        review(b.id, 'c', scores([4, 1, 4, 4, 2])),
      ]),
    )
    const bruno = available(entryOf(result, 'b').comparison)
    expect(bruno.criterionDifferences).toEqual({
      disfrute: 0,
      estilo: 2,
      personajes: 0,
      trama: 0,
      huella: 0,
    })
    expect(bruno.overallDifference).toEqual(close(0.4))

    const clara = available(entryOf(result, 'c').comparison)
    expect(clara.criterionDifferences).toEqual({ disfrute: 1, estilo: 1, personajes: 1, trama: 0, huella: 1 })
    expect(clara.overallDifference).toEqual(close(0))
  })
})

describe('tasteCompatibility: shared books and the threshold', () => {
  it('needs 3 shared books: 2 give only the count, 3 give the comparison', () => {
    const two = compare(BOOKS.slice(0, 2).flatMap((b) => [review(b.id, 'a', flat(4)), review(b.id, 'b', flat(3))]))
    expect(entryOf(two, 'b')).toEqual({ member: member('b', 'Bruno'), sharedBookCount: 2, comparison: { status: 'insufficient' } })
    expect(Object.keys(entryOf(two, 'b').comparison)).toEqual(['status'])

    const three = compare(BOOKS.slice(0, 3).flatMap((b) => [review(b.id, 'a', flat(4)), review(b.id, 'b', flat(3))]))
    expect(entryOf(three, 'b').sharedBookCount).toBe(3)
    expect(available(entryOf(three, 'b').comparison).overallDifference).toEqual(close(1))
  })

  it('ignores books rated by only one of the two, and reviews by third members', () => {
    const result = compare([
      ...BOOKS.slice(0, 3).flatMap((b) => [review(b.id, 'a', flat(4)), review(b.id, 'b', flat(2))]),
      // Only the viewer, only Bruno, and only Clara with Bruno.
      review('x4', 'a', flat(1)),
      review('x4', 'c', flat(5)),
      review('x1', 'c', flat(1)),
    ])
    const bruno = entryOf(result, 'b')
    expect(bruno.sharedBookCount).toBe(3)
    const comparison = available(bruno.comparison)
    // By title: Ángeles, Cartas, Duna.
    expect(comparison.books.map((entry) => entry.book.id)).toEqual(['x2', 'x3', 'x1'])
    expect(comparison.overallDifference).toEqual(close(2))
    expect(entryOf(result, 'c').sharedBookCount).toBe(2)
  })

  it('ignores reviews of books and members it was not given', () => {
    const result = compare([
      ...BOOKS.slice(0, 2).flatMap((b) => [review(b.id, 'a', flat(4)), review(b.id, 'b', flat(2))]),
      review('unknown', 'a', flat(4)),
      review('unknown', 'b', flat(2)),
      review('x1', 'z', flat(1)),
    ])
    expect(result.map((entry) => [entry.member.id, entry.sharedBookCount])).toEqual([
      ['b', 2],
      ['c', 0],
    ])
  })

  it('gives a member with no shared books 0 and insufficient', () => {
    const result = compare([review('x1', 'a', flat(4))])
    expect(entryOf(result, 'b')).toEqual({ member: member('b', 'Bruno'), sharedBookCount: 0, comparison: { status: 'insufficient' } })
  })

  it('never rounds the values', () => {
    const result = compare([
      review('x1', 'a', scores([5, 4.5, 3, 4, 2.5])),
      review('x1', 'b', scores([4, 4, 4, 4, 4.5])),
      ...BOOKS.slice(1, 3).flatMap((b) => [review(b.id, 'a', flat(4)), review(b.id, 'b', flat(4))]),
    ])
    const comparison = available(entryOf(result, 'b').comparison)
    expect(comparison.overallDifference).toEqual(close(0.3 / 3))
    expect(comparison.criterionDifferences).toEqual({
      disfrute: close(1 / 3),
      estilo: close(0.5 / 3),
      personajes: close(1 / 3),
      trama: close(0),
      huella: close(2 / 3),
    })
  })
})

describe('tasteCompatibility: ordering and who is listed', () => {
  it('lists the members by name with Spanish collation and the books by title', () => {
    const members = [member('a', 'Ana'), member('z', 'Zoe'), member('e', 'Élida'), member('d', 'Dario'), member('i', 'Íñigo')]
    const result = compare(
      BOOKS.flatMap((b) => [review(b.id, 'a', flat(3)), review(b.id, 'e', flat(4))]),
      { members },
    )
    expect(result.map((entry) => entry.member.displayName)).toEqual(['Dario', 'Élida', 'Íñigo', 'Zoe'])
    // Ángeles, Barro, Cartas, Duna.
    expect(available(entryOf(result, 'e').comparison).books.map((entry) => entry.book.id)).toEqual(['x2', 'x4', 'x3', 'x1'])
  })

  it('never ranks by difference', () => {
    const members = [member('a', 'Ana'), member('b', 'Bruno'), member('c', 'Clara')]
    const result = compare(
      BOOKS.slice(0, 3).flatMap((b) => [review(b.id, 'a', flat(3)), review(b.id, 'b', flat(1)), review(b.id, 'c', flat(3))]),
      { members },
    )
    expect(result.map((entry) => entry.member.id)).toEqual(['b', 'c'])
  })

  it('never lists the viewer, and a club with only the viewer gives no entries', () => {
    expect(compare([review('x1', 'a', flat(4))]).map((entry) => entry.member.id)).toEqual(['b', 'c'])
    expect(compare([review('x1', 'b', flat(4))], { viewerId: 'b' }).map((entry) => entry.member.id)).toEqual(['a', 'c'])
    expect(compare([review('x1', 'a', flat(4))], { members: [member('a', 'Ana')] })).toEqual([])
  })
})
