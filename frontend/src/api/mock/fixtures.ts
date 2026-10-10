// Fictional club data for the mock API. The members are invented; the books
// and quotes are public-domain works. Never put real club data here.

import type { BookDetail, CriterionScores, CurrentUser, LiteraryQuote, MemberSummary, RatingRubric } from '../types'

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

export interface MockVoteCandidate {
  bookId: string
  // Member ids who approved this candidate, at most once each.
  approverIds: string[]
}

export interface MockVote {
  id: string
  status: 'draft' | 'open' | 'closed'
  curatorId: string
  openedAt: string | null
  closedAt: string | null
  // In shortlist order.
  candidates: MockVoteCandidate[]
  // Recorded by the server when the vote closes (a tie-break is entered by
  // hand, #91); null while draft or open.
  outcome: { winnerBookId: string; tieNote: string | null } | { tiedBookIds: string[] } | null
}

// A member's review of a book, at most one per member and book.
export interface MockReview {
  bookId: string
  userId: string
  scores: CriterionScores
  // Plain text, trimmed; null when there is none.
  text: string | null
  submittedAt: string
  editedAt: string | null
}

// A member's website-native profile (§3, #69). Plain text; favourites are
// ids of books the club has read («terminado» or «archivado»), at most 5.
export interface MockProfile {
  bio: string | null
  favouriteQuote: string | null
  favouriteBookIds: string[]
}

export type MockMember = MemberSummary & { role: CurrentUser['role'] }

// A member's allowlist entry (#8, #70), keyed by member id. Only
// Administración reads it; no member-facing call does. The Discord ids are
// fictional, and are written with leading zeros so that none of them can be
// a real Discord account (real ids are far larger numbers).
export interface MockAccount {
  discordId: string
  addedAt: string
  // Set exactly for the members in `revokedMembers`.
  revokedAt: string | null
}

export interface MockState {
  // Whether someone is signed in. When 'signedIn', currentUserId says who.
  // Tests may change it after rendering to simulate an expired session.
  session: 'signedIn' | 'anonymous' | 'denied'
  currentUserId: string
  // Active members only. Every other call reads this list.
  members: MockMember[]
  // Members whose access was revoked (#7). Kept apart, so they are absent
  // from every call; only Miembros looks them up, to give the same 404 as an
  // unknown id (#69).
  revokedMembers: MockMember[]
  // memberId -> allowlist entry, for every active and revoked member (#70).
  accounts: Record<string, MockAccount>
  // memberId -> profile (#69). A member without an entry has an empty profile.
  profiles: Record<string, MockProfile>
  books: MockBook[]
  weeks: MockWeek[]
  meetings: MockMeeting[]
  // weekId -> member ids who marked it read
  completions: Record<string, string[]>
  activity: MockActivity[]
  // The member assigned as curator (an assignment, not a role, §3), if any.
  curatorId: string | null
  votes: MockVote[]
  // Inicio's club-wide review count; it stays as it is (#44 computes it).
  reviewCount: number
  // bookId -> ids of the members who marked «He terminado el libro». This is
  // separate from the weekly completions (§5.2, decision 43).
  finished: Record<string, string[]>
  reviews: MockReview[]
  // Written by the admin (#70); every anchor is null until then.
  rubric: RatingRubric
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
    revokedMembers: [{ id: 'm8', displayName: 'Tomás', avatarUrl: null, role: 'member' }],
    accounts: {
      m1: { discordId: '000000000000000101', addedAt: '2025-09-01T18:00:00+02:00', revokedAt: null },
      m2: { discordId: '000000000000000102', addedAt: '2025-09-02T19:30:00+02:00', revokedAt: null },
      m3: { discordId: '000000000000000103', addedAt: '2025-09-02T19:35:00+02:00', revokedAt: null },
      m4: { discordId: '000000000000000104', addedAt: '2025-09-03T20:00:00+02:00', revokedAt: null },
      m5: { discordId: '000000000000000105', addedAt: '2025-09-10T18:15:00+02:00', revokedAt: null },
      m6: { discordId: '000000000000000106', addedAt: '2025-10-01T21:00:00+02:00', revokedAt: null },
      m7: { discordId: '000000000000000107', addedAt: '2026-09-15T17:45:00+02:00', revokedAt: null },
      m8: { discordId: '000000000000000108', addedAt: '2025-09-03T20:05:00+02:00', revokedAt: '2026-06-15T19:00:00+02:00' },
    },
    // One case per profile display (frontend/README.md «Fixture members»).
    profiles: {
      // Short bio, a quote and two favourites (the default admin's own profile).
      m1: {
        bio: 'Organizo las reuniones y siempre llevo demasiados marcapáginas.',
        favouriteQuote: 'Leer es viajar sin moverse de la silla.',
        favouriteBookIds: ['b1', 'b2'],
      },
      // No bio; a quote and one favourite with a long title (the default member).
      m2: {
        bio: null,
        favouriteQuote: 'Un libro abierto es un cerebro que habla.',
        favouriteBookIds: ['b14'],
      },
      // Full profile: two paragraphs with literal markup, a quote and three favourites.
      m3: {
        bio:
          'Leo por las noches, con té y una lámpara pequeña.\n' +
          'Me gustan las novelas largas y escribir <b>en negrita</b> no funciona aquí: <script>alert("hola")</script>',
        favouriteQuote: 'Sea lo que sea de lo que estén hechas nuestras almas,\nla suya y la mía son iguales.',
        favouriteBookIds: ['b2', 'b12', 'b14'],
      },
      // Empty profile: no bio, no quote and no favourites.
      m4: { bio: null, favouriteQuote: null, favouriteBookIds: [] },
      // Long bio (over 400 characters) with no quote.
      m5: {
        bio:
          'Llegué al club casi por casualidad, una tarde de lluvia en la que una amiga me prestó un libro viejo con las ' +
          'esquinas dobladas y me dijo que lo terminara antes del jueves. Desde entonces no he faltado a casi ninguna ' +
          'reunión. Me gustan los clásicos que asustan un poco por su tamaño, las cartas entre personajes, los ' +
          'narradores que no se fían de nadie y las conversaciones que empiezan hablando de un capítulo y terminan ' +
          'hablando de la vida. Leo despacio, subrayo a lápiz y apunto en los márgenes las palabras que no conozco ' +
          'para buscarlas después.',
        favouriteQuote: null,
        favouriteBookIds: ['b13'],
      },
      // A bio and a quote, but no favourites yet.
      m6: {
        bio: 'Curador de esta temporada. Prefiero los libros que se discuten.',
        favouriteQuote: 'Donde hay libros, hay conversación.',
        favouriteBookIds: [],
      },
      // A bio and two favourites (one archived), no quote.
      m7: {
        bio: 'Recién llegada al club, con muchas ganas de descubrir clásicos.',
        favouriteQuote: null,
        favouriteBookIds: ['b6', 'b1'],
      },
      // The revoked member's profile is kept but never returned.
      m8: {
        bio: 'Tomás ya no forma parte del club.',
        favouriteQuote: 'Cita de Tomás que nunca debe aparecer.',
        favouriteBookIds: ['b12'],
      },
    },
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
      book({ id: 'b4', title: 'Pepita Jiménez', authors: ['Juan Valera'], status: 'elegido', publicationDate: '1874', pageCount: 240 }),
      book({ id: 'b5', title: 'Los pazos de Ulloa', authors: ['Emilia Pardo Bazán'], status: 'propuesto' }),
      book({
        id: 'b6',
        title: 'Ángel Guerra',
        authors: ['Benito Pérez Galdós'],
        status: 'archivado',
        readingEndDate: '2023-06-15',
        datesApproximate: true,
      }),
      // Candidates of Jordi's open vote (v2).
      book({
        id: 'b7',
        title: 'Marianela',
        authors: ['Benito Pérez Galdós'],
        coverUrl: '/covers/marianela.svg',
        status: 'propuesto',
        publicationDate: '1878',
        pageCount: 256,
      }),
      book({ id: 'b8', title: 'La gaviota', authors: ['Fernán Caballero'], status: 'propuesto', publicationDate: '1849', pageCount: 412 }),
      book({
        id: 'b9',
        title: 'La vida del Buscón llamado don Pablos, ejemplo de vagamundos y espejo de tacaños',
        authors: ['Francisco de Quevedo'],
        status: 'propuesto',
        publicationDate: '1626',
        pageCount: 198,
      }),
      // Proposed books that are not in any vote yet, so the curator can add them (#91).
      book({ id: 'b10', title: 'Doña Perfecta', authors: ['Benito Pérez Galdós'], status: 'propuesto', publicationDate: '1876', pageCount: 288 }),
      book({ id: 'b11', title: 'Sotileza', authors: ['José María de Pereda'], status: 'propuesto', publicationDate: '1885' }),
      // Earlier club reads with no weekly plan, so Estadísticas has enough
      // ratings for every highlight (#68). Archived, so Inicio's count of
      // «terminado» books is unchanged.
      book({
        id: 'b12',
        title: 'Fortunata y Jacinta',
        authors: ['Benito Pérez Galdós'],
        status: 'archivado',
        readingStartDate: '2025-05-03',
        readingEndDate: '2025-07-19',
        publicationDate: '1887',
      }),
      book({
        id: 'b13',
        title: 'El sí de las niñas',
        authors: ['Leandro Fernández de Moratín'],
        status: 'archivado',
        readingStartDate: '2025-09-06',
        readingEndDate: '2025-10-11',
        publicationDate: '1806',
      }),
      book({
        id: 'b14',
        title: 'El ingenioso hidalgo don Quijote de la Mancha',
        authors: ['Miguel de Cervantes'],
        status: 'archivado',
        readingStartDate: '2025-11-08',
        readingEndDate: '2026-06-27',
        publicationDate: '1605',
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
      { id: 'a5', type: 'vote_opened', occurredAt: '2026-09-30T20:00:00+02:00', text: 'Se ha abierto la votación de Jordi.' },
    ],
    curatorId: 'm6',
    votes: [
      // The current vote, in shortlist order. Neither the admin (m1) nor the
      // default member (m2) has approved «Marianela», so either can add a sixth vote.
      {
        id: 'v2',
        status: 'open',
        curatorId: 'm6',
        openedAt: '2026-09-30T20:00:00+02:00',
        closedAt: null,
        candidates: [
          { bookId: 'b7', approverIds: ['m3', 'm4', 'm5', 'm6', 'm7'] },
          { bookId: 'b5', approverIds: ['m1', 'm4'] },
          { bookId: 'b8', approverIds: [] },
          { bookId: 'b9', approverIds: ['m2'] },
        ],
        outcome: null,
      },
      // Carmen's vote: «La Regenta» and «Pepita Jiménez» tied, and the club
      // chose by hand («Pepita Jiménez» is set aside for later).
      {
        id: 'v1',
        status: 'closed',
        curatorId: 'm3',
        openedAt: '2026-09-01T20:00:00+02:00',
        closedAt: '2026-09-14T21:00:00+02:00',
        candidates: [
          { bookId: 'b4', approverIds: ['m2', 'm4', 'm6', 'm7'] },
          { bookId: 'b3', approverIds: ['m1', 'm3', 'm5', 'm6'] },
          { bookId: 'b5', approverIds: ['m3'] },
        ],
        outcome: {
          winnerBookId: 'b3',
          tieNote:
            'Empate a cuatro votos entre «La Regenta» y «Pepita Jiménez».\n' +
            'Lo decidimos entre todos a mano alzada. «Pepita Jiménez» queda elegida para después.',
        },
      },
      // The club's first vote, before the first gathering: a clear winner.
      {
        id: 'v0',
        status: 'closed',
        curatorId: 'm4',
        openedAt: '2024-09-12T20:00:00+02:00',
        closedAt: '2024-09-26T21:00:00+02:00',
        candidates: [
          { bookId: 'b1', approverIds: ['m1', 'm4'] },
          { bookId: 'b2', approverIds: ['m1', 'm3', 'm5', 'm6', 'm7'] },
          { bookId: 'b8', approverIds: ['m2'] },
        ],
        outcome: { winnerBookId: 'b2', tieNote: null },
      },
    ],
    reviewCount: 12,
    finished: {
      // Elena (m7) has finished it but not rated it; the default member
      // (Mateo, m2) has not finished it, so it is locked for him.
      b2: ['m1', 'm3', 'm5', 'm6', 'm7'],
      // The default admin (m1) has finished it but not rated it.
      b1: ['m1', 'm2', 'm4', 'm7'],
      // Carmen read ahead and has finished the book the club is reading.
      b3: ['m3'],
      // Earlier reads (#68). Jordi (m6) has finished «Fortunata y Jacinta»
      // but not rated it.
      b12: ['m1', 'm3', 'm4', 'm6', 'm7'],
      b13: ['m1', 'm3', 'm5'],
      // Read by the default admin and the default member only.
      b14: ['m1', 'm2'],
    },
    reviews: [
      // «Cumbres borrascosas»: visible for the default admin, n = 4.
      review('b2', 'm1', [5, 4.5, 3, 4, 2.5], {
        text: 'Me atrapó desde el principio, aunque el final se me hizo largo.',
        submittedAt: '2024-12-02T21:10:00+01:00',
      }),
      review('b2', 'm3', [4, 5, 4.5, 3.5, 5], {
        text:
          'Heathcliff me pareció <b>insoportable</b> y fascinante a la vez.\n' +
          'El páramo es el mejor personaje del libro.\n' +
          '<script>alert("hola")</script> no es más que texto aquí.',
        submittedAt: '2024-12-01T18:00:00+01:00',
        editedAt: '2025-01-15T10:30:00+01:00',
      }),
      review('b2', 'm5', [3, 3.5, 5, 4, 4.5], { submittedAt: '2024-12-03T09:00:00+01:00' }),
      review('b2', 'm6', [4, 4, 4, 4.5, 3.5], {
        text:
          'Lo leí con calma, un capítulo cada noche, y creo que es la mejor manera de hacerlo. La estructura de ' +
          'narradores dentro de narradores me despistó al principio: Lockwood cuenta lo que le cuenta Nelly, que a ' +
          'su vez cuenta lo que le contaron otros, y a veces no sabía muy bien a quién creer. Con el tiempo entendí ' +
          'que esa desconfianza es parte del juego.\n\n' +
          'Lo que más me ha quedado es la segunda generación: Cathy, Hareton y Linton repiten y a la vez deshacen ' +
          'los errores de sus padres. Me habría gustado comentarlo más en la reunión.',
        submittedAt: '2026-09-10T11:30:00+02:00',
      }),
      // «Niebla»: visible for the default member, n = 3.
      review('b1', 'm2', [4, 4.5, 3.5, 3, 4], {
        text: 'Augusto Pérez discutiendo con Unamuno es de lo mejor que hemos leído.',
        submittedAt: '2025-04-11T22:00:00+02:00',
      }),
      review('b1', 'm4', [5, 5, 4.5, 4, 5], { submittedAt: '2025-04-12T10:00:00+02:00' }),
      review('b1', 'm7', [3.5, 4, 3, 2.5, 3.5], {
        text: 'Me gustó la idea más que la novela.',
        submittedAt: '2025-04-13T17:45:00+02:00',
      }),
      // «La Regenta»: locked for the default admin, who has not finished it.
      review('b3', 'm3', [4.5, 5, 4, 3.5, 5], {
        text: 'Ya la había leído hace años y la he disfrutado aún más.',
        submittedAt: '2026-10-05T20:00:00+02:00',
      }),
      // «Fortunata y Jacinta»: n = 4 (#68).
      review('b12', 'm1', [5, 5, 4.5, 4.5, 5], { submittedAt: '2025-07-20T19:00:00+02:00' }),
      review('b12', 'm3', [4.5, 5, 5, 4, 4.5], {
        text: 'Larga, pero cada página tiene vida.',
        submittedAt: '2025-07-21T21:15:00+02:00',
      }),
      review('b12', 'm4', [4, 4.5, 4, 4, 4], { submittedAt: '2025-07-22T09:30:00+02:00' }),
      review('b12', 'm7', [5, 4.5, 5, 4, 4.5], { submittedAt: '2025-07-23T18:00:00+02:00' }),
      // «El sí de las niñas»: n = 3, with very different opinions (#68).
      review('b13', 'm1', [2, 2.5, 2, 3, 2], {
        text: 'No conseguí entrar en la obra.',
        submittedAt: '2025-10-12T20:00:00+02:00',
      }),
      review('b13', 'm3', [4.5, 4, 4, 4.5, 4.5], { submittedAt: '2025-10-13T10:00:00+02:00' }),
      review('b13', 'm5', [3, 3, 2.5, 3.5, 3], { submittedAt: '2025-10-14T22:30:00+02:00' }),
      // «El ingenioso hidalgo don Quijote de la Mancha»: n = 2 (#68).
      review('b14', 'm1', [4.5, 4, 4, 3.5, 5], { submittedAt: '2026-06-28T12:00:00+02:00' }),
      review('b14', 'm2', [4, 3.5, 4.5, 3, 4], {
        text: 'Mejor de lo que esperaba.',
        submittedAt: '2026-06-29T17:00:00+02:00',
      }),
    ],
    rubric: emptyRubric(),
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

// A review with the scores in criterion order (disfrute, estilo,
// personajes, trama, huella), no text and never edited unless given.
function review(
  bookId: string,
  userId: string,
  [disfrute, estilo, personajes, trama, huella]: [number, number, number, number, number],
  fields: Pick<MockReview, 'submittedAt'> & Partial<MockReview>,
): MockReview {
  return { bookId, userId, scores: { disfrute, estilo, personajes, trama, huella }, text: null, editedAt: null, ...fields }
}

// No anchor has a description: the owner writes them (§5.5, #70). Never
// put plausible rubric text here.
export function emptyRubric(): RatingRubric {
  const anchors = () => ({ 1: null, 2: null, 3: null, 4: null, 5: null })
  return { disfrute: anchors(), estilo: anchors(), personajes: anchors(), trama: anchors(), huella: anchors() }
}

const RUBRIC_EXAMPLE_LABELS = { disfrute: 'Disfrute', estilo: 'Estilo', trama: 'Trama', huella: 'Huella' } as const

// Dev-only (?mock-rubric=ejemplo, see devOptions.ts): fills the 2, 3 and 4
// star anchors of every criterion except Personajes with text that is
// obviously a placeholder, never a real meaning. So 3 shows one anchor, 3,5
// shows two, 1,5 and 4,5 show one and 5 or Personajes show none.
export function applyRubricExample(state: MockState): MockState {
  for (const [criterion, label] of Object.entries(RUBRIC_EXAMPLE_LABELS)) {
    for (const stars of [2, 3, 4] as const) {
      state.rubric[criterion as keyof typeof RUBRIC_EXAMPLE_LABELS][stars] =
        `[Texto de ejemplo] ${label}, ${stars} estrellas`
    }
  }
  return state
}

// A club that has just started: no books, meetings, reviews or quotes yet.
export function createEmptyState(): MockState {
  const club = createClubState()
  return {
    ...club,
    members: club.members.slice(0, 1),
    revokedMembers: [],
    accounts: { m1: club.accounts.m1 },
    profiles: {},
    books: [],
    weeks: [],
    meetings: [],
    completions: {},
    activity: [],
    curatorId: null,
    votes: [],
    reviewCount: 0,
    finished: {},
    reviews: [],
    rubric: emptyRubric(),
    quotes: [],
  }
}

// Dev-only variants of the current vote (?mock-vote=, see devOptions.ts).
export type VoteScenario = 'draft' | 'tie' | 'none' | 'open-tie'

// Changes Jordi's vote (v2) in the default fixtures:
// - draft: not opened yet, with its shortlist and no approvals;
// - tie: closed with a tie pending between «Marianela» and «Los pazos de
//   Ulloa», so there is no current vote and it heads the history;
// - none: removed; Jordi is still the curator;
// - open-tie: still open, with «Marianela» and «Los pazos de Ulloa» tied at
//   five votes each, so closing it gives a pending tie (#91).
export function applyVoteScenario(state: MockState, scenario: VoteScenario): MockState {
  const vote = state.votes.find((v) => v.id === 'v2')
  if (!vote) return state
  const opened = state.activity.find((a) => a.id === 'a5')!
  if (scenario === 'draft') {
    vote.status = 'draft'
    vote.openedAt = null
    for (const candidate of vote.candidates) candidate.approverIds = []
    opened.type = 'nomination_added'
    opened.text = 'Jordi está preparando una nueva votación.'
  } else if (scenario === 'open-tie') {
    vote.candidates.find((c) => c.bookId === 'b5')!.approverIds = ['m1', 'm2', 'm3', 'm4', 'm5']
  } else if (scenario === 'tie') {
    vote.status = 'closed'
    vote.closedAt = '2026-10-07T21:00:00+02:00'
    vote.candidates.find((c) => c.bookId === 'b5')!.approverIds = ['m1', 'm2', 'm3', 'm4', 'm5']
    vote.outcome = { tiedBookIds: ['b7', 'b5'] }
    state.activity.push({
      id: 'a6',
      type: 'vote_closed',
      occurredAt: '2026-10-07T21:00:00+02:00',
      text: 'Se ha cerrado la votación de Jordi con un empate.',
    })
  } else {
    state.votes = state.votes.filter((v) => v !== vote)
    state.activity = state.activity.filter((a) => a !== opened)
  }
  return state
}
