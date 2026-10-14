import type { ClubExport, DeletedType, LiteraryQuoteInput, MeetingSummaryInput, MeetingHighlightInput, ReadingWeekInput, MeetingInput, BookInput, NewMember, ProfileUpdate, RatingRubric, ReviewInput } from './types'
import type { components, operations } from './generated'

// All JSON success results come from their actual operation, including creation status.
export type ApiResult<Name extends keyof operations> =
  operations[Name] extends { responses: infer Responses }
    ? { [Status in keyof Responses]: Status extends 200 | 201
        ? Responses[Status] extends { content: { 'application/json': infer Body } } ? Body : never
        : Status extends 204 ? void : never }[keyof Responses]
    : never

// The only way components talk to the backend. Today the app uses the mock
// implementation; an HTTP implementation will replace it once the backend
// exists, without changing any component.
export interface ApiClient {
  // Contract #102: admin-only GET /api/admin/backups, POST /api/admin/export,
  // GET /api/admin/audit-log. Mock confirmation only; production auth is #49.
  getBackupInfo(): Promise<ApiResult<'getBackupInfo'>>
  exportClubData(): Promise<ClubExport>
  getAuditLog(): Promise<ApiResult<'getAuditLog'>>
  getRecycleBin(): Promise<ApiResult<'getRecycleBin'>>
  getDeletionPreview(type: 'book' | 'meeting' | 'quote', id: string): Promise<ApiResult<'getDeletionPreview'>>
  deleteBook(id: string): Promise<ApiResult<'deleteBook'>>
  deleteMeeting(id: string): Promise<ApiResult<'deleteMeeting'>>
  deleteLiteraryQuote(id: string): Promise<ApiResult<'deleteLiteraryQuote'>>
  restoreDeleted(type: DeletedType, id: string): Promise<ApiResult<'restoreDeleted'>>
  purgeDeleted(type: DeletedType, id: string): Promise<ApiResult<'purgeDeleted'>>

  listAdminQuotes(): Promise<ApiResult<'listAdminQuotes'>>
  addLiteraryQuote(input: LiteraryQuoteInput): Promise<ApiResult<'addLiteraryQuote'>>
  updateLiteraryQuote(id: string, input: LiteraryQuoteInput): Promise<ApiResult<'updateLiteraryQuote'>>
  saveRatingRubric(input: RatingRubric): Promise<ApiResult<'saveRatingRubric'>>
  getAdminMeetingRecord(meetingId: string): Promise<ApiResult<'getAdminMeetingRecord'>>
  saveMeetingSummary(meetingId: string, input: MeetingSummaryInput): Promise<ApiResult<'saveMeetingSummary'>>
  createMeetingHighlight(meetingId: string, input: MeetingHighlightInput): Promise<ApiResult<'createMeetingHighlight'>>
  updateMeetingHighlight(meetingId: string, highlightId: string, input: MeetingHighlightInput): Promise<ApiResult<'updateMeetingHighlight'>>
  reorderMeetingHighlights(meetingId: string, ids: components['schemas']['IdOrder']['ids']): Promise<ApiResult<'reorderMeetingHighlights'>>
  removeMeetingHighlight(meetingId: string, highlightId: string): Promise<ApiResult<'removeMeetingHighlight'>>
  setMeetingRecordSafe(meetingId: string, safe: components['schemas']['SafeInput']['safe']): Promise<ApiResult<'setMeetingRecordSafe'>>
  getAdminReadingPlan(bookId: string): Promise<ApiResult<'getAdminReadingPlan'>>
  createReadingWeek(bookId: string, input: ReadingWeekInput, acknowledged: components['schemas']['ReadingWeekWrite']['acknowledged']): Promise<ApiResult<'createReadingWeek'>>
  updateReadingWeek(bookId: string, weekId: string, input: ReadingWeekInput, acknowledged: components['schemas']['ReadingWeekWrite']['acknowledged']): Promise<ApiResult<'updateReadingWeek'>>
  reorderReadingWeeks(bookId: string, ids: components['schemas']['IdOrder']['ids'], acknowledged: components['schemas']['ReadingWeekWrite']['acknowledged']): Promise<ApiResult<'reorderReadingWeeks'>>
  removeReadingWeek(bookId: string, weekId: string): Promise<ApiResult<'removeReadingWeek'>>
  listAdminMeetings(): Promise<ApiResult<'listAdminMeetings'>>
  getAdminMeeting(meetingId: string): Promise<ApiResult<'getAdminMeeting'>>
  createMeeting(input: MeetingInput): Promise<ApiResult<'createMeeting'>>
  updateMeeting(meetingId: string, input: MeetingInput): Promise<ApiResult<'updateMeeting'>>
  setMeetingCancelled(meetingId: string, cancelled: components['schemas']['CancelledInput']['cancelled']): Promise<ApiResult<'setMeetingCancelled'>>
  setMeetingAttendance(meetingId: string, memberIds: components['schemas']['AttendanceInput']['memberIds']): Promise<ApiResult<'setMeetingAttendance'>>
  // Admin-only catalogue (#95): 401 before permission/data checks; 403 for
  // members including curators. Metadata only, never ratings or meeting records.
  listAdminBooks(): Promise<ApiResult<'listAdminBooks'>>
  getAdminBook(bookId: string): Promise<ApiResult<'getAdminBook'>>
  // Whole metadata and cover transaction: 400 invalid input, 404 unknown id,
  // 409 second leyendo book (message names the active book); no partial changes.
  createBook(input: BookInput): Promise<ApiResult<'createBook'>>
  updateBook(bookId: string, input: BookInput): Promise<ApiResult<'updateBook'>>
  // Fixed fictional title/author matches; 400 blank/overlong query, no network.
  // Selecting metadata is local; a metadata cover refers to a returned result id.
  searchBookMetadata(query: string): Promise<ApiResult<'searchBookMetadata'>>
  // Session. These never fail with 401: a visitor who is not signed in gets
  // an anonymous or denied session instead.
  getSession(): Promise<ApiResult<'getSession'>>
  // Starts Discord sign-in. The HTTP client will hand over to the backend's
  // OAuth flow; components never build backend or Discord URLs themselves.
  startSignIn(purpose?: 'export'): Promise<void>
  // Demo sign-in with fictional data (#75); only offered when the session
  // says so.
  startDemoSignIn(): Promise<ApiResult<'startDemoSignIn'>>
  signOut(): Promise<ApiResult<'signOut'>>

  // Club data. The backend answers 401 while nobody is signed in.
  getHome(): Promise<ApiResult<'getHome'>>
  setWeekCompleted(weekId: string, completed: components['schemas']['WeekCompletionInput']['completed']): Promise<ApiResult<'setWeekCompleted'>>
  // Every book in the club catalogue, unsorted.
  listBooks(): Promise<ApiResult<'listBooks'>>
  // One book with its reading plan and meetings. Rejects with a 404
  // ApiError for an unknown id.
  getBook(bookId: string): Promise<ApiResult<'getBook'>>
  // Every meeting, split into upcoming and past by the server's clock.
  listMeetings(): Promise<ApiResult<'listMeetings'>>
  // One meeting with its attendance and, if the signed-in user may see it,
  // its summary and highlights. Rejects with a 404 ApiError for an unknown id.
  getMeeting(meetingId: string): Promise<ApiResult<'getMeeting'>>
  // The current curator, the draft or open vote (if any) and every closed vote.
  getVotes(): Promise<ApiResult<'getVotes'>>
  // One vote of any status. Rejects with a 404 ApiError for an unknown id.
  getVote(voteId: string): Promise<ApiResult<'getVote'>>
  // Approves one candidate for the signed-in user, or withdraws that
  // approval, and returns the updated vote. Rejects with a 409 ApiError
  // unless the vote is open, and a 404 for an unknown vote or a book that is
  // not one of its candidates.
  setApproval(voteId: string, bookId: string, approved: components['schemas']['ApprovalInput']['approved']): Promise<ApiResult<'setApproval'>>

  // Vote management (#91). Each call returns the updated vote. Only the
  // current curator or the admin may call them (403 otherwise; the tie-break
  // is the admin's alone), and the server checks every rule: 404 for an
  // unknown vote or book, 409 when the vote's state does not allow the
  // change. The `can*` flags on the vote data say which ones to offer.
  // Starts a draft vote with an empty shortlist for the current curator.
  createVote(): Promise<ApiResult<'createVote'>>
  // Appends a «Propuesto» book to the shortlist, with no approvals.
  addCandidate(voteId: string, bookId: string): Promise<ApiResult<'addCandidate'>>
  // Removes a candidate and all of its approvals.
  removeCandidate(voteId: string, bookId: string): Promise<ApiResult<'removeCandidate'>>
  // Sets the shortlist order; `bookIds` must be exactly the current candidates.
  reorderCandidates(voteId: string, bookIds: components['schemas']['CandidateOrderInput']['bookIds']): Promise<ApiResult<'reorderCandidates'>>
  // Opens a draft that has at least two candidates.
  openVote(voteId: string): Promise<ApiResult<'openVote'>>
  // Closes an open vote; the server decides the winner or a pending tie.
  closeVote(voteId: string): Promise<ApiResult<'closeVote'>>
  // Records the book the club chose after a tie, with an optional plain-text
  // note (at most 1000 characters; 400 if longer).
  recordTieWinner(voteId: string, bookId: string, note: string): Promise<ApiResult<'recordTieWinner'>>

  // Ratings and reviews (#67). Every call acts for the signed-in user only.
  // The club's ratings come only once the user has finished the book and
  // submitted their own review; until then `club` is locked and carries
  // nothing else. Rejects with a 404 ApiError for an unknown book.
  getBookRatings(bookId: string): Promise<ApiResult<'getBookRatings'>>
  // The meaning of each whole-star anchor per criterion; not gated.
  getRatingRubric(): Promise<ApiResult<'getRatingRubric'>>
  // Sets or clears «He terminado el libro» and returns the updated ratings.
  // 409 when finishing a book that cannot be rated, or clearing it once the
  // user has a review.
  setBookFinished(bookId: string, finished: components['schemas']['FinishedInput']['finished']): Promise<ApiResult<'setBookFinished'>>
  // Creates or replaces the user's review and returns the updated ratings.
  // 409 when the book cannot be rated or the user has not finished it; 400
  // for a missing or invalid score, or a text over 5000 characters.
  saveMyReview(bookId: string, review: ReviewInput): Promise<ApiResult<'saveMyReview'>>

  // Statistics (#68) for the signed-in user. The rating figures count only
  // the books this user has finished and rated; the others are absent, and
  // nothing says how many there are.
  getStatistics(): Promise<ApiResult<'getStatistics'>>
  // Taste compatibility (#93): the signed-in user against every other member,
  // only on the books this user has finished and rated and the other member
  // has rated too. Below `minSharedBooks` an entry carries only the count;
  // other books are absent.
  getTasteCompatibility(): Promise<ApiResult<'getTasteCompatibility'>>

  // Miembros (#69), for the signed-in user. Only active members: a revoked
  // member is absent. Neither call carries any rating, review or taste data.
  // Every active member with this week's public reading status, by name.
  listMembers(): Promise<ApiResult<'listMembers'>>
  // One active member's profile. Rejects with the same 404 ApiError for an
  // unknown id and for a revoked member's id.
  getMemberProfile(memberId: string): Promise<ApiResult<'getMemberProfile'>>

  // Mi perfil (#94). None of these takes a member id: they act for the
  // signed-in user only, the admin included.
  // The user's own profile, with every book that may be a favourite.
  getMyProfile(): Promise<ApiResult<'getMyProfile'>>
  // Saves the whole profile in one atomic call and returns the new
  // getMyProfile result. 400 when any value is invalid (then nothing changes,
  // the avatar included); 403 for an input that names another member.
  updateMyProfile(input: ProfileUpdate): Promise<ApiResult<'updateMyProfile'>>
  // The user's own reviews, newest activity first (the latest of submitted
  // and edited), then by title. Not gated; no club data.
  listMyReviews(): Promise<ApiResult<'listMyReviews'>>

  // Administración (#70): the member allowlist and the curator assignment.
  // Only the admin may call them: 403 for anyone else, the current curator
  // included. The server checks, in this order after the 401: 403, then 404
  // for an unknown member (or a revoked one as curator), then 409 when the
  // list does not allow the change, then 400 for invalid input. A refused
  // call changes nothing. Each change returns the new getAdminMembers result.
  // No call changes anyone's role (#6).
  // Every allowlist entry, active and revoked, with the current curator.
  getAdminMembers(): Promise<ApiResult<'getAdminMembers'>>
  // Adds (and so approves) an active member with the `member` role and an
  // empty profile. 409 for a Discord id already on the list, active or
  // revoked; 400 for an id that is not 17–20 digits or an invalid name
  // (the #94 rules).
  addMember(input: NewMember): Promise<ApiResult<'addMember'>>
  // Revokes a member's access. 409 for the signed-in admin or a member who
  // is already revoked. Revoking the current curator clears the curator; the
  // member's past contributions stay under their name.
  revokeMember(memberId: string): Promise<ApiResult<'revokeMember'>>
  // Gives a revoked member access back, with their profile as it was.
  // 409 for a member who is already active.
  restoreMember(memberId: string): Promise<ApiResult<'restoreMember'>>
  // Assigns the curator, or clears the assignment with null. 404 for a
  // revoked member. Existing votes keep their recorded curator.
  setCurator(memberId: components['schemas']['CuratorInput']['memberId']): Promise<ApiResult<'setCurator'>>
}

// Methods that manage the session itself; every other method returns club data.
export const SESSION_METHODS: readonly (keyof ApiClient)[] = ['getSession', 'startSignIn', 'startDemoSignIn', 'signOut']

export class ApiError extends Error {
  readonly status: number
  readonly code: components['schemas']['Error']['code'] | undefined

  constructor(status: number, message: string, code?: components['schemas']['Error']['code']) {
    super(message)
    this.status = status
    this.code = code
  }
}


// Browser image resources, callback navigation and infrastructure health have no JSON client method.
type AssertNever<T extends never> = T
export type ClientOperationCoverage = AssertNever<Exclude<keyof ApiClient, keyof operations>>
export type ContractOperationCoverage = AssertNever<Exclude<keyof operations, keyof ApiClient | 'discordCallback' | 'getHealth' | 'getAvatar' | 'getCover'>>
