// The spoiler gate for the statistics (§5.6, §11 item 12, #68). It mirrors
// the backend: on every request, for the signed-in user, only the reviews of
// books that user has unlocked with #67's ratingGate (finished the book and
// submitted their own review) are counted. Everything else is left out
// before any figure is computed, so it cannot reach the response. There is
// no role input: the admin gets the same answer as a member.

import { ratingGate } from './ratingGate'

export interface GatedReview {
  bookId: string
  userId: string
}

export interface StatisticsGateInput<R extends GatedReview> {
  userId: string
  // Every submitted review in the club.
  reviews: readonly R[]
  // bookId -> ids of the members who marked «He terminado el libro».
  finished: Readonly<Record<string, readonly string[]>>
}

// The reviews that count for `userId`: every review of each book they have
// unlocked, and none of any other book.
export function countedReviews<R extends GatedReview>({ userId, reviews, finished }: StatisticsGateInput<R>): R[] {
  const bookIds = [...new Set(reviews.map((review) => review.bookId))]
  const unlocked = new Set(
    bookIds.filter(
      (bookId) =>
        ratingGate({
          userId,
          finishedBy: [...(finished[bookId] ?? [])],
          reviewerIds: reviews.filter((review) => review.bookId === bookId).map((review) => review.userId),
        }).visible,
    ),
  )
  return reviews.filter((review) => unlocked.has(review.bookId))
}
