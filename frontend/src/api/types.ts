// Shapes returned by the API client. These are the draft contract that
// openapi.yaml will be written from, so keep them close to what screens need.

export type Role = 'admin' | 'member'

export interface CurrentUser {
  id: string
  displayName: string
  role: Role
  avatarUrl: string | null
}

// Who is using the site. The signed-in user comes only from here, so the
// app cannot hold two versions of it.
export type Session =
  // Nobody is signed in.
  | { status: 'anonymous'; demoSignInAvailable: boolean }
  // The last sign-in was refused: the Discord account is not on the
  // allowlist or was revoked. There is no user and no club data.
  | { status: 'denied'; demoSignInAvailable: boolean }
  | { status: 'signedIn'; user: CurrentUser }

export interface MemberSummary {
  id: string
  displayName: string
  avatarUrl: string | null
}

export interface BookSummary {
  id: string
  title: string
  authors: string[]
  coverUrl: string | null
}

export interface ReadingWeek {
  id: string
  weekNumber: number
  percentStart: number
  percentEnd: number
  pageStart: number
  pageEnd: number
  // ISO 8601 date-time of the linked meeting, if any.
  meetingStartsAt: string | null
  completedByMe: boolean
}

// The reading assigned for a meeting. Percent and pages are independent
// facts set by the curator; the frontend shows them as returned.
export interface MeetingAssignment {
  weekNumber: number
  percentStart: number
  percentEnd: number
  pageStart: number
  pageEnd: number
}

export interface NextMeeting {
  id: string
  startsAt: string
  book: BookSummary | null
  assignment: MeetingAssignment | null
}

export interface MemberProgress {
  member: MemberSummary
  completed: boolean
}

export type ActivityType =
  | 'book_selected'
  | 'vote_opened'
  | 'vote_closed'
  | 'nomination_added'
  | 'summary_published'
  | 'review_available'

export interface ActivityEvent {
  id: string
  type: ActivityType
  occurredAt: string
  // Ready-to-display Spanish text. The API composes it after applying
  // spoiler rules, so the frontend never sees gated details.
  text: string
}

export interface ClubStats {
  booksCompleted: number
  reviews: number
  members: number
}

export interface LiteraryQuote {
  text: string
  source: string | null
}

export interface HomeData {
  currentBook: BookSummary | null
  currentWeek: ReadingWeek | null
  nextMeeting: NextMeeting | null
  memberProgress: MemberProgress[]
  recentActivity: ActivityEvent[]
  stats: ClubStats
  quote: LiteraryQuote | null
}

// Club status of a book, set by an admin (#13). «Elegido» is a book chosen
// but not started yet.
export type BookStatus = 'propuesto' | 'elegido' | 'leyendo' | 'terminado' | 'archivado'

// A book in Biblioteca. Dates are calendar dates (YYYY-MM-DD) without a
// timezone; either may be unknown. Ratings, reviews and their counts are
// gated (§5.5) and never part of these shapes.
export interface LibraryBook extends BookSummary {
  status: BookStatus
  readingStartDate: string | null
  readingEndDate: string | null
  // The dates are the club's best guess (e.g. books read before the site).
  datesApproximate: boolean
}

// One week of the reading plan. Percent and pages are independent facts set
// by the curator; the frontend shows them as returned (§5.2).
export interface ScheduleWeek {
  id: string
  weekNumber: number
  percentStart: number
  percentEnd: number
  pageStart: number
  pageEnd: number
  // Calendar date (YYYY-MM-DD) when there is no linked meeting to read for.
  dueDate: string | null
  meeting: { id: string; startsAt: string } | null
  notes: string | null
}

// A meeting about the book. Its summary and highlights are gated and live
// on the meeting page (#65), not here.
export interface BookMeeting {
  id: string
  // ISO 8601 date-time.
  startsAt: string
  cancelled: boolean
  weekNumber: number | null
}

// The vote the book came from, with a short ready-to-display Spanish label.
export interface OriginVote {
  id: string
  label: string
}

export interface BookDetail extends LibraryBook {
  // Plain text, never HTML.
  description: string | null
  // Free text as entered, e.g. "1884–1885".
  publicationDate: string | null
  publisher: string | null
  isbn: string | null
  pageCount: number | null
  schedule: ScheduleWeek[]
  meetings: BookMeeting[]
  originVote: OriginVote | null
}

// A meeting in Reuniones. The server decides whether it is upcoming or past
// with its own clock; the frontend never compares dates itself.
export interface MeetingListItem {
  id: string
  // ISO 8601 date-time.
  startsAt: string
  cancelled: boolean
  // null for a meeting that is not about a book.
  book: BookSummary | null
  assignment: MeetingAssignment | null
}

// Upcoming meetings soonest first, past meetings most recent first.
// Summaries and highlights are never part of the list.
export interface MeetingList {
  upcoming: MeetingListItem[]
  past: MeetingListItem[]
}

export type HighlightKind = 'quote' | 'paraphrase'

// A published highlight. Plain text, never HTML.
export interface MeetingHighlight {
  id: string
  text: string
  kind: HighlightKind
  speakers: MemberSummary[]
}

// What the signed-in user may see of the meeting's summary and highlights,
// decided by the server (§5.3). The locked shapes carry no summary or
// highlights at all, not even empty ones, so nothing gated reaches the browser.
export type MeetingRecord =
  // Plain-text summary, or null when none is published; published highlights
  // in display order. Drafts are never returned.
  | { status: 'visible'; summary: string | null; highlights: MeetingHighlight[] }
  // The meeting's linked week, which the user has not marked as read.
  | { status: 'lockedWeekNotRead'; weekNumber: number }
  // No linked week, and the admin has not marked the meeting safe.
  | { status: 'lockedNoWeek' }

export interface MeetingDetail extends MeetingListItem {
  upcoming: boolean
  // Who attended, or null while the admin has not recorded it.
  attendance: MemberSummary[] | null
  record: MeetingRecord
}

// Votes (§5.4). Approval voting: a member approves any number of candidates,
// one vote each. Votes are public, so every member gets the same data; only
// `approvedByMe` depends on who is signed in.
export type VoteStatus = 'draft' | 'open' | 'closed'

// A candidate book with the brief metadata shown on the ballot.
export interface VoteCandidateBook extends BookSummary {
  // Free text as entered, e.g. "1884–1885".
  publicationDate: string | null
  pageCount: number | null
}

export interface VoteCandidate {
  book: VoteCandidateBook
  // Everyone who approved this candidate. Empty while the vote is a draft.
  approvals: MemberSummary[]
  approvedByMe: boolean
}

// How a closed vote ended, decided by the server; the frontend never
// computes a winner. A tie is resolved by hand (no automatic tie-break), so
// a closed vote may still be waiting for the club's decision.
export type VoteOutcome =
  // `tieNote` is plain text, or null when there was no tie.
  | { status: 'winner'; winner: BookSummary; tieNote: string | null }
  // The book ids of the tied candidates; there is no winner yet.
  | { status: 'tiePending'; tiedBookIds: string[] }

export interface Vote {
  id: string
  status: VoteStatus
  curator: MemberSummary
  // ISO 8601 date-times: null while a draft, and until it is closed.
  openedAt: string | null
  closedAt: string | null
  // In shortlist order, in every status.
  candidates: VoteCandidate[]
  // null unless the vote is closed.
  outcome: VoteOutcome | null
  // What the signed-in user may do with this vote, decided by the server
  // (#91). The frontend shows controls from these flags only; the backend
  // enforces every rule.
  // Edit the shortlist, open and close: the current curator or the admin,
  // while the vote is a draft or open.
  canManage: boolean
  // Record the book the club chose: the admin only, while a tie is pending.
  canRecordTieWinner: boolean
  // Whether the signed-in user is this vote's curator.
  curatedByMe: boolean
}

// A closed vote in the history list.
export interface VoteHistoryItem {
  id: string
  curator: MemberSummary
  openedAt: string
  closedAt: string
  outcome: VoteOutcome
  candidateCount: number
}

export interface VotesOverview {
  // The member currently assigned as curator, or null if none is.
  curator: MemberSummary | null
  // The draft or open vote, if any. There is at most one.
  current: Vote | null
  // Every closed vote, most recently closed first.
  history: VoteHistoryItem[]
  // Whether the signed-in user may start a draft vote: the current curator
  // or the admin, when a curator is assigned and no vote is draft or open.
  canCreateVote: boolean
}

// Ratings and reviews (§5.5). The five mandatory criteria, always in this order.
export type Criterion = 'disfrute' | 'estilo' | 'personajes' | 'trama' | 'huella'

// One score per criterion: 1 to 5 in steps of 0.5.
export type CriterionScores = Record<Criterion, number>

// The signed-in user's own review. They always get it, whatever the gate says.
export interface MyReview {
  scores: CriterionScores
  // Unweighted mean of the five scores, not rounded.
  overall: number
  // Plain text, never HTML; null when there is none.
  text: string | null
  // ISO 8601 date-times; editedAt is null until the first edit.
  submittedAt: string
  editedAt: string | null
}

// A member's review, only sent once the gate is passed.
export interface ClubReview {
  member: MemberSummary
  scores: CriterionScores
  overall: number
  // Plain text, never HTML; null when there is none.
  text: string | null
  isMine: boolean
}

// What the signed-in user may see of the club's ratings, decided by the
// server (§5.5). The locked shape carries nothing else at all: no count,
// mean, name, score or text, not even empty ones.
export type ClubRatings =
  | { status: 'locked' }
  | {
      status: 'visible'
      // `n`: the number of submitted reviews.
      reviewCount: number
      // Mean of every review's overall, each member weighted equally.
      overallMean: number
      criterionMeans: CriterionScores
      // The user's own review first, then the others by display name.
      // Never ordered by score.
      reviews: ClubReview[]
    }

export interface BookRatings {
  book: BookSummary
  // Whether the book is an official club read that can be rated.
  ratable: boolean
  // The user's «He terminado el libro» flag, separate from weekly reading.
  finishedByMe: boolean
  myReview: MyReview | null
  club: ClubRatings
}

// The admin-written meaning of each whole-star anchor (§5.5), or null where
// there is none. Not gated: the same for everyone.
export type RubricAnchors = Record<1 | 2 | 3 | 4 | 5, string | null>
export type RatingRubric = Record<Criterion, RubricAnchors>

export interface ReviewInput {
  scores: CriterionScores
  // Plain text; trimmed by the server, and a blank text is saved as null.
  text: string | null
}
