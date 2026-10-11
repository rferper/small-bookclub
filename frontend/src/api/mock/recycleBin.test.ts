import { describe, expect, it } from 'vitest'
import { ApiError, type ApiClient } from '../client'
import type { DeletedType, ReadingWeekInput } from '../types'
import { blankBookInput } from '../../lib/catalogue'
import { withUnauthorizedHandler } from '../unauthorized'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'

const input: ReadingWeekInput = { percentStart: 0, percentEnd: 20, pageStart: 1, pageEnd: 20, meetingId: null, dueDate: null, notes: 'Hechos manuales' }
const calls = [
  ['getRecycleBin', (api: ApiClient) => api.getRecycleBin()],
  ['getDeletionPreview', (api: ApiClient) => api.getDeletionPreview('book', 'missing')],
  ['deleteBook', (api: ApiClient) => api.deleteBook('missing')],
  ['deleteMeeting', (api: ApiClient) => api.deleteMeeting('missing')],
  ['deleteLiteraryQuote', (api: ApiClient) => api.deleteLiteraryQuote('missing')],
  ['restoreDeleted', (api: ApiClient) => api.restoreDeleted('invalid' as DeletedType, '')],
  ['purgeDeleted', (api: ApiClient) => api.purgeDeleted('invalid' as DeletedType, '')],
] as const

describe('recovery authorization and transaction boundaries', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as MockSession[])('denies every operation before validation for %s', async (session) => {
    const state = createClubState(), api = createMockClient({ state, session }), before = structuredClone(state)
    for (const [, call] of calls) await expect(call(api)).rejects.toMatchObject({ status: session === 'anonymous' || session === 'denied' ? 401 : 403 })
    expect(state).toEqual(before)
  })
  it('all configurable failures and unauthorized wrapper cover new methods', async () => {
    for (const [method, call] of calls) {
      const state = createClubState(), api = createMockClient({ state, failures: { [method]: 1 } }), before = structuredClone(state)
      await expect(call(api)).rejects.toMatchObject({ status: 500 }); expect(state).toEqual(before)
      let expired = false
      state.session = 'anonymous'
      await expect(call(withUnauthorizedHandler(api, () => { expired = true }))).rejects.toMatchObject({ status: 401 })
      expect(expired).toBe(true)
    }
  })
  it('invalid targets are 400, absent and wrong deletion state are 404, repeated removal preserves metadata', async () => {
    const state = createClubState(), api = createMockClient({ state })
    await expect(api.restoreDeleted('invalid' as DeletedType, 'b3')).rejects.toMatchObject({ status: 400 })
    await expect(api.purgeDeleted('book', '')).rejects.toMatchObject({ status: 400 })
    for (const type of ['book', 'meeting', 'quote', 'week', 'highlight'] as DeletedType[]) {
      await expect(api.restoreDeleted(type, 'missing')).rejects.toMatchObject({ status: 404 })
    }
    await expect(api.restoreDeleted('book', 'b3')).rejects.toMatchObject({ status: 404 })
    const original = structuredClone(state.books.find((b) => b.id === 'b3')!)
    await api.deleteBook('b3')
    const deleted = state.books.find((b) => b.id === 'b3')!
    expect(deleted).toEqual({ ...original, deletedAt: state.now, deletedBy: 'm1', purgeDueAt: new Date(Date.parse(state.now) + 30 * 86400000).toISOString() })
    const before = structuredClone(state)
    state.now = new Date(Date.parse(state.now) + 1000).toISOString()
    await expect(api.deleteBook('b3')).rejects.toMatchObject({ status: 404 })
    expect(deleted).toEqual(before.books.find((b) => b.id === 'b3'))
  })
})

describe('central deletion visibility and retained facts', () => {
  it('suppresses parent dependencies in every serialized member/admin active projection without changing history', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const original = structuredClone(state)
    await api.deleteBook('b2'); await api.deleteBook('b3'); await api.deleteBook('b7')
    expect(state.weeks).toEqual(original.weeks); expect(state.meetings).toEqual(original.meetings)
    expect(state.reviews).toEqual(original.reviews); expect(state.finished).toEqual(original.finished)
    expect(state.votes).toEqual(original.votes); expect(state.profiles).toEqual(original.profiles)
    for (const role of ['admin', 'member', 'curator'] as MockSession[]) {
      const reader = createMockClient({ state, session: role })
      const projections = await Promise.all([reader.listBooks(), reader.getHome(), reader.listMeetings(), reader.getVotes(), reader.listMembers(), reader.getMemberProfile('m1'), reader.getMyProfile(), reader.listMyReviews(), reader.getStatistics(), reader.getTasteCompatibility()])
      const json = JSON.stringify(projections)
      expect(json).not.toMatch(/La Regenta|Cumbres borrascosas|Marianela|deletedAt|deletedBy|purgeDueAt/)
      expect((await reader.getHome()).currentBook).toBeNull()
      expect((await reader.getHome()).currentWeek).toBeNull()
      expect((await reader.getVotes()).current).toBeNull()
      await expect(reader.getBook('b3')).rejects.toMatchObject({ status: 404 })
      await expect(reader.getBookRatings('b2')).rejects.toMatchObject({ status: 404 })
      await expect(reader.getMeeting('mt1')).rejects.toMatchObject({ status: 404 })
      await expect(reader.setWeekCompleted('w1', true)).rejects.toMatchObject({ status: 404 })
      await expect(reader.setBookFinished('b3', true)).rejects.toMatchObject({ status: 404 })
      await expect(reader.saveMyReview('b3', {} as never)).rejects.toMatchObject({ status: 404 })
      await expect(reader.getVote('v2')).rejects.toMatchObject({ status: 404 })
      await expect(reader.setApproval('v2', 'b5', true)).rejects.toMatchObject({ status: 409 })
    }
    state.currentUserId = 'm1'
    await expect(api.createVote()).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Restaura el libro') })
    expect(JSON.stringify(await api.listAdminBooks())).not.toMatch(/La Regenta|Cumbres borrascosas|Marianela/)
    expect(JSON.stringify(await api.listAdminMeetings())).not.toMatch(/"b2"|"b3"|"mt1"/)
    for (const call of [() => api.getAdminReadingPlan('b3'), () => api.getAdminMeetingRecord('mt1'), () => api.updateBook('b3', {} as never), () => api.saveMeetingSummary('mt1', { text: 'Refused', published: true })]) await expect(call()).rejects.toMatchObject({ status: 404 })
    const bin = await api.getRecycleBin()
    expect(bin.map((e) => `${e.type}:${e.id}`)).toEqual(['book:b2', 'book:b3', 'book:b7'])
    expect(JSON.stringify(bin)).not.toMatch(/scores|reviewCount|discordId|bio|summary|speakerIds/)
    expect(bin[0].deletedByName).toBe('Lucía')
    await api.restoreDeleted('book', 'b7')
    expect((await api.getVote('v2')).candidates.map((c) => c.book.id)).toEqual(original.votes[0].candidates.map((c) => c.bookId))
  })
  it('meeting deletion retains completions/week and its reservation; deliberate unlink wins', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const meeting = state.meetings.find((m) => m.id === 'mt1')!, week = state.weeks.find((w) => w.meetingId === meeting.id)!
    const before = structuredClone({ meeting, week, completions: state.completions })
    await api.deleteMeeting(meeting.id)
    expect(week).toEqual(before.week); expect(state.completions).toEqual(before.completions)
    expect((await api.getBook('b3')).schedule.find((w) => w.id === week.id)?.meeting).toBeNull()
    expect((await api.getAdminReadingPlan('b3')).weeks.find((w) => w.id === week.id)?.removedMeeting).toBe(true)
    await api.updateReadingWeek('b3', week.id, { ...week, notes: 'Edición independiente' }, true)
    expect(week.meetingId).toBe(meeting.id)
    await expect(api.createReadingWeek('b3', { ...input, meetingId: meeting.id }, true)).rejects.toMatchObject({ status: 404 })
    await expect(api.purgeDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 })
    await api.updateReadingWeek('b3', week.id, { ...week, meetingId: null }, true)
    await api.restoreDeleted('meeting', meeting.id)
    expect(week.meetingId).toBeNull(); expect(meeting.summary).toEqual(before.meeting.summary)
    expect(meeting.attendance).toEqual(before.meeting.attendance)
  })
  it('restoring parent leaves separately removed descendants and original spoiler gates', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const meeting = state.meetings.find((m) => m.id === 'mt1')!, week = state.weeks.find((w) => w.meetingId === meeting.id)!, highlight = meeting.highlights[0]
    await api.removeMeetingHighlight(meeting.id, highlight.id)
    await api.removeReadingWeek('b3', week.id)
    const removed = structuredClone({ week, highlight })
    meeting.markedSafe = true
    await api.deleteMeeting(meeting.id); await api.deleteBook('b3')
    await expect(api.restoreDeleted('highlight', highlight.id)).rejects.toMatchObject({ status: 409 })
    await expect(api.restoreDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 })
    await api.restoreDeleted('book', 'b3'); await api.restoreDeleted('meeting', meeting.id)
    expect(week).toEqual(removed.week); expect(highlight).toEqual(removed.highlight)
    expect((await api.getMeeting(meeting.id)).record).toEqual({ status: 'lockedNoWeek' })
    expect((await api.getBookRatings('b3')).club).toEqual({ status: 'locked' })
    await api.restoreDeleted('week', week.id)
    const record = (await api.getMeeting(meeting.id)).record
    expect(JSON.stringify(record)).not.toContain(highlight.text)
    await api.restoreDeleted('highlight', highlight.id)
    expect((await api.getMeeting(meeting.id)).record.status).toBe('visible')
    state.completions[week.id] = state.completions[week.id].filter((id) => id !== 'm7')
    state.currentUserId = 'm7'
    expect((await api.getMeeting(meeting.id)).record.status).toBe('lockedWeekNotRead')
  })
})

describe('atomic conflicts, exact expiry, ordering and safe purge', () => {
  it.each(['book', 'meeting', 'week', 'highlight', 'quote'] as DeletedType[])('purged identity stays terminal after creating new %s content', async (type) => {
    const state = createEmptyState(), api = createMockClient({ state })
    const book = await api.createBook({ ...blankBookInput(), title: 'Historia ficticia' })
    const meeting = await api.createMeeting({ bookId: null, weekId: null, startsAt: state.now })
    const create = async () => {
      if (type === 'book') return (await api.createBook({ ...blankBookInput(), title: 'Otra historia ficticia' })).id
      if (type === 'meeting') return (await api.createMeeting({ bookId: null, weekId: null, startsAt: state.now })).id
      if (type === 'quote') return (await api.addLiteraryQuote({ text: 'Cita original ficticia', author: 'Autor inventado', source: null, active: true })).id
      if (type === 'week') { await api.createReadingWeek(book.id, input, true); return state.weeks.at(-1)!.id }
      await api.createMeetingHighlight(meeting.id, { text: 'Momento ficticio', kind: 'quote', speakerIds: ['m1'], published: false }); return state.meetings[0].highlights.at(-1)!.id
    }
    const id = await create()
    if (type === 'book') await api.deleteBook(id)
    else if (type === 'meeting') await api.deleteMeeting(id)
    else if (type === 'quote') await api.deleteLiteraryQuote(id)
    else if (type === 'week') await api.removeReadingWeek(book.id, id)
    else await api.removeMeetingHighlight(meeting.id, id)
    await api.purgeDeleted(type, id)
    expect(await create()).not.toBe(id)
    await expect(api.restoreDeleted(type, id)).rejects.toMatchObject({ status: 404 })
    await expect(api.purgeDeleted(type, id)).rejects.toMatchObject({ status: 404 })
  })
  it.each(['week', 'meeting', 'review', 'finished', 'favourite', 'candidate', 'outcome', 'source'] as const)('each independent book dependency blocks purge: %s', async (dependency) => {
    const state = createClubState(), api = createMockClient({ state }), book = state.books[0]
    state.weeks = []; state.meetings = []; state.reviews = []; state.finished = {}; state.profiles = {}; state.votes = []; book.originVote = null
    if (dependency === 'week') state.weeks.push({ id: 'retained', bookId: book.id, weekNumber: 1, ...input, deletedAt: state.now })
    if (dependency === 'meeting') state.meetings.push({ id: 'retained', bookId: book.id, startsAt: state.now, cancelled: true, attendance: null, markedSafe: false, summary: null, highlights: [], deletedAt: state.now })
    if (dependency === 'review') state.reviews.push({ bookId: book.id, userId: 'm1', scores: { disfrute: 3, estilo: 3, personajes: 3, trama: 3, huella: 3 }, text: 'Historial ficticio', submittedAt: state.now, editedAt: null })
    if (dependency === 'finished') state.finished[book.id] = ['m1']
    if (dependency === 'favourite') state.profiles.m1 = { bio: null, favouriteQuote: null, favouriteBookIds: [book.id] }
    if (dependency === 'candidate' || dependency === 'outcome') state.votes.push({ id: 'retained', status: 'closed', curatorId: 'm1', openedAt: state.now, closedAt: state.now, candidates: dependency === 'candidate' ? [{ bookId: book.id, approverIds: [] }] : [], outcome: dependency === 'outcome' ? { winnerBookId: book.id, tieNote: null } : null })
    if (dependency === 'source') book.originVote = { id: 'retained', label: 'Votacion ficticia' }
    await api.deleteBook(book.id)
    const before = structuredClone(state)
    await expect(api.purgeDeleted('book', book.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
  })
  it.each(['attendance', 'removedHighlight', 'removedWeek'] as const)('each retained meeting dependency blocks purge: %s', async (dependency) => {
    const state = createClubState(), api = createMockClient({ state }), meeting = state.meetings.find((m) => m.id === 'mt1')!
    state.weeks = []; meeting.attendance = []; meeting.highlights = []
    if (dependency === 'attendance') meeting.attendance = ['m8']
    if (dependency === 'removedHighlight') meeting.highlights = [{ id: 'retained', text: 'Texto independiente', kind: 'quote', speakerIds: [], published: false, deletedAt: state.now }]
    if (dependency === 'removedWeek') state.weeks = [{ id: 'retained', bookId: meeting.bookId!, weekNumber: 1, ...input, meetingId: meeting.id, deletedAt: state.now }]
    await api.deleteMeeting(meeting.id)
    const before = structuredClone(state)
    await expect(api.purgeDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
  })
  it.each(['completion', 'meeting'] as const)('each independent week dependency blocks purge: %s', async (dependency) => {
    const state = createClubState(), api = createMockClient({ state }), week = state.weeks[0]
    state.completions[week.id] = dependency === 'completion' ? ['m8'] : []
    if (dependency === 'completion') week.meetingId = null
    await api.removeReadingWeek(week.bookId, week.id)
    const before = structuredClone(state)
    await expect(api.purgeDeleted('week', week.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
  })
  it('meeting restore rejects conflicting canonical reservations and removed/missing book parents atomically', async () => {
    const state = createClubState(), api = createMockClient({ state }), meeting = state.meetings.find((m) => m.id === 'mt1')!
    await api.deleteMeeting(meeting.id)
    const linked = state.weeks.find((w) => w.meetingId === meeting.id)!
    const other = state.weeks.find((w) => w.id !== linked.id)!, previous = other.meetingId
    other.meetingId = meeting.id
    let before = structuredClone(state)
    await expect(api.restoreDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    other.meetingId = previous; linked.bookId = 'b2'; before = structuredClone(state)
    await expect(api.restoreDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    linked.bookId = 'b3'; await api.deleteBook('b3'); before = structuredClone(state)
    await expect(api.restoreDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    state.books = state.books.filter((b) => b.id !== 'b3'); before = structuredClone(state)
    await expect(api.restoreDeleted('meeting', meeting.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
  })
  it('blocks a second Leyendo and recovers exact book facts after conflict is resolved', async () => {
    const state = createClubState(), api = createMockClient({ state }), original = structuredClone(state.books.find((b) => b.id === 'b3')!)
    await api.deleteBook('b3')
    state.books.find((b) => b.id === 'b4')!.status = 'leyendo'
    const before = structuredClone(state)
    await expect(api.restoreDeleted('book', 'b3')).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    state.books.find((b) => b.id === 'b4')!.status = 'elegido'
    await api.restoreDeleted('book', 'b3'); expect(state.books.find((b) => b.id === 'b3')).toEqual(original)
  })
  it('expires at exactly 30 days on mock clock, remains listed and does not auto purge', async () => {
    const state = createClubState(), api = createMockClient({ state }), id = state.quotes[0].id
    await api.deleteLiteraryQuote(id)
    const due = state.quotes[0].purgeDueAt!
    state.now = new Date(Date.parse(due) - 1).toISOString()
    expect((await api.getRecycleBin())[0].expired).toBe(false)
    await api.restoreDeleted('quote', id); await api.deleteLiteraryQuote(id)
    state.now = state.quotes[0].purgeDueAt!
    const before = structuredClone(state)
    await expect(api.restoreDeleted('quote', id)).rejects.toMatchObject({ status: 409, message: 'El plazo de recuperación ha terminado' })
    expect(state).toEqual(before); expect((await api.getRecycleBin())[0].expired).toBe(true)
    await api.purgeDeleted('quote', id); expect(await api.getRecycleBin()).toEqual([])
  })
  it('week recovery clamps retained ordinal and keeps completions; conflicting parents/links never partially mutate', async () => {
    const state = createClubState(), api = createMockClient({ state }), week = state.weeks.find((w) => w.id === 'w3')!
    const facts = structuredClone(week), completions = structuredClone(state.completions)
    await api.removeReadingWeek('b3', week.id)
    const meeting = state.meetings.find((m) => m.id === week.meetingId)!
    await api.deleteMeeting(meeting.id)
    let before = structuredClone(state)
    await expect(api.restoreDeleted('week', week.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    await api.restoreDeleted('meeting', meeting.id)
    meeting.bookId = 'b2'; before = structuredClone(state)
    await expect(api.restoreDeleted('week', week.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    meeting.bookId = 'b3'
    const other = state.weeks.find((w) => w.id !== week.id)!, oldLink = other.meetingId
    other.meetingId = meeting.id; before = structuredClone(state)
    await expect(api.restoreDeleted('week', week.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    other.meetingId = oldLink
    for (const w of state.weeks.filter((w) => w.bookId === 'b3' && !w.deletedAt)) await api.removeReadingWeek('b3', w.id)
    await api.restoreDeleted('week', week.id)
    expect(week).toEqual({ ...facts, weekNumber: 1 }); expect(state.completions).toEqual(completions)
    expect((await api.getAdminReadingPlan('b3')).weeks.map((w) => w.weekNumber)).toEqual([1])
  })
  it('highlights restore their canonical slots while preserving surviving relative order', async () => {
    const state = createClubState(), api = createMockClient({ state }), meeting = state.meetings.find((m) => m.id === 'mt1')!
    const ids = meeting.highlights.map((h) => h.id)
    await api.removeMeetingHighlight(meeting.id, ids[0])
    const surviving = ids.slice(1).reverse()
    await api.reorderMeetingHighlights(meeting.id, surviving)
    await api.restoreDeleted('highlight', ids[0])
    expect(meeting.highlights.map((h) => h.id)).toEqual([ids[0], ...surviving])
  })
  it('deleted quote uniqueness stays reserved, restore conflict is atomic, terminal purge erases text/attribution and releases uniqueness', async () => {
    const state = createClubState(), api = createMockClient({ state }), quote = state.quotes[0], original = structuredClone(quote)
    state.quotes.forEach((q) => { q.active = false }); quote.active = true
    await api.deleteLiteraryQuote(quote.id)
    expect((await api.getHome()).quote).toBeNull(); expect(await api.listAdminQuotes()).not.toContainEqual(quote)
    await expect(api.updateLiteraryQuote(quote.id, original)).rejects.toMatchObject({ status: 404 })
    await expect(api.addLiteraryQuote({ ...original, text: ` ${original.text.toLocaleUpperCase('es')} ` })).rejects.toMatchObject({ status: 409 })
    state.quotes.push({ ...original, id: 'conflict' })
    const before = structuredClone(state)
    await expect(api.restoreDeleted('quote', quote.id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    state.quotes.pop()
    await api.restoreDeleted('quote', quote.id); expect(state.quotes[0]).toEqual(original)
    await api.deleteLiteraryQuote(quote.id); await api.purgeDeleted('quote', quote.id)
    expect(JSON.stringify(state)).not.toContain(original.text)
    expect(state.tombstones).toEqual([{ type: 'quote', id: quote.id, purgedAt: state.now, purgedBy: 'm1' }])
    await expect(api.restoreDeleted('quote', quote.id)).rejects.toMatchObject({ status: 404 })
    await expect(api.purgeDeleted('quote', quote.id)).rejects.toMatchObject({ status: 404 })
    await expect(api.addLiteraryQuote(original)).resolves.toMatchObject({ text: original.text })
  })
  it('purges independent highlight payload and empty containers, refuses every history/reservation without cascading', async () => {
    const state = createClubState(), api = createMockClient({ state }), meeting = state.meetings.find((m) => m.id === 'mt1')!, highlight = meeting.highlights[0]
    await api.removeMeetingHighlight(meeting.id, highlight.id); await api.purgeDeleted('highlight', highlight.id)
    expect(JSON.stringify(state)).not.toContain(highlight.text)
    await api.removeReadingWeek('b3', 'w1'); await api.deleteMeeting('mt1'); await api.deleteBook('b3')
    for (const [type, id] of [['book', 'b3'], ['meeting', 'mt1'], ['week', 'w1']] as [DeletedType, string][]) {
      const before = structuredClone(state)
      await expect(api.purgeDeleted(type, id)).rejects.toMatchObject({ status: 409 }); expect(state).toEqual(before)
    }
    const empty = createEmptyState(), clean = createMockClient({ state: empty })
    const book = await clean.createBook({ ...blankBookInput(), title: 'Libro vacío' })
    await clean.createReadingWeek(book.id, input, true)
    const week = empty.weeks[0]
    await clean.removeReadingWeek(book.id, week.id); await clean.purgeDeleted('week', week.id)
    const m = await clean.createMeeting({ bookId: book.id, weekId: null, startsAt: empty.now })
    await clean.saveMeetingSummary(m.id, { text: 'Resumen que se elimina', published: false })
    await clean.deleteMeeting(m.id); await clean.purgeDeleted('meeting', m.id)
    await clean.deleteBook(book.id); await clean.purgeDeleted('book', book.id)
    expect(empty.books).toEqual([]); expect(empty.weeks).toEqual([]); expect(empty.meetings).toEqual([])
    // #101 retains safe title metadata in audit events after purge, never content.
    expect(JSON.stringify({ ...empty, audit: undefined })).not.toMatch(/Libro vacío|Resumen que se elimina/)
    expect(JSON.stringify(empty.audit)).not.toContain('Resumen que se elimina')
    expect(empty.audit?.some((e) => e.action === 'purged' && e.target.id === book.id && e.target.label === 'Libro vacío')).toBe(true)
    await expect(clean.getBook(book.id)).rejects.toBeInstanceOf(ApiError)
  })
})
