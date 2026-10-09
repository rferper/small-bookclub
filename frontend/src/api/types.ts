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
