import { ApiError, type ApiClient } from '../client'
import type { BookSummary, CurrentUser, HomeData, NextMeeting, ReadingWeek } from '../types'
import { createClubState, type MockState } from './fixtures'

type Method = keyof ApiClient

export interface MockOptions {
  state?: MockState
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

  const toBookSummary = (bookId: string): BookSummary | null => {
    const book = state.books.find((b) => b.id === bookId)
    return book ? { id: book.id, title: book.title, authors: book.authors, coverUrl: book.coverUrl } : null
  }

  const nextMeeting = () =>
    state.meetings
      .filter((m) => !m.cancelled && m.startsAt >= state.now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null

  return {
    async getCurrentUser(): Promise<CurrentUser> {
      failIfConfigured('getCurrentUser')
      const me = state.members.find((m) => m.id === state.currentUserId)
      if (!me) throw new ApiError(401, 'No has iniciado sesión.')
      return { id: me.id, displayName: me.displayName, role: me.role, avatarUrl: me.avatarUrl }
    },

    async getHome(): Promise<HomeData> {
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

      const meetingWeek = meeting ? state.weeks.find((w) => w.meetingId === meeting.id) : undefined
      const next: NextMeeting | null = meeting && {
        id: meeting.id,
        startsAt: meeting.startsAt,
        book: toBookSummary(meeting.bookId),
        assignment: meetingWeek
          ? {
              weekNumber: meetingWeek.weekNumber,
              percentStart: meetingWeek.percentStart,
              percentEnd: meetingWeek.percentEnd,
              pageStart: meetingWeek.pageStart,
              pageEnd: meetingWeek.pageEnd,
            }
          : null,
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
      failIfConfigured('setWeekCompleted')
      if (!state.weeks.some((w) => w.id === weekId)) throw new ApiError(404, 'No existe esa semana de lectura.')
      // Always acts on the signed-in member only, like the real API will.
      const others = (state.completions[weekId] ?? []).filter((id) => id !== state.currentUserId)
      state.completions[weekId] = completed ? [...others, state.currentUserId] : others
    },
  }
}
