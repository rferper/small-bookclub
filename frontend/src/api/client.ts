import type {
  AdminReadingPlan, ReadingWeekInput,
  AdminMeeting, AdminMeetingCalendar, MeetingInput,
  AdminMembers,
  AdminBook,
  BookInput,
  BookMetadataResult,
  BookDetail,
  BookRatings,
  HomeData,
  LibraryBook,
  MeetingDetail,
  MeetingList,
  MemberDirectory,
  MemberProfile,
  MyProfile,
  MyReviewEntry,
  NewMember,
  ProfileUpdate,
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
  getAdminReadingPlan(bookId: string): Promise<AdminReadingPlan>
  createReadingWeek(bookId: string, input: ReadingWeekInput, acknowledged: boolean): Promise<AdminReadingPlan>
  updateReadingWeek(bookId: string, weekId: string, input: ReadingWeekInput, acknowledged: boolean): Promise<AdminReadingPlan>
  reorderReadingWeeks(bookId: string, ids: string[], acknowledged: boolean): Promise<AdminReadingPlan>
  removeReadingWeek(bookId: string, weekId: string): Promise<AdminReadingPlan>
  listAdminMeetings(): Promise<AdminMeetingCalendar>
  getAdminMeeting(meetingId: string): Promise<AdminMeeting>
  createMeeting(input: MeetingInput): Promise<AdminMeeting>
  updateMeeting(meetingId: string, input: MeetingInput): Promise<AdminMeeting>
  setMeetingCancelled(meetingId: string, cancelled: boolean): Promise<AdminMeeting>
  setMeetingAttendance(meetingId: string, memberIds: string[]): Promise<AdminMeeting>
  // Admin-only catalogue (#95): 401 before permission/data checks; 403 for
  // members including curators. Metadata only, never ratings or meeting records.
  listAdminBooks(): Promise<AdminBook[]>
  getAdminBook(bookId: string): Promise<AdminBook>
  // Whole metadata and cover transaction: 400 invalid input, 404 unknown id,
  // 409 second leyendo book (message names the active book); no partial changes.
  createBook(input: BookInput): Promise<AdminBook>
  updateBook(bookId: string, input: BookInput): Promise<AdminBook>
  // Fixed fictional title/author matches; 400 blank/overlong query, no network.
  // Selecting metadata is local; a metadata cover refers to a returned result id.
  searchBookMetadata(query: string): Promise<BookMetadataResult[]>
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

  // Miembros (#69), for the signed-in user. Only active members: a revoked
  // member is absent. Neither call carries any rating, review or taste data.
  // Every active member with this week's public reading status, by name.
  listMembers(): Promise<MemberDirectory>
  // One active member's profile. Rejects with the same 404 ApiError for an
  // unknown id and for a revoked member's id.
  getMemberProfile(memberId: string): Promise<MemberProfile>

  // Mi perfil (#94). None of these takes a member id: they act for the
  // signed-in user only, the admin included.
  // The user's own profile, with every book that may be a favourite.
  getMyProfile(): Promise<MyProfile>
  // Saves the whole profile in one atomic call and returns the new
  // getMyProfile result. 400 when any value is invalid (then nothing changes,
  // the avatar included); 403 for an input that names another member.
  updateMyProfile(input: ProfileUpdate): Promise<MyProfile>
  // The user's own reviews, newest activity first (the latest of submitted
  // and edited), then by title. Not gated; no club data.
  listMyReviews(): Promise<MyReviewEntry[]>

  // Administración (#70): the member allowlist and the curator assignment.
  // Only the admin may call them: 403 for anyone else, the current curator
  // included. The server checks, in this order after the 401: 403, then 404
  // for an unknown member (or a revoked one as curator), then 409 when the
  // list does not allow the change, then 400 for invalid input. A refused
  // call changes nothing. Each change returns the new getAdminMembers result.
  // No call changes anyone's role (#6).
  // Every allowlist entry, active and revoked, with the current curator.
  getAdminMembers(): Promise<AdminMembers>
  // Adds (and so approves) an active member with the `member` role and an
  // empty profile. 409 for a Discord id already on the list, active or
  // revoked; 400 for an id that is not 17–20 digits or an invalid name
  // (the #94 rules).
  addMember(input: NewMember): Promise<AdminMembers>
  // Revokes a member's access. 409 for the signed-in admin or a member who
  // is already revoked. Revoking the current curator clears the curator; the
  // member's past contributions stay under their name.
  revokeMember(memberId: string): Promise<AdminMembers>
  // Gives a revoked member access back, with their profile as it was.
  // 409 for a member who is already active.
  restoreMember(memberId: string): Promise<AdminMembers>
  // Assigns the curator, or clears the assignment with null. 404 for a
  // revoked member. Existing votes keep their recorded curator.
  setCurator(memberId: string | null): Promise<AdminMembers>
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
