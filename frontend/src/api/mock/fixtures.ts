// Fictional club data for the mock API. The members are invented; the books
// and quotes are public-domain works. Never put real club data here.

import type { BookSummary, CurrentUser, LiteraryQuote, MemberSummary } from '../types'

export interface MockWeek {
  id: string
  bookId: string
  weekNumber: number
  percentStart: number
  percentEnd: number
  pageStart: number
  pageEnd: number
  meetingId: string | null
}

export interface MockMeeting {
  id: string
  bookId: string
  startsAt: string
  cancelled: boolean
}

export interface MockActivity {
  id: string
  type:
    | 'book_selected'
    | 'vote_opened'
    | 'vote_closed'
    | 'nomination_added'
    | 'summary_published'
    | 'review_available'
  occurredAt: string
  text: string
}

export interface MockState {
  // Whether someone is signed in. When 'signedIn', currentUserId says who.
  // Tests may change it after rendering to simulate an expired session.
  session: 'signedIn' | 'anonymous' | 'denied'
  currentUserId: string
  members: (MemberSummary & { role: CurrentUser['role'] })[]
  books: (BookSummary & { status: 'propuesto' | 'elegido' | 'leyendo' | 'terminado' })[]
  weeks: MockWeek[]
  meetings: MockMeeting[]
  // weekId -> member ids who marked it read
  completions: Record<string, string[]>
  activity: MockActivity[]
  reviewCount: number
  quotes: LiteraryQuote[]
  // Fixed "now" so the mock picks the same current week every time.
  now: string
}

export function createClubState(): MockState {
  return {
    session: 'signedIn',
    currentUserId: 'm1',
    members: [
      { id: 'm1', displayName: 'Lucía', avatarUrl: null, role: 'admin' },
      { id: 'm2', displayName: 'Mateo', avatarUrl: null, role: 'member' },
      { id: 'm3', displayName: 'Carmen', avatarUrl: null, role: 'member' },
      { id: 'm4', displayName: 'Pablo', avatarUrl: null, role: 'member' },
      { id: 'm5', displayName: 'Inés', avatarUrl: null, role: 'member' },
      { id: 'm6', displayName: 'Jordi', avatarUrl: null, role: 'member' },
      { id: 'm7', displayName: 'Elena', avatarUrl: null, role: 'member' },
    ],
    books: [
      { id: 'b1', title: 'Niebla', authors: ['Miguel de Unamuno'], coverUrl: null, status: 'terminado' },
      { id: 'b2', title: 'Cumbres borrascosas', authors: ['Emily Brontë'], coverUrl: null, status: 'terminado' },
      { id: 'b3', title: 'La Regenta', authors: ['Leopoldo Alas «Clarín»'], coverUrl: null, status: 'leyendo' },
    ],
    weeks: [
      { id: 'w1', bookId: 'b3', weekNumber: 1, percentStart: 0, percentEnd: 12, pageStart: 1, pageEnd: 98, meetingId: 'mt1' },
      { id: 'w2', bookId: 'b3', weekNumber: 2, percentStart: 12, percentEnd: 25, pageStart: 99, pageEnd: 204, meetingId: 'mt2' },
      { id: 'w3', bookId: 'b3', weekNumber: 3, percentStart: 25, percentEnd: 40, pageStart: 205, pageEnd: 330, meetingId: 'mt3' },
      { id: 'w4', bookId: 'b3', weekNumber: 4, percentStart: 40, percentEnd: 52, pageStart: 331, pageEnd: 430, meetingId: 'mt4' },
    ],
    meetings: [
      { id: 'mt1', bookId: 'b3', startsAt: '2026-09-24T19:30:00+02:00', cancelled: false },
      { id: 'mt2', bookId: 'b3', startsAt: '2026-10-01T19:30:00+02:00', cancelled: false },
      { id: 'mt3', bookId: 'b3', startsAt: '2026-10-15T19:30:00+02:00', cancelled: false },
      { id: 'mt4', bookId: 'b3', startsAt: '2026-10-22T19:30:00+02:00', cancelled: false },
    ],
    completions: {
      w1: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
      w2: ['m1', 'm2', 'm3', 'm5', 'm6'],
      w3: ['m3', 'm6'],
    },
    activity: [
      { id: 'a1', type: 'summary_published', occurredAt: '2026-10-02T10:00:00+02:00', text: 'Se ha publicado el resumen de la reunión de la semana 2.' },
      { id: 'a2', type: 'book_selected', occurredAt: '2026-09-15T18:00:00+02:00', text: '«La Regenta» es el nuevo libro del club.' },
      { id: 'a3', type: 'vote_closed', occurredAt: '2026-09-14T21:00:00+02:00', text: 'Se ha cerrado la votación de Carmen.' },
      { id: 'a4', type: 'review_available', occurredAt: '2026-09-10T12:00:00+02:00', text: 'Hay una nueva valoración de «Cumbres borrascosas».' },
    ],
    reviewCount: 12,
    quotes: [
      {
        text: 'El que lee mucho y anda mucho, ve mucho y sabe mucho.',
        source: 'Miguel de Cervantes, Don Quijote de la Mancha',
      },
      {
        text: 'Retirado en la paz de estos desiertos, / con pocos, pero doctos libros juntos, / vivo en conversación con los difuntos, / y escucho con mis ojos a los muertos.',
        source: 'Francisco de Quevedo',
      },
    ],
    now: '2026-10-09T12:00:00+02:00',
  }
}

// A club that has just started: no books, meetings, reviews or quotes yet.
export function createEmptyState(): MockState {
  const club = createClubState()
  return {
    ...club,
    members: club.members.slice(0, 1),
    books: [],
    weeks: [],
    meetings: [],
    completions: {},
    activity: [],
    reviewCount: 0,
    quotes: [],
  }
}
