import { describe, expect, it } from 'vitest'
import { createClubState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'
import type { MeetingInput } from '../types'

const input: MeetingInput = { startsAt: '2026-12-01T18:30:00Z', bookId: null, weekId: null }
describe('admin calendar authority and atomic writes', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as MockSession[])('denies every operation before validation for %s', async (session) => {
    const state = createClubState(), api = createMockClient({ state, session })
    const before = structuredClone(state)
    const calls = [() => api.listAdminMeetings(), () => api.getAdminMeeting('missing'), () => api.createMeeting({ ...input, startsAt: '' }), () => api.updateMeeting('missing', input), () => api.setMeetingCancelled('missing', true), () => api.setMeetingAttendance('missing', ['missing'])]
    for (const call of calls) await expect(call()).rejects.toMatchObject({ status: session === 'anonymous' || session === 'denied' ? 401 : 403 })
    expect(state).toEqual(before)
  })
  it('creates clean defaults and exposes operational choices only', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const saved = await api.createMeeting(input)
    expect(state.meetings.find((m) => m.id === saved.id)).toEqual({ id: saved.id, startsAt: input.startsAt, bookId: null, cancelled: false, attendance: null, summary: null, highlights: [], markedSafe: false })
    const json = JSON.stringify(await api.listAdminMeetings())
    expect(json).not.toMatch(/summary|highlights|markedSafe|rating|discordId|revokedAt/)
    expect((await api.listAdminMeetings()).books).toHaveLength(state.books.length)
    saved.startsAt = 'bad'
    expect((await api.getAdminMeeting(saved.id)).startsAt).toBe(input.startsAt)
  })
  it('links/unlinks only the canonical FK and keeps every other reading/history field', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const original = structuredClone(state)
    const week = state.weeks.find((w) => w.meetingId === 'mt1')!
    await api.updateMeeting('mt1', { startsAt: '2027-01-01T12:00:00Z', bookId: week.bookId, weekId: week.id })
    expect(state.weeks).toEqual(original.weeks)
    expect(state.completions).toEqual(original.completions)
    expect(state.books).toEqual(original.books)
    expect(state.meetings.find((m) => m.id === 'mt1')).toEqual({ ...original.meetings.find((m) => m.id === 'mt1'), startsAt: '2027-01-01T12:00:00Z' })
    expect((await api.getAdminMeeting('mt1')).attendanceEligible).toBe(false)
    expect((await api.getMeeting('mt1')).attendance).toBeNull()
    await api.updateMeeting('mt1', { ...input, bookId: null })
    expect(state.weeks.find((w) => w.id === week.id)?.meetingId).toBeNull()
    await api.updateMeeting('mt1', { ...input, bookId: week.bookId, weekId: week.id })
    expect(state.weeks.filter((w) => w.meetingId === 'mt1').map((w) => w.id)).toEqual([week.id])
    expect(state.meetings.find((m) => m.id === 'mt1')).not.toHaveProperty('weekId')
  })
  it('refuses occupied, mismatched, unknown and invalid saves without unlinking anything', async () => {
    const state = createClubState(), api = createMockClient({ state }), before = structuredClone(state)
    const occupied = state.weeks.find((w) => w.meetingId === 'mt2')!
    for (const [bad, status] of [[{ ...input, bookId: occupied.bookId, weekId: occupied.id }, 409], [{ ...input, weekId: occupied.id }, 400], [{ ...input, bookId: 'missing' }, 404], [{ ...input, weekId: 'missing' }, 404], [{ ...input, startsAt: 'bad' }, 400]] as const) {
      await expect(api.updateMeeting('mt1', bad)).rejects.toMatchObject({ status })
      expect(state).toEqual(before)
    }
    await expect(api.updateMeeting('missing', input)).rejects.toMatchObject({ status: 404 })
    await expect(api.updateMeeting('mt1', { ...input, startsAt: '2026-02-30T19:30:00Z' })).rejects.toMatchObject({ status: 400 })
    expect(state).toEqual(before)
  })
  it('honours configured failures without mutation for all six calls', async () => {
    const state = createClubState(), before = structuredClone(state)
    const api = createMockClient({ state, failures: { listAdminMeetings: 1, getAdminMeeting: 1, createMeeting: 1, updateMeeting: 1, setMeetingCancelled: 1, setMeetingAttendance: 1 } })
    for (const call of [() => api.listAdminMeetings(), () => api.getAdminMeeting('mt1'), () => api.createMeeting(input), () => api.updateMeeting('mt1', input), () => api.setMeetingCancelled('mt1', true), () => api.setMeetingAttendance('mt1', [])]) await expect(call()).rejects.toMatchObject({ status: 500 })
    expect(state).toEqual(before)
  })
})

describe('attendance, cancellation and next-load projections', () => {
  it('keeps null until first save, permits empty and corrected selections, retains revoked history', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const meeting = state.meetings.find((m) => m.id === 'mt1')!
    meeting.attendance = null
    expect((await api.getAdminMeeting('mt1')).attendance).toBeNull()
    await api.setMeetingAttendance('mt1', [])
    expect(meeting.attendance).toEqual([])
    await api.setMeetingAttendance('mt1', ['m2'])
    await api.revokeMember('m2')
    await api.setMeetingAttendance('mt1', ['m3'])
    expect(meeting.attendance).toEqual(['m3', 'm2'])
    expect((await api.getMeeting('mt1')).attendance?.map((m) => m.id)).toEqual(['m3', 'm2'])
    expect(JSON.stringify(await api.getMeeting('mt1'))).not.toMatch(/discordId|revokedAt|addedAt|"role"/)
    await api.restoreMember('m2')
    await api.setMeetingAttendance('mt1', [])
    expect(meeting.attendance).toEqual([])
  })
  it('rejects future, exactly-now, cancelled, duplicate, unknown and newly revoked ids without mutation', async () => {
    const state = createClubState(), api = createMockClient({ state })
    state.meetings.find((m) => m.id === 'mt2')!.startsAt = state.now
    const before = structuredClone(state)
    for (const id of ['mt3', 'mt2', 'mt0']) await expect(api.setMeetingAttendance(id, [])).rejects.toMatchObject({ status: 409 })
    for (const ids of [['m2', 'm2'], ['unknown'], ['m8']]) await expect(api.setMeetingAttendance('mt1', ids)).rejects.toMatchObject({ status: 400 })
    expect(state).toEqual(before)
  })
  it('cancel and restore preserve history, suppress cancelled responses and update all projections', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const original = structuredClone(state.meetings.find((m) => m.id === 'mt1')!)
    await api.setMeetingCancelled('mt1', true)
    const cancelled = await api.getMeeting('mt1')
    expect(cancelled.attendance).toBeNull()
    expect(JSON.stringify(cancelled.record)).not.toMatch(/summary|highlights/)
    expect((await api.getBook(original.bookId!)).meetings.find((m) => m.id === 'mt1')?.cancelled).toBe(true)
    expect((await api.listMeetings()).past.find((m) => m.id === 'mt1')?.cancelled).toBe(true)
    await api.setMeetingCancelled('mt1', false)
    expect(state.meetings.find((m) => m.id === 'mt1')).toEqual(original)
    expect((await api.getMeeting('mt1')).record.status).toBe('visible')
    const next = (await api.getHome()).nextMeeting!
    await api.setMeetingCancelled(next.id, true)
    expect((await api.getHome()).nextMeeting?.id).not.toBe(next.id)
  })
  it('uses instants for chronological grouping and Inicio across differing offsets', async () => {
    const state = createClubState(), api = createMockClient({ state })
    state.now = '2026-10-25T00:00:00Z'
    await api.updateMeeting('mt3', { ...input, startsAt: '2026-10-25T02:45:00+02:00' })
    await api.updateMeeting('mt4', { ...input, startsAt: '2026-10-25T02:15:00+01:00' })
    expect((await api.listAdminMeetings()).upcoming.map((m) => m.id)).toEqual(['mt3', 'mt4'])
    expect((await api.getHome()).nextMeeting?.id).toBe('mt3')
    state.now = '2026-10-25T01:00:00Z'
    expect((await api.getAdminMeeting('mt3')).attendanceEligible).toBe(true)
    expect((await api.getHome()).nextMeeting?.id).toBe('mt4')
  })
  it('the gate follows a successful canonical link change and omits hidden and draft content', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const week = state.weeks.find((w) => w.meetingId === 'mt2')!
    await api.updateMeeting('mt2', { ...input, startsAt: '2026-09-01T12:00:00Z', bookId: week.bookId })
    await api.updateMeeting('mt1', { ...input, startsAt: '2026-09-01T12:00:00Z', bookId: week.bookId, weekId: week.id })
    expect((await api.getMeeting('mt1')).record.status).toBe('lockedWeekNotRead')
    expect(JSON.stringify((await api.getMeeting('mt1')).record)).not.toMatch(/summary|highlights/)
    await api.setWeekCompleted(week.id, true)
    const response = JSON.stringify(await api.getMeeting('mt1'))
    for (const h of state.meetings.find((m) => m.id === 'mt1')!.highlights.filter((h) => !h.published)) expect(response).not.toContain(h.text)
    expect((await api.getMeeting('mt1')).record.status).toBe('visible')
  })
})
