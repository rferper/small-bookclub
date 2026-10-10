import { describe, expect, it } from 'vitest'
import { countedReviews } from './statisticsGate'

// Fictional reviews: only the book and member ids matter here.
const reviews = [
  { bookId: 'p', userId: 'u1' },
  { bookId: 'p', userId: 'u2' },
  { bookId: 'q', userId: 'u2' },
  { bookId: 'q', userId: 'u3' },
  { bookId: 'r', userId: 'u1' },
]

describe('countedReviews', () => {
  it('counts every review of a book the user has finished and rated', () => {
    const finished = { p: ['u1', 'u2'], q: ['u2', 'u3'], r: [] }
    expect(countedReviews({ userId: 'u2', reviews, finished })).toEqual(reviews.slice(0, 4))
  })

  it('leaves out a book the user has finished but not rated', () => {
    const finished = { q: ['u1', 'u2', 'u3'] }
    expect(countedReviews({ userId: 'u1', reviews, finished })).toEqual([])
  })

  it('leaves out a book the user has rated without the finished flag', () => {
    // Not possible through the API, but the gate needs both.
    expect(countedReviews({ userId: 'u1', reviews, finished: { p: ['u2'] } })).toEqual([])
  })

  it('leaves out every book for a user with no review and no flag', () => {
    expect(countedReviews({ userId: 'u9', reviews, finished: { p: ['u1', 'u2'], q: ['u2', 'u3'] } })).toEqual([])
  })

  it('has no role input: only the user id, the reviews and the finished flags decide', () => {
    const finished = { p: ['u1', 'u2'], r: ['u1'] }
    expect(countedReviews({ userId: 'u1', reviews, finished })).toEqual([reviews[0], reviews[1], reviews[4]])
  })
})
