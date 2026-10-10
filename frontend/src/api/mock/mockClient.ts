import { ApiError, type ApiClient } from '../client'
import type {
  BookDetail,
  BookRatings,
  BookSummary,
  ClubRatings,
  HomeData,
  LibraryBook,
  MeetingAssignment,
  MeetingDetail,
  MeetingList,
  MeetingListItem,
  MeetingRecord,
  MemberSummary,
  NextMeeting,
  RatingRubric,
  ReadingWeek,
  ReviewInput,
  Session,
  Statistics,
  TasteCompatibility,
  Vote,
  VoteHistoryItem,
  VoteOutcome,
  VotesOverview,
} from '../types'
import { CRITERIA, clubAggregates, isValidScore, REVIEW_TEXT_MAX_LENGTH, reviewOverall } from '../../lib/ratings'
import { MIN_SHARED_BOOKS, tasteCompatibility } from '../../lib/compatibility'
import { ratingStatistics, STATISTICS_THRESHOLDS } from '../../lib/statistics'
import { createClubState, type MockBook, type MockMeeting, type MockReview, type MockState, type MockVote } from './fixtures'
import { meetingGate } from './meetingGate'
import { ratingGate } from './ratingGate'
import { countedReviews } from './statisticsGate'

type Method = keyof ApiClient

// Who is using the mock: nobody, a fixture member or admin, the current
// curator (a member with the `member` role), or a refused account.
export type MockSession = 'anonymous' | 'member' | 'admin' | 'curator' | 'denied'

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
    // Curator is an assignment, not a role (§3).
    const user = to === 'curator' ? state.members.find((m) => m.id === state.curatorId) : state.members.find((m) => m.role === to)
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

  const toVoteOutcome = (vote: MockVote): VoteOutcome | null => {
    if (vote.status !== 'closed' || !vote.outcome) return null
    if ('tiedBookIds' in vote.outcome) return { status: 'tiePending', tiedBookIds: [...vote.outcome.tiedBookIds] }
    return { status: 'winner', winner: toBookSummary(vote.outcome.winnerBookId)!, tieNote: vote.outcome.tieNote }
  }

  const toMember = (id: string): MemberSummary => toMemberSummaries([id])[0]

  // Permissions, decided here like the backend will (§3): the curator is an
  // assignment, not a role, and the admin can override.
  const isAdmin = () => state.members.find((m) => m.id === state.currentUserId)?.role === 'admin'
  const mayManageVotes = () => isAdmin() || (state.curatorId !== null && state.currentUserId === state.curatorId)
  const currentVote = () => state.votes.find((v) => v.status !== 'closed') ?? null

  // The same for every signed-in member: votes are public (§5.4). Only
  // approvedByMe depends on who asks.
  const toVote = (vote: MockVote): Vote => ({
    id: vote.id,
    status: vote.status,
    curator: toMember(vote.curatorId),
    openedAt: vote.openedAt,
    closedAt: vote.closedAt,
    candidates: vote.candidates.map(({ bookId, approverIds }) => {
      const book = state.books.find((b) => b.id === bookId)!
      return {
        book: {
          ...toBookSummary(bookId)!,
          publicationDate: book.publicationDate,
          pageCount: book.pageCount,
        },
        approvals: toMemberSummaries(approverIds),
        approvedByMe: approverIds.includes(state.currentUserId),
      }
    }),
    outcome: toVoteOutcome(vote),
    canManage: mayManageVotes() && vote.status !== 'closed',
    canRecordTieWinner: isAdmin() && vote.status === 'closed' && vote.outcome !== null && 'tiedBookIds' in vote.outcome,
    curatedByMe: vote.curatorId === state.currentUserId,
  })

  const toVoteHistoryItem = (vote: MockVote): VoteHistoryItem => ({
    id: vote.id,
    curator: toMember(vote.curatorId),
    openedAt: vote.openedAt!,
    closedAt: vote.closedAt!,
    outcome: toVoteOutcome(vote)!,
    candidateCount: vote.candidates.length,
  })

  const findVote = (voteId: string) => {
    const vote = state.votes.find((v) => v.id === voteId)
    if (!vote) throw new ApiError(404, 'No existe esa votación.')
    return vote
  }

  // A management call, checked in the backend's order after the 401 and the
  // simulated failure: 403, then 404, then 409.
  const managedVote = (voteId: string) => {
    if (!mayManageVotes()) throw new ApiError(403, 'Solo la curaduría o la administración pueden gestionar la votación.')
    return findVote(voteId)
  }
  const findBook = (bookId: string) => {
    const book = state.books.find((b) => b.id === bookId)
    if (!book) throw new ApiError(404, 'No existe ese libro.')
    return book
  }
  const requireNotClosed = (vote: MockVote) => {
    if (vote.status === 'closed') throw new ApiError(409, 'Esta votación ya está cerrada.')
  }

  // The outcome at closing, decided by the server: the candidate with
  // strictly the most approvals wins; otherwise every candidate sharing the
  // top count is tied (even at zero), in shortlist order.
  const outcomeAtClosing = (vote: MockVote): NonNullable<MockVote['outcome']> => {
    const top = Math.max(0, ...vote.candidates.map((c) => c.approverIds.length))
    const tied = vote.candidates.filter((c) => c.approverIds.length === top).map((c) => c.bookId)
    return tied.length === 1 ? { winnerBookId: tied[0], tieNote: null } : { tiedBookIds: tied }
  }

  // Official club reads: «propuesto» and «elegido» books have not been read
  // by the club yet (#67).
  const isRatable = (book: MockBook) => book.status === 'leyendo' || book.status === 'terminado' || book.status === 'archivado'
  const finishedBy = (bookId: string) => state.finished[bookId] ?? []
  const reviewsOf = (bookId: string) => state.reviews.filter((r) => r.bookId === bookId)
  const myReviewOf = (bookId: string) =>
    state.reviews.find((r) => r.bookId === bookId && r.userId === state.currentUserId) ?? null

  const spanishOrder = new Intl.Collator('es', { sensitivity: 'base' })

  // Decided at call time for the signed-in user. A locked result is built
  // with no other key, so no count, mean, name, score or text can leak; the
  // admin gets the same answer as a member (§3).
  const toClubRatings = (bookId: string): ClubRatings => {
    const reviews = reviewsOf(bookId)
    const gate = ratingGate({
      userId: state.currentUserId,
      finishedBy: finishedBy(bookId),
      reviewerIds: reviews.map((r) => r.userId),
    })
    if (!gate.visible) return { status: 'locked' }
    const aggregates = clubAggregates(reviews.map((r) => r.scores))!
    const named = reviews.map((r) => ({ review: r, member: toMember(r.userId) }))
    // The user's own review first, then the others by name; never by score.
    named.sort((a, b) => {
      const mine = Number(b.review.userId === state.currentUserId) - Number(a.review.userId === state.currentUserId)
      return mine || spanishOrder.compare(a.member.displayName, b.member.displayName)
    })
    return {
      status: 'visible',
      reviewCount: aggregates.reviewCount,
      overallMean: aggregates.overallMean,
      criterionMeans: aggregates.criterionMeans,
      reviews: named.map(({ review, member }) => ({
        member,
        scores: { ...review.scores },
        overall: reviewOverall(review.scores),
        text: review.text,
        isMine: review.userId === state.currentUserId,
      })),
    }
  }

  const toBookRatings = (book: MockBook): BookRatings => {
    const mine = myReviewOf(book.id)
    return {
      book: toBookSummary(book.id)!,
      ratable: isRatable(book),
      finishedByMe: finishedBy(book.id).includes(state.currentUserId),
      myReview: mine && {
        scores: { ...mine.scores },
        overall: reviewOverall(mine.scores),
        text: mine.text,
        submittedAt: mine.submittedAt,
        editedAt: mine.editedAt,
      },
      club: toClubRatings(book.id),
    }
  }

  // Like the backend (#36): five scores from 1 to 5 in steps of 0.5, and a
  // trimmed text of at most 5000 characters. Returns the text to save.
  const validReviewText = ({ scores, text }: ReviewInput): string | null => {
    const given = (scores ?? {}) as Partial<Record<string, unknown>>
    if (!CRITERIA.every((criterion) => isValidScore(given[criterion]))) {
      throw new ApiError(400, 'Cada criterio necesita una puntuación de 1 a 5, en pasos de media estrella.')
    }
    const trimmed = (text ?? '').trim()
    if (trimmed.length > REVIEW_TEXT_MAX_LENGTH) {
      throw new ApiError(400, `La reseña puede tener como mucho ${REVIEW_TEXT_MAX_LENGTH} caracteres.`)
    }
    return trimmed || null
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

    async getVotes(): Promise<VotesOverview> {
      requireSignedIn()
      failIfConfigured('getVotes')
      const current = currentVote()
      return {
        curator: state.curatorId ? toMember(state.curatorId) : null,
        current: current && toVote(current),
        history: state.votes
          .filter((v) => v.status === 'closed')
          .sort((a, b) => Date.parse(b.closedAt!) - Date.parse(a.closedAt!))
          .map(toVoteHistoryItem),
        canCreateVote: mayManageVotes() && state.curatorId !== null && current === null,
      }
    },

    async getVote(voteId: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('getVote')
      return toVote(findVote(voteId))
    },

    async setApproval(voteId: string, bookId: string, approved: boolean): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('setApproval')
      const vote = findVote(voteId)
      const candidate = vote.candidates.find((c) => c.bookId === bookId)
      if (!candidate) throw new ApiError(404, 'Ese libro no está en esta votación.')
      if (vote.status !== 'open') throw new ApiError(409, 'Esta votación no está abierta.')
      // Always acts on the signed-in member only, and at most once per candidate.
      const others = candidate.approverIds.filter((id) => id !== state.currentUserId)
      candidate.approverIds = approved ? [...others, state.currentUserId] : others
      return toVote(vote)
    },

    async createVote(): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('createVote')
      if (!mayManageVotes()) throw new ApiError(403, 'Solo la curaduría o la administración pueden preparar una votación.')
      if (state.curatorId === null) throw new ApiError(409, 'Primero hay que asignar la curaduría.')
      if (currentVote()) throw new ApiError(409, 'Ya hay una votación en preparación o abierta.')
      let n = state.votes.length
      while (state.votes.some((v) => v.id === `v${n}`)) n++
      // The vote belongs to the current curator, even when the admin creates it.
      const vote: MockVote = {
        id: `v${n}`,
        status: 'draft',
        curatorId: state.curatorId,
        openedAt: null,
        closedAt: null,
        candidates: [],
        outcome: null,
      }
      state.votes.push(vote)
      return toVote(vote)
    },

    async addCandidate(voteId: string, bookId: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('addCandidate')
      const vote = managedVote(voteId)
      const book = findBook(bookId)
      requireNotClosed(vote)
      if (vote.candidates.some((c) => c.bookId === bookId)) throw new ApiError(409, 'Ese libro ya está en la lista.')
      if (book.status !== 'propuesto') throw new ApiError(409, 'Solo se pueden añadir libros propuestos.')
      vote.candidates.push({ bookId, approverIds: [] })
      return toVote(vote)
    },

    async removeCandidate(voteId: string, bookId: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('removeCandidate')
      const vote = managedVote(voteId)
      if (!vote.candidates.some((c) => c.bookId === bookId)) throw new ApiError(404, 'Ese libro no está en esta votación.')
      requireNotClosed(vote)
      if (vote.status === 'open' && vote.candidates.length <= 2) {
        throw new ApiError(409, 'Una votación abierta necesita al menos dos libros.')
      }
      // Its approvals go with it.
      vote.candidates = vote.candidates.filter((c) => c.bookId !== bookId)
      return toVote(vote)
    },

    async reorderCandidates(voteId: string, bookIds: string[]): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('reorderCandidates')
      const vote = managedVote(voteId)
      for (const bookId of bookIds) findBook(bookId)
      requireNotClosed(vote)
      const current = vote.candidates.map((c) => c.bookId)
      const same =
        bookIds.length === current.length &&
        new Set(bookIds).size === bookIds.length &&
        bookIds.every((id) => current.includes(id))
      if (!same) throw new ApiError(409, 'La lista ha cambiado mientras tanto.')
      vote.candidates = bookIds.map((id) => vote.candidates.find((c) => c.bookId === id)!)
      return toVote(vote)
    },

    async openVote(voteId: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('openVote')
      const vote = managedVote(voteId)
      if (vote.status !== 'draft') throw new ApiError(409, 'Esta votación no está en preparación.')
      if (vote.candidates.length < 2) throw new ApiError(409, 'Hacen falta al menos dos libros para abrir la votación.')
      vote.status = 'open'
      vote.openedAt = state.now
      return toVote(vote)
    },

    async closeVote(voteId: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('closeVote')
      const vote = managedVote(voteId)
      if (vote.status !== 'open') throw new ApiError(409, 'Esta votación no está abierta.')
      // Never changes a book's status, its origin vote or the curator (§5.4).
      vote.status = 'closed'
      vote.closedAt = state.now
      vote.outcome = outcomeAtClosing(vote)
      return toVote(vote)
    },

    async recordTieWinner(voteId: string, bookId: string, note: string): Promise<Vote> {
      requireSignedIn()
      failIfConfigured('recordTieWinner')
      // The admin only, not even the curator (#91).
      if (!isAdmin()) throw new ApiError(403, 'Solo la administración puede registrar el libro elegido.')
      const vote = findVote(voteId)
      findBook(bookId)
      const outcome = vote.outcome
      if (vote.status !== 'closed' || !outcome || !('tiedBookIds' in outcome)) {
        throw new ApiError(409, 'Esta votación no tiene un empate pendiente.')
      }
      if (!outcome.tiedBookIds.includes(bookId)) throw new ApiError(409, 'Ese libro no está entre los empatados.')
      const tieNote = note.trim()
      if (tieNote.length > 1000) throw new ApiError(400, 'La nota puede tener como mucho 1000 caracteres.')
      vote.outcome = { winnerBookId: bookId, tieNote: tieNote || null }
      return toVote(vote)
    },

    async getBookRatings(bookId: string): Promise<BookRatings> {
      requireSignedIn()
      failIfConfigured('getBookRatings')
      return toBookRatings(findBook(bookId))
    },

    async getRatingRubric(): Promise<RatingRubric> {
      requireSignedIn()
      failIfConfigured('getRatingRubric')
      return Object.fromEntries(CRITERIA.map((c) => [c, { ...state.rubric[c] }])) as RatingRubric
    },

    async setBookFinished(bookId: string, finished: boolean): Promise<BookRatings> {
      requireSignedIn()
      failIfConfigured('setBookFinished')
      const book = findBook(bookId)
      if (finished && !isRatable(book)) throw new ApiError(409, 'El club todavía no ha leído este libro.')
      // A rated book stays finished.
      if (!finished && myReviewOf(bookId)) throw new ApiError(409, 'Ya has valorado este libro.')
      // Always acts on the signed-in member only. It never touches the weekly
      // completions (§5.2, decision 43).
      const others = finishedBy(bookId).filter((id) => id !== state.currentUserId)
      state.finished[bookId] = finished ? [...others, state.currentUserId] : others
      return toBookRatings(book)
    },

    async saveMyReview(bookId: string, input: ReviewInput): Promise<BookRatings> {
      requireSignedIn()
      failIfConfigured('saveMyReview')
      const book = findBook(bookId)
      if (!isRatable(book)) throw new ApiError(409, 'El club todavía no ha leído este libro.')
      if (!finishedBy(bookId).includes(state.currentUserId)) throw new ApiError(409, 'Primero marca el libro como terminado.')
      const text = validReviewText(input)
      const scores = Object.fromEntries(CRITERIA.map((c) => [c, input.scores[c]])) as MockReview['scores']
      // One review per member and book: an edit keeps submittedAt.
      const existing = myReviewOf(bookId)
      if (existing) {
        existing.scores = scores
        existing.text = text
        existing.editedAt = state.now
      } else {
        state.reviews.push({ bookId, userId: state.currentUserId, scores, text, submittedAt: state.now, editedAt: null })
      }
      return toBookRatings(book)
    },

    async getStatistics(): Promise<Statistics> {
      requireSignedIn()
      failIfConfigured('getStatistics')
      // Decided on every call for the signed-in user: the reviews of books
      // they have not unlocked are dropped before any figure is computed, so
      // nothing of those books (not even a count) can reach the response.
      const counted = countedReviews({ userId: state.currentUserId, reviews: state.reviews, finished: state.finished })
      const bookIds = new Set(counted.map((r) => r.bookId))
      const memberIds = new Set(counted.map((r) => r.userId))
      return {
        booksRead: state.books.filter((b) => b.status === 'terminado' || b.status === 'archivado').length,
        // Like the server: by its own clock (state.now).
        meetingsHeld: state.meetings.filter((m) => !m.cancelled && Date.parse(m.startsAt) < Date.parse(state.now)).length,
        thresholds: { ...STATISTICS_THRESHOLDS },
        ratings: ratingStatistics({
          reviews: counted.map((r) => ({ bookId: r.bookId, memberId: r.userId, scores: { ...r.scores } })),
          books: state.books.filter((b) => bookIds.has(b.id)).map((b) => toBookSummary(b.id)!),
          members: toMemberSummaries([...memberIds]),
          viewerId: state.currentUserId,
          thresholds: STATISTICS_THRESHOLDS,
        }),
      }
    },

    async getTasteCompatibility(): Promise<TasteCompatibility> {
      requireSignedIn()
      failIfConfigured('getTasteCompatibility')
      // The same gate as the statistics, decided on every call for the
      // signed-in user: only the reviews of books they have finished and
      // rated reach the maths, so no other book (not even a count) can reach
      // the response. There is no role input.
      const counted = countedReviews({ userId: state.currentUserId, reviews: state.reviews, finished: state.finished })
      const bookIds = new Set(counted.map((r) => r.bookId))
      return {
        minSharedBooks: MIN_SHARED_BOOKS,
        members: tasteCompatibility({
          reviews: counted.map((r) => ({ bookId: r.bookId, memberId: r.userId, scores: { ...r.scores } })),
          viewerId: state.currentUserId,
          members: toMemberSummaries(state.members.map((m) => m.id)),
          books: state.books.filter((b) => bookIds.has(b.id)).map((b) => toBookSummary(b.id)!),
          minSharedBooks: MIN_SHARED_BOOKS,
        }),
      }
    },
  }
}
