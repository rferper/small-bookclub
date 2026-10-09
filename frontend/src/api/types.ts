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
