import { ApiError, type ApiClient } from '../client'
import type { BookSummary, CurrentUser, HomeData, NextMeeting, ReadingWeek } from '../types'
import { createClubState, type MockState } from './fixtures'

interface MockOptions {
  state?: MockState
  // Injected so tests can pick a quote deterministically.
  random?: () => number
}

// In-memory stand-in for the backend. It returns the same shapes the real
// API will, including leaving out data the user may not see.
export function createMockClient({ state = createClubState(), random = Math.random }: MockOptions = {}): ApiClient {
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
      const me = state.members.find((m) => m.id === state.currentUserId)
      if (!me) throw new ApiError(401, 'No has iniciado sesión.')
      return { id: me.id, displayName: me.displayName, role: me.role, avatarUrl: me.avatarUrl }
    },

    async getHome(): Promise<HomeData> {
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
        weekNumber: state.weeks.find((w) => w.meetingId === meeting.id)?.weekNumber ?? null,
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
      if (!state.weeks.some((w) => w.id === weekId)) throw new ApiError(404, 'No existe esa semana de lectura.')
      // Always acts on the signed-in member only, like the real API will.
      const others = (state.completions[weekId] ?? []).filter((id) => id !== state.currentUserId)
      state.completions[weekId] = completed ? [...others, state.currentUserId] : others
    },
  }
}
