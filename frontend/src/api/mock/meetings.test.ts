import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import type { MeetingDetail } from '../types'
import { createClubState, createEmptyState, type MockState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'

const ids = (items: { id: string }[]) => items.map((item) => item.id)

// Every summary text, highlight text and speaker name in the fixtures for
// one meeting, published or draft.
function gatedStrings(state: MockState, meetingId: string): string[] {
  const meeting = state.meetings.find((m) => m.id === meetingId)!
  const speakers = meeting.highlights.flatMap((h) => h.speakerIds)
  return [
    ...(meeting.summary ? [meeting.summary.text] : []),
    ...meeting.highlights.map((h) => h.text),
    ...state.members.filter((m) => speakers.includes(m.id)).map((m) => m.displayName),
  ]
}

// The response as JSON without the attendance list: attendees are shown on
// every meeting page, so a speaker who attended appears there by name.
const serializedWithoutAttendance = (detail: MeetingDetail) => JSON.stringify({ ...detail, attendance: null })

function expectLockedWithoutGatedData(state: MockState, detail: MeetingDetail) {
  expect(JSON.stringify(detail)).not.toMatch(/"summary"|"highlights"|"speakers"/)
  const gated = gatedStrings(state, detail.id)
  expect(gated.length).toBeGreaterThan(0)
  for (const text of gated) expect(serializedWithoutAttendance(detail)).not.toContain(text)
}

describe('mock meetings list', () => {
  it('splits meetings around the server clock, upcoming soonest first and past most recent first', async () => {
    const list = await createMockClient().listMeetings()

    expect(ids(list.upcoming)).toEqual(['mt3', 'mt4'])
    expect(ids(list.past)).toEqual(['mt2', 'mt1', 'mt0', 'mt5', 'mt6', 'mt7'])
  })

  it('counts a meeting starting exactly now as upcoming and follows a moved clock', async () => {
    const state = createClubState()
    // The start of mt2, written in UTC.
    state.now = '2026-10-01T17:30:00Z'
    const list = await createMockClient({ state }).listMeetings()

    expect(ids(list.upcoming)).toEqual(['mt2', 'mt3', 'mt4'])
    expect(ids(list.past)).toEqual(['mt1', 'mt0', 'mt5', 'mt6', 'mt7'])
  })

  it('keeps cancelled meetings in the list their date puts them in', async () => {
    const state = createClubState()
    state.meetings.find((m) => m.id === 'mt4')!.cancelled = true
    const list = await createMockClient({ state }).listMeetings()

    expect(list.past.find((m) => m.id === 'mt0')).toMatchObject({ cancelled: true })
    expect(list.upcoming.find((m) => m.id === 'mt4')).toMatchObject({ cancelled: true })
  })

  it('returns the book and reading assignment of each meeting, or null', async () => {
    const list = await createMockClient().listMeetings()

    expect(list.past[1]).toEqual({
      id: 'mt1',
      startsAt: '2026-09-24T19:30:00+02:00',
      cancelled: false,
      book: { id: 'b3', title: 'La Regenta', authors: ['Leopoldo Alas «Clarín»'], coverUrl: null },
      assignment: { weekNumber: 1, percentStart: 0, percentEnd: 12, pageStart: 1, pageEnd: 98 },
    })
    expect(list.past.find((m) => m.id === 'mt5')).toMatchObject({ book: { title: 'Niebla' }, assignment: null })
    expect(list.past.find((m) => m.id === 'mt7')).toMatchObject({ book: null, assignment: null })
  })

  it('never contains summaries, highlights or attendance', async () => {
    const state = createClubState()
    const json = JSON.stringify(await createMockClient({ state }).listMeetings())

    expect(json).not.toMatch(/summary|highlight|speaker|attendance/i)
    for (const meeting of state.meetings) {
      const texts = gatedStrings(state, meeting.id).filter((text) => !state.members.some((m) => m.displayName === text))
      for (const text of texts) expect(json).not.toContain(text)
    }
    for (const member of state.members) expect(json).not.toContain(member.displayName)
  })

  it('has no meetings for a new club', async () => {
    await expect(createMockClient({ state: createEmptyState() }).listMeetings()).resolves.toEqual({
      upcoming: [],
      past: [],
    })
  })
})

describe('mock meeting detail', () => {
  it('returns a visible record with the published summary, highlights in order and attendance', async () => {
    const detail = await createMockClient().getMeeting('mt1')

    expect(detail).toMatchObject({
      id: 'mt1',
      upcoming: false,
      cancelled: false,
      book: { id: 'b3' },
      assignment: { weekNumber: 1 },
    })
    expect(detail.attendance?.map((m) => m.displayName)).toEqual(['Lucía', 'Mateo', 'Carmen', 'Inés', 'Jordi'])
    expect(detail.record.status).toBe('visible')
    if (detail.record.status !== 'visible') return
    expect(detail.record.summary).toMatch(/^Empezamos «La Regenta»/)
    expect(detail.record.highlights.map((h) => [h.id, h.kind, h.speakers.map((s) => s.displayName)])).toEqual([
      ['h1', 'quote', ['Carmen']],
      ['h2', 'paraphrase', ['Carmen', 'Jordi']],
      ['h3', 'paraphrase', []],
    ])
  })

  it.each(['member', 'admin'] as const)('never returns draft summaries or draft highlights to a %s', async (session) => {
    const state = createClubState()
    state.completions.w1 = state.members.map((m) => m.id)
    const api = createMockClient({ state, session })

    const mt1 = JSON.stringify(await api.getMeeting('mt1'))
    expect(mt1).not.toContain('Borrador')
    expect(mt1).not.toContain('"h4"')

    const mt7 = await api.getMeeting('mt7')
    expect(mt7.record).toEqual({ status: 'visible', summary: null, highlights: [] })
    expect(JSON.stringify(mt7)).not.toContain('Borrador')
  })

  it('says whether the meeting is upcoming and leaves unrecorded attendance as null', async () => {
    const api = createMockClient()
    await expect(api.getMeeting('mt3')).resolves.toMatchObject({ upcoming: true, attendance: null })
    await expect(api.getMeeting('mt7')).resolves.toMatchObject({ upcoming: false, attendance: null, book: null })
  })

  it('locks a meeting whose week the user has not read, with only the week number', async () => {
    const state = createClubState()
    const detail = await createMockClient({ state }).getMeeting('mt2')

    expect(detail.record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 2 })
    expect(detail.assignment).toMatchObject({ weekNumber: 2, pageStart: 99, pageEnd: 204 })
    expectLockedWithoutGatedData(state, detail)
  })

  it('shows the same meeting to a member who completed the week', async () => {
    const detail = await createMockClient({ session: 'member' }).getMeeting('mt2')
    expect(detail.record).toMatchObject({ status: 'visible', summary: expect.stringMatching(/^La segunda semana/) })
  })

  it('decides at call time: completing a week unlocks its meeting and uncompleting locks it again', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    expect((await api.getMeeting('mt2')).record.status).toBe('lockedWeekNotRead')

    await api.setWeekCompleted('w2', true)
    expect((await api.getMeeting('mt2')).record.status).toBe('visible')

    await api.setWeekCompleted('w2', false)
    const locked = await api.getMeeting('mt2')
    expect(locked.record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 2 })
    expectLockedWithoutGatedData(state, locked)
  })

  it('unlocks only the meeting of the completed week', async () => {
    const state = createClubState()
    state.completions.w2 = []
    state.meetings.find((m) => m.id === 'mt3')!.summary = { published: true, text: 'Resumen ficticio de la semana 3.' }
    const api = createMockClient({ state, session: 'member' })

    await api.setWeekCompleted('w2', true)
    expect((await api.getMeeting('mt2')).record.status).toBe('visible')
    const mt3 = await api.getMeeting('mt3')
    expect(mt3.record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 3 })
    expectLockedWithoutGatedData(state, mt3)
  })

  it('shows a meeting without a linked week only when it is marked safe', async () => {
    const state = createClubState()
    const api = createMockClient({ state, session: 'member' })

    expect((await api.getMeeting('mt5')).record).toMatchObject({ status: 'visible', summary: expect.stringMatching(/Niebla/) })
    const unsafe = await api.getMeeting('mt6')
    expect(unsafe.record).toEqual({ status: 'lockedNoWeek' })
    expectLockedWithoutGatedData(state, unsafe)
  })

  it('applies the same gate to the admin', async () => {
    const state = createClubState()
    const admin = createMockClient({ state, session: 'admin' })

    const week = await admin.getMeeting('mt2')
    expect(week.record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 2 })
    expectLockedWithoutGatedData(state, week)
    const noWeek = await admin.getMeeting('mt6')
    expect(noWeek.record).toEqual({ status: 'lockedNoWeek' })
    expectLockedWithoutGatedData(state, noWeek)
    expect((await admin.getMeeting('mt5')).record.status).toBe('visible')

    await admin.setWeekCompleted('w2', true)
    expect((await admin.getMeeting('mt2')).record.status).toBe('visible')
  })

  it('leaves getBook without summaries or highlights', async () => {
    const json = JSON.stringify(await createMockClient({ session: 'member' }).getBook('b3'))
    expect(json).not.toMatch(/summary|highlight/i)
    expect(json).not.toContain('Vetusta no es una ciudad')
  })

  it('rejects an unknown meeting with a 404', async () => {
    const error = await createMockClient().getMeeting('no-existe').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })

  it('can fail the meeting calls', async () => {
    const api = createMockClient({ failures: { listMeetings: 1, getMeeting: 1 } })

    await expect(api.listMeetings()).rejects.toMatchObject({ status: 500 })
    await expect(api.listMeetings()).resolves.toMatchObject({ upcoming: [{ id: 'mt3' }, { id: 'mt4' }] })
    await expect(api.getMeeting('mt1')).rejects.toMatchObject({ status: 500 })
    await expect(api.getMeeting('mt1')).resolves.toMatchObject({ id: 'mt1' })
  })

  describe.each(['anonymous', 'denied'] as MockSession[])('while the session is %s', (session) => {
    it('refuses both calls with a 401 before any 404', async () => {
      const api = createMockClient({ session })
      await expect(api.listMeetings()).rejects.toMatchObject({ status: 401 })
      await expect(api.getMeeting('mt1')).rejects.toMatchObject({ status: 401 })
      await expect(api.getMeeting('no-existe')).rejects.toMatchObject({ status: 401 })
    })
  })
})
