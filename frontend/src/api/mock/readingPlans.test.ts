import { describe, expect, it } from 'vitest'
import { createClubState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'
import type { ReadingWeekInput } from '../types'
import { readingErrors, readingWarnings } from '../../lib/readingPlan'

const input: ReadingWeekInput = { percentStart: 0, percentEnd: 10, pageStart: 1, pageEnd: 20, dueDate: null, notes: null, meetingId: null }
describe('manual reading plan rules', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as MockSession[])('denies every plan operation before lookup for %s', async (session) => {
    const state = createClubState(), api = createMockClient({ state, session }), before = structuredClone(state)
    for (const call of [() => api.getAdminReadingPlan('missing'), () => api.createReadingWeek('missing', input, false), () => api.updateReadingWeek('missing', 'missing', input, false), () => api.reorderReadingWeeks('missing', [], false), () => api.removeReadingWeek('missing', 'missing')]) await expect(call()).rejects.toMatchObject({ status: ['anonymous', 'denied'].includes(session) ? 401 : 403 })
    expect(state).toEqual(before)
  })
  it('distinguishes exact diagnostic bounds from structural errors', () => {
    const exact = { ...input, percentStart: 20, percentEnd: 30, pageStart: 10, pageEnd: 20 }
    expect(readingWarnings([exact], 100)).toEqual([])
    expect(readingWarnings([{ ...exact, percentEnd: 30.01 }], 100).join()).toContain('10 puntos')
    expect(readingWarnings([{ ...exact, percentStart: 0, percentEnd: 10 }], 100)).toEqual([])
    expect(readingWarnings([{ ...exact, percentStart: 0, percentEnd: 9.99 }], 100).join()).toContain('10 puntos')
    expect(readingWarnings([{ ...input, percentEnd: 100, pageEnd: 100 }], 100)).toEqual([])
    expect(readingWarnings([{ ...input, percentEnd: 100.01, pageEnd: 101 }], 100).join()).toMatch(/superiores a 100/)
    expect(readingWarnings([{ ...input, pageEnd: 999 }], null)).toEqual([])
    expect(readingWarnings([input, { ...input, percentStart: 10, percentEnd: 20, pageStart: 21, pageEnd: 40 }], null)).toEqual([])
    expect(readingWarnings([input, { ...input, percentStart: 9, pageStart: 20 }], null).join()).toMatch(/porcentajes se solapan.*páginas se solapan/)
    const reversed = { ...input, percentStart: 20, percentEnd: 0, pageStart: 40, pageEnd: 1 }
    expect(readingWarnings([reversed, { ...input, percentStart: 10, percentEnd: 30, pageStart: 21, pageEnd: 50 }], null).join()).toMatch(/invertidos.*invertidas.*retrocede.*solapan/)
    for (const patch of [{ percentStart: NaN }, { percentEnd: Infinity }, { percentStart: -1 }, { pageStart: 0 }, { pageEnd: 1.5 }, { dueDate: '2026-02-30' }, { dueDate: '0000-01-01' }, { notes: 'x'.repeat(1001) }]) expect(readingErrors({ ...input, ...patch }).length).toBeGreaterThan(0)
    expect(readingErrors({ ...input, percentStart: 10.25, dueDate: '2028-02-29', notes: 'x'.repeat(1000) })).toEqual([])
  })
  it('enforces warnings centrally, keeps unusual facts and preserves stable history', async () => {
    const state = createClubState(), api = createMockClient({ state }), before = structuredClone(state)
    await expect(api.createReadingWeek('b4', { ...input, percentEnd: 130 }, false)).rejects.toMatchObject({ status: 400 })
    await expect(api.createReadingWeek('b4', { ...input, pageStart: 0 }, true)).rejects.toMatchObject({ status: 400 })
    expect(state).toEqual(before)
    const added = (await api.createReadingWeek('b4', { ...input, percentEnd: 130, notes: '  nota\nmanual  ', dueDate: '2027-01-01' }, true)).weeks[0]
    expect(added).toMatchObject({ percentEnd: 130, pageEnd: 20, notes: 'nota\nmanual', weekNumber: 1 })
    state.completions[added.id] = ['m1', 'm8']
    const second = (await api.createReadingWeek('b4', { ...input, pageStart: 21, pageEnd: 40, percentStart: 130, percentEnd: 140 }, true)).weeks[1]
    const saved = structuredClone(state)
    await expect(api.reorderReadingWeeks('b4', [second.id, added.id], false)).rejects.toMatchObject({ status: 400 })
    expect(state).toEqual(saved)
    await api.reorderReadingWeeks('b4', [second.id, added.id], true)
    const edited = await api.updateReadingWeek('b4', added.id, { ...added, notes: '' }, true)
    expect(edited.weeks[1]).toMatchObject({ id: added.id, weekNumber: 2, percentEnd: 130, pageEnd: 20, dueDate: '2027-01-01', notes: null, completionCount: 2 })
    expect(state.completions[added.id]).toEqual(['m1', 'm8'])
    expect(state.books).toEqual(before.books); expect(state.finishedBooks).toEqual(before.finishedBooks); expect(state.reviews).toEqual(before.reviews)
    const snapshot = structuredClone(state)
    for (const ids of [[added.id], [added.id, added.id], ['w1', added.id], ['missing', added.id]]) { await expect(api.reorderReadingWeeks('b4', ids, true)).rejects.toMatchObject({ status: 400 }); expect(state).toEqual(snapshot) }
  })
  it('validates meeting links atomically including removed reservations', async () => {
    const state = createClubState(), api = createMockClient({ state }), week = state.weeks[0], before = structuredClone(state)
    for (const [meetingId, status] of [['mt2', 409], ['missing', 404], ['mt-old', 404]] as const) {
      await expect(api.updateReadingWeek(week.bookId, week.id, { ...week, notes: 'changed', meetingId }, true)).rejects.toMatchObject({ status }); expect(state).toEqual(before)
    }
    const wrong = await api.createMeeting({ startsAt: state.now, bookId: 'b4', weekId: null })
    await expect(api.updateReadingWeek(week.bookId, week.id, { ...week, meetingId: wrong.id }, true)).rejects.toMatchObject({ status: 400 })
    await api.removeReadingWeek(week.bookId, week.id)
    await expect(api.createReadingWeek(week.bookId, { ...input, meetingId: 'mt1' }, true)).rejects.toMatchObject({ status: 409 })
  })
  it('soft removal keeps history, locks even safe records and updates every active projection', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const home = await api.getHome(), week = state.weeks.find((w) => w.meetingId === home.nextMeeting!.id)!
    const meeting = state.meetings.find((m) => m.id === week.meetingId)!
    state.completions[week.id] = ['m1', 'm8', 'm8']; meeting.markedSafe = true
    const original = structuredClone(week), records = structuredClone(meeting)
    expect((await api.getAdminReadingPlan(week.bookId)).weeks.find((w) => w.id === week.id)?.completionCount).toBe(2)
    await api.removeReadingWeek(week.bookId, week.id)
    expect(week).toEqual({ ...original, deletedAt: state.now, deletedBy: state.currentUserId, purgeDueAt: new Date(Date.parse(state.now) + 2592000000).toISOString() })
    expect(state.completions[week.id]).toEqual(['m1', 'm8', 'm8']); expect(meeting).toEqual(records)
    const deleted = structuredClone(state)
    for (const call of [() => api.removeReadingWeek(week.bookId, week.id), () => api.updateReadingWeek(week.bookId, week.id, input, true), () => api.setWeekCompleted(week.id, false), () => api.reorderReadingWeeks(week.bookId, [week.id], true)]) await expect(call()).rejects.toMatchObject({ status: 404 })
    expect(state).toEqual(deleted)
    expect((await api.getMeeting(meeting.id)).record).toEqual({ status: 'lockedNoWeek' })
    expect((await api.getMeeting(meeting.id)).assignment).toBeNull()
    expect((await api.getHome()).currentWeek).toBeNull()
    expect((await api.listMembers()).currentWeekNumber).toBeNull()
    expect((await api.getMemberProfile('m1')).currentWeek).toBeNull()
    expect((await api.getBook(week.bookId)).schedule.some((w) => w.id === week.id)).toBe(false)
    expect(JSON.stringify(await api.getBook(week.bookId))).not.toMatch(/deletedAt|deletedBy|purgeDueAt/)
    const calendar = await api.listAdminMeetings()
    expect(calendar.weeks.some((w) => w.id === week.id)).toBe(false)
    expect((await api.getAdminMeeting(meeting.id)).removedWeekNumber).toBe(original.weekNumber)
    await api.updateMeeting(meeting.id, { startsAt: '2026-12-01T18:00:00Z', bookId: meeting.bookId, weekId: week.id })
    expect(week.meetingId).toBe(meeting.id)
    await expect(api.createMeeting({ startsAt: state.now, bookId: week.bookId, weekId: week.id })).rejects.toMatchObject({ status: 404 })
    await api.updateMeeting(meeting.id, { startsAt: meeting.startsAt, bookId: meeting.bookId, weekId: null })
    expect(week.meetingId).toBeNull(); expect((await api.getMeeting(meeting.id)).record.status).toBe('visible')
    for (const active of (await api.getAdminReadingPlan(week.bookId)).weeks) await api.removeReadingWeek(week.bookId, active.id)
    expect((await api.getAdminReadingPlan(week.bookId)).weeks).toEqual([])
    expect(JSON.stringify(await api.getAdminReadingPlan(week.bookId))).not.toMatch(/summary|highlights|rating|discordId|deletedAt/)
  })
  it('supports failure injection for every new call without mutation', async () => {
    const state = createClubState(), before = structuredClone(state), api = createMockClient({ state, failures: { getAdminReadingPlan: 1, createReadingWeek: 1, updateReadingWeek: 1, reorderReadingWeeks: 1, removeReadingWeek: 1 } })
    for (const call of [() => api.getAdminReadingPlan('b3'), () => api.createReadingWeek('b3', input, true), () => api.updateReadingWeek('b3', 'w1', input, true), () => api.reorderReadingWeeks('b3', [], true), () => api.removeReadingWeek('b3', 'w1')]) await expect(call()).rejects.toMatchObject({ status: 500 })
    expect(state).toEqual(before)
  })
})
