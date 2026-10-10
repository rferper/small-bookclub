// Taste compatibility maths (§5.6, #93). Pure: no React, DOM or API client.
// It takes reviews that have already passed the spoiler gate (the mock, like
// the backend, chooses them with countedReviews first) and never sees the
// others. The viewer is compared with each other member, one at a time, on
// the books both have rated.

import type {
  BookSummary,
  CriterionScores,
  MemberCompatibility,
  MemberSummary,
  SharedBook,
} from '../api/types'
import { CRITERIA, reviewOverall } from './ratings'
import type { CountedReview } from './statistics'

// Shared books needed before any difference is computed or sent.
export const MIN_SHARED_BOOKS = 3

export interface CompatibilityInput {
  // Only the reviews the viewer may see.
  reviews: readonly CountedReview[]
  // Who is asking. Not a role.
  viewerId: string
  // Every member of the club (the viewer is left out of the result).
  members: readonly MemberSummary[]
  // The books the reviews refer to (reviews of other books are ignored).
  books: readonly BookSummary[]
  minSharedBooks: number
}

const collator = new Intl.Collator('es', { sensitivity: 'base' })

const mean = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length

// One entry per other member, by display name with Spanish collation, never
// by score. Below `minSharedBooks` an entry carries only the count.
export function tasteCompatibility({
  reviews,
  viewerId,
  members,
  books,
  minSharedBooks,
}: CompatibilityInput): MemberCompatibility[] {
  const scoresOf = (memberId: string) =>
    new Map(reviews.filter((review) => review.memberId === memberId).map((review) => [review.bookId, review.scores]))
  const mine = scoresOf(viewerId)
  // Books ordered once by title, so every shared list keeps that order.
  const ordered = [...books].sort((a, b) => collator.compare(a.title, b.title))

  return members
    .filter((member) => member.id !== viewerId)
    .sort((a, b) => collator.compare(a.displayName, b.displayName))
    .map((member) => {
      const theirs = scoresOf(member.id)
      const shared = ordered.flatMap((book) => {
        const my = mine.get(book.id)
        const their = theirs.get(book.id)
        return my && their ? [{ book, my, their }] : []
      })
      const summary: MemberSummary = { id: member.id, displayName: member.displayName, avatarUrl: member.avatarUrl }
      if (shared.length < minSharedBooks) {
        return { member: summary, sharedBookCount: shared.length, comparison: { status: 'insufficient' } }
      }

      const sharedBooks: SharedBook[] = shared.map(({ book, my, their }) => {
        const myOverall = reviewOverall(my)
        const theirOverall = reviewOverall(their)
        return {
          book: { id: book.id, title: book.title, authors: [...book.authors], coverUrl: book.coverUrl },
          myOverall,
          theirOverall,
          difference: Math.abs(myOverall - theirOverall),
        }
      })
      // Each criterion on its own; the overall difference comes from the
      // overalls, not from the criterion differences.
      const criterionDifferences = Object.fromEntries(
        CRITERIA.map((criterion) => [
          criterion,
          mean(shared.map(({ my, their }) => Math.abs(my[criterion] - their[criterion]))),
        ]),
      ) as CriterionScores
      return {
        member: summary,
        sharedBookCount: shared.length,
        comparison: {
          status: 'available',
          overallDifference: mean(sharedBooks.map((entry) => entry.difference)),
          criterionDifferences,
          books: sharedBooks,
        },
      }
    })
}
