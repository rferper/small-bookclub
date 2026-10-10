import type {
  BookDetail,
  BookRatings,
  HomeData,
  LibraryBook,
  MeetingDetail,
  MeetingList,
  RatingRubric,
  ReviewInput,
  Session,
  Statistics,
  TasteCompatibility,
  Vote,
  VotesOverview,
} from './types'

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

  // Vote management (#91). Each call returns the updated vote. Only the
  // current curator or the admin may call them (403 otherwise; the tie-break
  // is the admin's alone), and the server checks every rule: 404 for an
  // unknown vote or book, 409 when the vote's state does not allow the
  // change. The `can*` flags on the vote data say which ones to offer.
  // Starts a draft vote with an empty shortlist for the current curator.
  createVote(): Promise<Vote>
  // Appends a «Propuesto» book to the shortlist, with no approvals.
  addCandidate(voteId: string, bookId: string): Promise<Vote>
  // Removes a candidate and all of its approvals.
  removeCandidate(voteId: string, bookId: string): Promise<Vote>
  // Sets the shortlist order; `bookIds` must be exactly the current candidates.
  reorderCandidates(voteId: string, bookIds: string[]): Promise<Vote>
  // Opens a draft that has at least two candidates.
  openVote(voteId: string): Promise<Vote>
  // Closes an open vote; the server decides the winner or a pending tie.
  closeVote(voteId: string): Promise<Vote>
  // Records the book the club chose after a tie, with an optional plain-text
  // note (at most 1000 characters; 400 if longer).
  recordTieWinner(voteId: string, bookId: string, note: string): Promise<Vote>

  // Ratings and reviews (#67). Every call acts for the signed-in user only.
  // The club's ratings come only once the user has finished the book and
  // submitted their own review; until then `club` is locked and carries
  // nothing else. Rejects with a 404 ApiError for an unknown book.
  getBookRatings(bookId: string): Promise<BookRatings>
  // The meaning of each whole-star anchor per criterion; not gated.
  getRatingRubric(): Promise<RatingRubric>
  // Sets or clears «He terminado el libro» and returns the updated ratings.
  // 409 when finishing a book that cannot be rated, or clearing it once the
  // user has a review.
  setBookFinished(bookId: string, finished: boolean): Promise<BookRatings>
  // Creates or replaces the user's review and returns the updated ratings.
  // 409 when the book cannot be rated or the user has not finished it; 400
  // for a missing or invalid score, or a text over 5000 characters.
  saveMyReview(bookId: string, review: ReviewInput): Promise<BookRatings>

  // Statistics (#68) for the signed-in user. The rating figures count only
  // the books this user has finished and rated; the others are absent, and
  // nothing says how many there are.
  getStatistics(): Promise<Statistics>
  // Taste compatibility (#93): the signed-in user against every other member,
  // only on the books this user has finished and rated and the other member
  // has rated too. Below `minSharedBooks` an entry carries only the count;
  // other books are absent.
  getTasteCompatibility(): Promise<TasteCompatibility>
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
