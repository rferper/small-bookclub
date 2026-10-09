import { ApiError, type ApiClient } from '../client'
import type {
  BookDetail,
  BookSummary,
  HomeData,
  LibraryBook,
  MeetingAssignment,
  MeetingDetail,
  MeetingList,
  MeetingListItem,
  MeetingRecord,
  MemberSummary,
  NextMeeting,
  ReadingWeek,
  Session,
} from '../types'
import { createClubState, type MockBook, type MockMeeting, type MockState } from './fixtures'
import { meetingGate } from './meetingGate'

type Method = keyof ApiClient

// Who is using the mock: nobody, a fixture member or admin, or a refused account.
export type MockSession = 'anonymous' | 'member' | 'admin' | 'denied'

export interface MockOptions {
  state?: MockState
  // Starting session. Omitted, the mock is signed in as state.currentUserId
  // (the fixture admin by default).
  session?: MockSession
  // Where startSignIn() leads, as if the Discord round trip had finished.
  signInResult?: Exclude<MockSession, 'anonymous'>
  // Whether anonymous and denied sessions offer the demo sign-in (#75).
  demoSignInAvailable?: boolean
  // Injected so tests can pick a quote deterministically.
  random?: () => number
  // How many calls of each method fail (with a 500 ApiError) before they
  // start succeeding. Use Infinity for a method that always fails.
  failures?: Partial<Record<Method, number>>
}

// In-memory stand-in for the backend. It returns the same shapes the real
// API will, including leaving out data the user may not see.
export function createMockClient({
  state = createClubState(),
  session,
  signInResult = 'member',
  demoSignInAvailable = false,
  random = Math.random,
  failures = {},
}: MockOptions = {}): ApiClient {
  const remainingFailures: Partial<Record<Method, number>> = { ...failures }
  const failIfConfigured = (method: Method) => {
    const left = remainingFailures[method] ?? 0
    if (left > 0) {
      remainingFailures[method] = left - 1
      throw new ApiError(500, 'Error simulado del servidor.')
    }
  }

  const switchSession = (to: MockSession) => {
    if (to === 'anonymous' || to === 'denied') {
      state.session = to
      return
    }
    const user = state.members.find((m) => m.role === to)
    if (!user) throw new Error(`The mock state has no ${to} to sign in as.`)
    state.session = 'signedIn'
    state.currentUserId = user.id
  }
  if (session) switchSession(session)

  // Like the backend: club data only for a signed-in member, never partial data.
  const requireSignedIn = () => {
    if (state.session !== 'signedIn') throw new ApiError(401, 'No has iniciado sesión.')
  }

  const toBookSummary = (bookId: string | null): BookSummary | null => {
    const book = state.books.find((b) => b.id === bookId)
    return book ? { id: book.id, title: book.title, authors: book.authors, coverUrl: book.coverUrl } : null
  }

  // Catalogue fields only: no metadata, ratings or review counts.
  const toLibraryBook = (book: MockBook): LibraryBook => ({
    id: book.id,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    status: book.status,
    readingStartDate: book.readingStartDate,
    readingEndDate: book.readingEndDate,
    datesApproximate: book.datesApproximate,
  })

  const toAssignment = (meetingId: string): MeetingAssignment | null => {
    const week = state.weeks.find((w) => w.meetingId === meetingId)
    return week
      ? {
          weekNumber: week.weekNumber,
          percentStart: week.percentStart,
          percentEnd: week.percentEnd,
          pageStart: week.pageStart,
          pageEnd: week.pageEnd,
        }
      : null
  }

  const toMemberSummaries = (ids: string[]): MemberSummary[] =>
    ids.flatMap((id) => {
      const member = state.members.find((m) => m.id === id)
      return member ? [{ id: member.id, displayName: member.displayName, avatarUrl: member.avatarUrl }] : []
    })

  // Like the server: upcoming from now on, by its own clock (state.now).
  const isUpcoming = (meeting: MockMeeting) => Date.parse(meeting.startsAt) >= Date.parse(state.now)

  const toMeetingListItem = (meeting: MockMeeting): MeetingListItem => ({
    id: meeting.id,
    startsAt: meeting.startsAt,
    cancelled: meeting.cancelled,
    book: toBookSummary(meeting.bookId),
    assignment: toAssignment(meeting.id),
  })

  // Decided at call time for the signed-in user. Locked records are built
  // without the summary and highlights, so they cannot leak; drafts are
  // left out for everyone, the admin included.
  const toMeetingRecord = (meeting: MockMeeting): MeetingRecord => {
    const week = state.weeks.find((w) => w.meetingId === meeting.id) ?? null
    const gate = meetingGate({
      week,
      markedSafe: meeting.markedSafe,
      completions: state.completions,
      userId: state.currentUserId,
    })
    if (!gate.visible) {
      return gate.reason === 'weekNotRead'
        ? { status: 'lockedWeekNotRead', weekNumber: gate.weekNumber }
        : { status: 'lockedNoWeek' }
    }
    return {
      status: 'visible',
      summary: meeting.summary?.published ? meeting.summary.text : null,
      highlights: meeting.highlights
        .filter((h) => h.published)
        .map((h) => ({ id: h.id, text: h.text, kind: h.kind, speakers: toMemberSummaries(h.speakerIds) })),
    }
  }

  const nextMeeting = () =>
    state.meetings
      .filter((m) => !m.cancelled && m.startsAt >= state.now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null

  return {
    async getSession(): Promise<Session> {
      failIfConfigured('getSession')
      const me = state.members.find((m) => m.id === state.currentUserId)
      if (state.session === 'signedIn' && me) {
        return {
          status: 'signedIn',
          user: { id: me.id, displayName: me.displayName, role: me.role, avatarUrl: me.avatarUrl },
        }
      }
      return { status: state.session === 'denied' ? 'denied' : 'anonymous', demoSignInAvailable }
    },

    async startSignIn(): Promise<void> {
      failIfConfigured('startSignIn')
      switchSession(signInResult)
    },

    async startDemoSignIn(): Promise<void> {
      failIfConfigured('startDemoSignIn')
      // Without demo mode the backend has no demo sign-in at all (#75).
      if (!demoSignInAvailable) throw new ApiError(404, 'No existe.')
      switchSession('member')
    },

    async signOut(): Promise<void> {
      failIfConfigured('signOut')
      state.session = 'anonymous'
    },

    async getHome(): Promise<HomeData> {
      requireSignedIn()
      failIfConfigured('getHome')
      const activeBook = state.books.find((b) => b.status === 'leyendo') ?? null
      const meeting = nextMeeting()
      const week =
        (activeBook && meeting && state.weeks.find((w) => w.bookId === activeBook.id && w.meetingId === meeting.id)) ||
        null
      const doneBy = week ? (state.completions[week.id] ?? []) : []

      const currentWeek: ReadingWeek | null = week && {
        id: week.id,
        weekNumber: week.weekNumber,
        percentStart: week.percentStart,
        percentEnd: week.percentEnd,
        pageStart: week.pageStart,
        pageEnd: week.pageEnd,
        meetingStartsAt: state.meetings.find((m) => m.id === week.meetingId)?.startsAt ?? null,
        completedByMe: doneBy.includes(state.currentUserId),
      }

      const next: NextMeeting | null = meeting && {
        id: meeting.id,
        startsAt: meeting.startsAt,
        book: toBookSummary(meeting.bookId),
        assignment: toAssignment(meeting.id),
      }

      return {
        currentBook: activeBook && toBookSummary(activeBook.id),
        currentWeek,
        nextMeeting: next,
        memberProgress: week
          ? state.members.map(({ id, displayName, avatarUrl }) => ({
              member: { id, displayName, avatarUrl },
              completed: doneBy.includes(id),
            }))
          : [],
        recentActivity: [...state.activity].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
        stats: {
          booksCompleted: state.books.filter((b) => b.status === 'terminado').length,
          reviews: state.reviewCount,
          members: state.members.length,
        },
        quote: state.quotes.length ? state.quotes[Math.floor(random() * state.quotes.length)] : null,
      }
    },

    async setWeekCompleted(weekId: string, completed: boolean): Promise<void> {
      requireSignedIn()
      failIfConfigured('setWeekCompleted')
      if (!state.weeks.some((w) => w.id === weekId)) throw new ApiError(404, 'No existe esa semana de lectura.')
      // Always acts on the signed-in member only, like the real API will.
      const others = (state.completions[weekId] ?? []).filter((id) => id !== state.currentUserId)
      state.completions[weekId] = completed ? [...others, state.currentUserId] : others
    },

    async listBooks(): Promise<LibraryBook[]> {
      requireSignedIn()
      failIfConfigured('listBooks')
      return state.books.map(toLibraryBook)
    },

    async getBook(bookId: string): Promise<BookDetail> {
      requireSignedIn()
      failIfConfigured('getBook')
      const book = state.books.find((b) => b.id === bookId)
      if (!book) throw new ApiError(404, 'No existe ese libro.')
      const meetings = state.meetings.filter((m) => m.bookId === book.id)
      // Meeting summaries and highlights are gated (§5.3) and never sent here.
      return {
        ...toLibraryBook(book),
        description: book.description,
        publicationDate: book.publicationDate,
        publisher: book.publisher,
        isbn: book.isbn,
        pageCount: book.pageCount,
        schedule: state.weeks
          .filter((w) => w.bookId === book.id)
          .sort((a, b) => a.weekNumber - b.weekNumber)
          .map((w) => {
            const meeting = meetings.find((m) => m.id === w.meetingId)
            return {
              id: w.id,
              weekNumber: w.weekNumber,
              percentStart: w.percentStart,
              percentEnd: w.percentEnd,
              pageStart: w.pageStart,
              pageEnd: w.pageEnd,
              dueDate: w.dueDate,
              meeting: meeting ? { id: meeting.id, startsAt: meeting.startsAt } : null,
              notes: w.notes,
            }
          }),
        meetings: [...meetings]
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
          .map((m) => ({
            id: m.id,
            startsAt: m.startsAt,
            cancelled: m.cancelled,
            weekNumber: state.weeks.find((w) => w.meetingId === m.id)?.weekNumber ?? null,
          })),
        originVote: book.originVote,
      }
    },

    async listMeetings(): Promise<MeetingList> {
      requireSignedIn()
      failIfConfigured('listMeetings')
      const byDate = [...state.meetings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      // Cancelled meetings stay in the list their date puts them in. No
      // summaries or highlights here: they live behind getMeeting's gate.
      return {
        upcoming: byDate.filter(isUpcoming).map(toMeetingListItem),
        past: byDate
          .filter((m) => !isUpcoming(m))
          .reverse()
          .map(toMeetingListItem),
      }
    },

    async getMeeting(meetingId: string): Promise<MeetingDetail> {
      requireSignedIn()
      failIfConfigured('getMeeting')
      const meeting = state.meetings.find((m) => m.id === meetingId)
      if (!meeting) throw new ApiError(404, 'No existe esa reunión.')
      return {
        ...toMeetingListItem(meeting),
        upcoming: isUpcoming(meeting),
        attendance: meeting.attendance && toMemberSummaries(meeting.attendance),
        record: toMeetingRecord(meeting),
      }
    },
  }
}
