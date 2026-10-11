import type { MockBook, MockMeeting, MockState, MockVote, MockWeek } from './fixtures'

// Every operational projection shares these parent-aware filters. Retained
// arrays remain canonical for recovery, dependencies and link reservations.
export const bookVisible = (book: MockBook) => !book.deletedAt
export const hasVisibleBook = (state: MockState, id: string) => state.books.some((b) => b.id === id && bookVisible(b))
export const meetingVisible = (state: MockState, meeting: MockMeeting) => !meeting.deletedAt && (meeting.bookId === null || hasVisibleBook(state, meeting.bookId))
export const weekVisible = (state: MockState, week: MockWeek) => !week.deletedAt && hasVisibleBook(state, week.bookId)
export const voteVisible = (state: MockState, vote: MockVote) => {
  const ids = [...vote.candidates.map((c) => c.bookId), ...(vote.outcome ? 'winnerBookId' in vote.outcome ? [vote.outcome.winnerBookId] : vote.outcome.tiedBookIds : [])]
  return ids.every((id) => hasVisibleBook(state, id))
}
