// Statistics maths (§5.6, §8, #68). Pure: no React, DOM or API client. It
// takes reviews that have already passed the spoiler gate (the mock, like
// the backend, chooses them with ratingGate first) and never sees the others.

import type {
  BookStatistics,
  BookSummary,
  CriterionScores,
  MemberStatistics,
  MemberSummary,
  RatingStatistics,
  StatisticsThresholds,
} from '../api/types'
import { CRITERIA, clubAggregates, reviewOverall } from './ratings'

// A book or member needs this many counted ratings to be in a highlight.
export const STATISTICS_THRESHOLDS: StatisticsThresholds = { bookRatings: 3, memberRatings: 3 }

// Values closer than this are equal: for ties, the empty rules and ordering.
export const TIE_TOLERANCE = 1e-9

export interface CountedReview {
  bookId: string
  memberId: string
  scores: CriterionScores
}

export interface StatisticsInput {
  // Only the reviews the viewer may see.
  reviews: readonly CountedReview[]
  // The books and members the reviews refer to (others are ignored).
  books: readonly BookSummary[]
  members: readonly MemberSummary[]
  // Who is asking, to mark and place their own entry first. Not a role.
  viewerId: string
  thresholds: StatisticsThresholds
}

const collator = new Intl.Collator('es', { sensitivity: 'base' })
const byTitle = (a: BookStatistics, b: BookStatistics) => collator.compare(a.book.title, b.book.title)
const byName = (a: MemberStatistics, b: MemberStatistics) => collator.compare(a.member.displayName, b.member.displayName)

const equal = (a: number, b: number) => Math.abs(a - b) <= TIE_TOLERANCE

// Population standard deviation of `values` around `mean`.
export function populationStandardDeviation(values: readonly number[], mean: number): number {
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// Every entry whose value equals the extreme (highest when `highest`),
// in collation order.
function extremes<T>(entries: readonly T[], value: (entry: T) => number, highest: boolean, order: (a: T, b: T) => number): T[] {
  const values = entries.map(value)
  const extreme = highest ? Math.max(...values) : Math.min(...values)
  return entries.filter((entry) => equal(value(entry), extreme)).sort(order)
}

// The highest and lowest entries, or two empty lists when fewer than 2
// qualify or all of them have the same value.
function highestAndLowest<T>(qualifying: readonly T[], value: (entry: T) => number, order: (a: T, b: T) => number): [T[], T[]] {
  if (qualifying.length < 2) return [[], []]
  const values = qualifying.map(value)
  if (equal(Math.max(...values), Math.min(...values))) return [[], []]
  return [extremes(qualifying, value, true, order), extremes(qualifying, value, false, order)]
}

export function ratingStatistics({ reviews, books, members, viewerId, thresholds }: StatisticsInput): RatingStatistics {
  const counted = reviews.filter(
    (review) => books.some((b) => b.id === review.bookId) && members.some((m) => m.id === review.memberId),
  )
  if (counted.length === 0) return { status: 'empty' }

  const all = clubAggregates(counted.map((review) => review.scores))!

  const bookEntries: BookStatistics[] = books.flatMap((book) => {
    const scores = counted.filter((review) => review.bookId === book.id).map((review) => review.scores)
    if (scores.length === 0) return []
    const { overallMean } = clubAggregates(scores)!
    return [
      {
        book: { id: book.id, title: book.title, authors: [...book.authors], coverUrl: book.coverUrl },
        reviewCount: scores.length,
        overallMean,
        dispersion: populationStandardDeviation(scores.map(reviewOverall), overallMean),
      },
    ]
  })
  // Highest mean first; equal means by title.
  bookEntries.sort((a, b) => (equal(a.overallMean, b.overallMean) ? byTitle(a, b) : b.overallMean - a.overallMean))

  const memberEntries: MemberStatistics[] = members.flatMap((member) => {
    const scores = counted.filter((review) => review.memberId === member.id).map((review) => review.scores)
    if (scores.length === 0) return []
    return [
      {
        member: { id: member.id, displayName: member.displayName, avatarUrl: member.avatarUrl },
        isMe: member.id === viewerId,
        reviewCount: scores.length,
        overallMean: clubAggregates(scores)!.overallMean,
      },
    ]
  })
  // The viewer first, then by name; never by score.
  memberEntries.sort((a, b) => Number(b.isMe) - Number(a.isMe) || byName(a, b))

  const ratedBooks = bookEntries.filter((entry) => entry.reviewCount >= thresholds.bookRatings)
  const ratedMembers = memberEntries.filter((entry) => entry.reviewCount >= thresholds.memberRatings)
  const [topRated, lowestRated] = highestAndLowest(ratedBooks, (entry) => entry.overallMean, byTitle)
  const [mostGenerous, harshest] = highestAndLowest(ratedMembers, (entry) => entry.overallMean, byName)
  const mostDivisive =
    ratedBooks.length < 2 || Math.max(...ratedBooks.map((entry) => entry.dispersion)) <= TIE_TOLERANCE
      ? []
      : extremes(ratedBooks, (entry) => entry.dispersion, true, byTitle)

  return {
    status: 'available',
    bookCount: bookEntries.length,
    reviewCount: all.reviewCount,
    overallMean: all.overallMean,
    criterionMeans: Object.fromEntries(CRITERIA.map((c) => [c, all.criterionMeans[c]])) as CriterionScores,
    books: bookEntries,
    members: memberEntries,
    highlights: { topRated, lowestRated, mostDivisive, mostGenerous, harshest },
  }
}
