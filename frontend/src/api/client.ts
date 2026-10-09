import type { BookDetail, HomeData, LibraryBook, MeetingDetail, MeetingList, Session, Vote, VotesOverview } from './types'

// The only way components talk to the backend. Today the app uses the mock
// implementation; an HTTP implementation will replace it once the backend
// exists, without changing any component.
export interface ApiClient {
  // Session. These never fail with 401: a visitor who is not signed in gets
  // an anonymous or denied session instead.
  getSession(): Promise<Session>
  // Starts Discord sign-in. The HTTP client will hand over to the backend's
  // OAuth flow; components never build backend or Discord URLs themselves.
  startSignIn(): Promise<void>
  // Demo sign-in with fictional data (#75); only offered when the session
  // says so.
  startDemoSignIn(): Promise<void>
  signOut(): Promise<void>

  // Club data. The backend answers 401 while nobody is signed in.
  getHome(): Promise<HomeData>
  setWeekCompleted(weekId: string, completed: boolean): Promise<void>
  // Every book in the club catalogue, unsorted.
  listBooks(): Promise<LibraryBook[]>
  // One book with its reading plan and meetings. Rejects with a 404
  // ApiError for an unknown id.
  getBook(bookId: string): Promise<BookDetail>
  // Every meeting, split into upcoming and past by the server's clock.
  listMeetings(): Promise<MeetingList>
  // One meeting with its attendance and, if the signed-in user may see it,
  // its summary and highlights. Rejects with a 404 ApiError for an unknown id.
  getMeeting(meetingId: string): Promise<MeetingDetail>
  // The current curator, the draft or open vote (if any) and every closed vote.
  getVotes(): Promise<VotesOverview>
  // One vote of any status. Rejects with a 404 ApiError for an unknown id.
  getVote(voteId: string): Promise<Vote>
  // Approves one candidate for the signed-in user, or withdraws that
  // approval, and returns the updated vote. Rejects with a 409 ApiError
  // unless the vote is open, and a 404 for an unknown vote or a book that is
  // not one of its candidates.
  setApproval(voteId: string, bookId: string, approved: boolean): Promise<Vote>
}

// Methods that manage the session itself; every other method returns club data.
export const SESSION_METHODS: readonly (keyof ApiClient)[] = ['getSession', 'startSignIn', 'startDemoSignIn', 'signOut']

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
