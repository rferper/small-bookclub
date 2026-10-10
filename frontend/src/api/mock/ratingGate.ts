// The spoiler gate for a book's ratings and reviews (§5.5, decisions 42 and
// 49). It mirrors the backend gate (#38): the mock calls it on every request,
// for the signed-in user, and leaves the club's ratings out of locked
// responses.

export interface RatingGateInput {
  userId: string
  // Ids of the members who marked the book «He terminado el libro».
  finishedBy: string[]
  // Ids of the members who submitted a review of the book.
  reviewerIds: string[]
}

// Visible only when the user has finished the book and submitted their own
// review; finishing alone is not enough. There is no role input: the admin
// gets exactly the same answer as a member in the same situation (§3).
export function ratingGate({ userId, finishedBy, reviewerIds }: RatingGateInput): { visible: boolean } {
  return { visible: finishedBy.includes(userId) && reviewerIds.includes(userId) }
}
