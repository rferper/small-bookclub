// Fictional club data for the mock API. The members are invented; the books
// and quotes are public-domain works. Never put real club data here.

import type { BookDetail, CurrentUser, LiteraryQuote, MemberSummary } from '../types'

export interface MockWeek {
  id: string
  bookId: string
  weekNumber: number
  percentStart: number
  percentEnd: number
  pageStart: number
  pageEnd: number
  meetingId: string | null
  dueDate: string | null
  notes: string | null
}

// A book as the backend stores it: catalogue fields and metadata. The
// schedule and meetings are separate lists, linked by bookId.
export type MockBook = Omit<BookDetail, 'schedule' | 'meetings'>

export interface MockHighlight {
  id: string
  text: string
  kind: 'quote' | 'paraphrase'
  speakerIds: string[]
  // Drafts are only for the admin editor (#70) and never returned.
  published: boolean
}

export interface MockMeeting {
  id: string
  // null for a meeting that is not about a book.
  bookId: string | null
  startsAt: string
  cancelled: boolean
  // Member ids who attended, or null while not recorded.
  attendance: string[] | null
  // Set by the admin for a meeting with no linked week (§5.3).
  markedSafe: boolean
  summary: { text: string; published: boolean } | null
  // In display order.
  highlights: MockHighlight[]
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
  books: MockBook[]
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
      book({
        id: 'b1',
        title: 'Niebla',
        authors: ['Miguel de Unamuno'],
        coverUrl: '/covers/niebla.svg',
        status: 'terminado',
        readingStartDate: '2025-03-01',
        readingEndDate: '2025-04-12',
        publicationDate: '1914',
      }),
      book({
        id: 'b2',
        title: 'Cumbres borrascosas',
        authors: ['Emily Brontë'],
        status: 'terminado',
        readingStartDate: '2024-10-01',
        readingEndDate: '2024-11-30',
        datesApproximate: true,
        originVote: { id: 'v0', label: 'Votación de otoño de 2024' },
      }),
      book({
        id: 'b3',
        title: 'La Regenta',
        authors: ['Leopoldo Alas «Clarín»'],
        status: 'leyendo',
        readingStartDate: '2026-09-15',
        description:
          'En Vetusta, una ciudad de provincias que dormita a la sombra de su catedral, Ana Ozores lleva una vida ' +
          'tranquila y vacía junto a su marido, el antiguo regente de la Audiencia. Entre el magistral Fermín de Pas, ' +
          'que quiere guiar su alma, y el seductor Álvaro Mesía, que quiere conquistarla, Ana busca algo que dé ' +
          'sentido a sus días. Una novela larga, paciente y llena de ironía sobre la vida de una ciudad entera.',
        publicationDate: '1884–1885',
        publisher: 'Editorial Ficticia del Norte',
        isbn: '978-0-00-000000-2',
        pageCount: 864,
        originVote: { id: 'v1', label: 'Votación de Carmen (septiembre de 2026)' },
      }),
      book({ id: 'b4', title: 'Pepita Jiménez', authors: ['Juan Valera'], status: 'elegido' }),
      book({ id: 'b5', title: 'Los pazos de Ulloa', authors: ['Emilia Pardo Bazán'], status: 'propuesto' }),
      book({
        id: 'b6',
        title: 'Ángel Guerra',
        authors: ['Benito Pérez Galdós'],
        status: 'archivado',
        readingEndDate: '2023-06-15',
        datesApproximate: true,
      }),
    ],
    weeks: [
      { id: 'w1', bookId: 'b3', weekNumber: 1, percentStart: 0, percentEnd: 12, pageStart: 1, pageEnd: 98, meetingId: 'mt1', dueDate: null, notes: null },
      { id: 'w2', bookId: 'b3', weekNumber: 2, percentStart: 12, percentEnd: 25, pageStart: 99, pageEnd: 204, meetingId: 'mt2', dueDate: null, notes: null },
      { id: 'w3', bookId: 'b3', weekNumber: 3, percentStart: 25, percentEnd: 40, pageStart: 205, pageEnd: 330, meetingId: 'mt3', dueDate: null, notes: 'Incluye el capítulo XVI completo.' },
      { id: 'w4', bookId: 'b3', weekNumber: 4, percentStart: 40, percentEnd: 52, pageStart: 331, pageEnd: 430, meetingId: 'mt4', dueDate: null, notes: null },
      { id: 'w5', bookId: 'b3', weekNumber: 5, percentStart: 52, percentEnd: 60, pageStart: 431, pageEnd: 520, meetingId: null, dueDate: '2026-10-29', notes: null },
    ],
    meetings: [
      meeting({ id: 'mt0', bookId: 'b3', startsAt: '2026-09-17T19:30:00+02:00', cancelled: true }),
      meeting({
        id: 'mt1',
        bookId: 'b3',
        startsAt: '2026-09-24T19:30:00+02:00',
        attendance: ['m1', 'm2', 'm3', 'm5', 'm6'],
        summary: {
          published: true,
          text:
            'Empezamos «La Regenta» con muchas ganas y algo de miedo a su tamaño. Casi todo el mundo coincidió en que ' +
            'el arranque desde la torre de la catedral es lento pero hipnótico.\n\n' +
            'Hablamos de Vetusta como un personaje más: sus calles, sus casinos y sus chismes. Carmen trajo un plano ' +
            'dibujado a mano para seguir los paseos de los personajes.\n\n' +
            'Para la próxima semana nos propusimos fijarnos en cómo habla cada personaje de Ana Ozores antes de que ella ' +
            'aparezca del todo.',
        },
        highlights: [
          {
            id: 'h1',
            kind: 'quote',
            text: 'Vetusta no es una ciudad, es un estado de ánimo.',
            speakerIds: ['m3'],
            published: true,
          },
          {
            id: 'h2',
            kind: 'paraphrase',
            text: 'El primer capítulo se disfruta más leído en voz alta, como una crónica desde el campanario.',
            speakerIds: ['m3', 'm6'],
            published: true,
          },
          {
            id: 'h3',
            kind: 'paraphrase',
            text: 'Alguien propuso hacer un mapa de Vetusta entre todos para no perderse entre calles y apellidos.',
            speakerIds: [],
            published: true,
          },
          {
            id: 'h4',
            kind: 'quote',
            text: 'Borrador sin publicar sobre la torre de la catedral.',
            speakerIds: ['m2'],
            published: false,
          },
        ],
      }),
      meeting({
        id: 'mt2',
        bookId: 'b3',
        startsAt: '2026-10-01T19:30:00+02:00',
        attendance: ['m1', 'm2', 'm3', 'm5', 'm6', 'm7'],
        summary: {
          published: true,
          text:
            'La segunda semana nos llevó a la confesión y al primer encuentro largo entre Ana y el magistral.\n' +
            'Hubo debate sobre si el narrador se burla de todos por igual.',
        },
        highlights: [
          {
            id: 'h5',
            kind: 'quote',
            text: 'El narrador no perdona a nadie, ni siquiera al lector.',
            speakerIds: ['m2'],
            published: true,
          },
        ],
      }),
      meeting({ id: 'mt3', bookId: 'b3', startsAt: '2026-10-15T19:30:00+02:00' }),
      meeting({ id: 'mt4', bookId: 'b3', startsAt: '2026-10-22T19:30:00+02:00' }),
      // Meetings about earlier books, from before the club used weekly plans.
      meeting({
        id: 'mt5',
        bookId: 'b1',
        startsAt: '2025-04-10T19:30:00+02:00',
        attendance: ['m1', 'm2', 'm4', 'm7'],
        markedSafe: true,
        summary: {
          published: true,
          text: 'Cerramos «Niebla» hablando de Augusto Pérez y de si un personaje puede rebelarse contra su autor.',
        },
        highlights: [
          {
            id: 'h6',
            kind: 'paraphrase',
            text: 'Leer «Niebla» es como discutir con un amigo que siempre tiene otra pregunta.',
            speakerIds: ['m4'],
            published: true,
          },
        ],
      }),
      meeting({
        id: 'mt6',
        bookId: 'b2',
        startsAt: '2024-11-28T19:30:00+01:00',
        attendance: ['m1', 'm3', 'm5', 'm6'],
        summary: {
          published: true,
          text: 'Despedimos «Cumbres borrascosas» con una charla larga sobre Heathcliff y el páramo.',
        },
        highlights: [
          {
            id: 'h7',
            kind: 'quote',
            text: 'Los páramos dan más miedo que cualquier fantasma.',
            speakerIds: ['m5'],
            published: true,
          },
        ],
      }),
      // The club's first gathering, before choosing any book.
      meeting({
        id: 'mt7',
        bookId: null,
        startsAt: '2024-09-26T19:30:00+02:00',
        markedSafe: true,
        summary: { published: false, text: 'Borrador del resumen de la reunión de bienvenida.' },
      }),
    ],
    completions: {
      w1: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
      // The admin (m1) has not read week 2, so the mt2 record is locked for her.
      w2: ['m2', 'm3', 'm5', 'm6'],
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

// A book with only the given fields; every optional one is empty.
function book(fields: Pick<MockBook, 'id' | 'title' | 'authors' | 'status'> & Partial<MockBook>): MockBook {
  return {
    coverUrl: null,
    readingStartDate: null,
    readingEndDate: null,
    datesApproximate: false,
    description: null,
    publicationDate: null,
    publisher: null,
    isbn: null,
    pageCount: null,
    originVote: null,
    ...fields,
  }
}

// A meeting with only the given fields: not cancelled, attendance not
// recorded, not marked safe, and no summary or highlights.
function meeting(fields: Pick<MockMeeting, 'id' | 'bookId' | 'startsAt'> & Partial<MockMeeting>): MockMeeting {
  return { cancelled: false, attendance: null, markedSafe: false, summary: null, highlights: [], ...fields }
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
