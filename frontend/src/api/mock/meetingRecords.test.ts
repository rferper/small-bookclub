import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../client'
import type { MeetingHighlightInput, MeetingSummaryInput } from '../types'
import { withUnauthorizedHandler } from '../unauthorized'
import { createClubState } from './fixtures'
import { createMockClient } from './mockClient'

const input: MeetingHighlightInput = { text: 'Texto literal\n<script>historia</script>', kind: 'quote', published: true, speakerIds: ['m1'] }
const operations = (api: ApiClient, id = 'missing') => [
  () => api.getAdminMeetingRecord(id), () => api.saveMeetingSummary(id, { text: '', published: true }),
  () => api.createMeetingHighlight(id, input), () => api.updateMeetingHighlight(id, 'missing', input),
  () => api.reorderMeetingHighlights(id, []), () => api.removeMeetingHighlight(id, 'missing'), () => api.setMeetingRecordSafe(id, true),
]
const methods = ['getAdminMeetingRecord', 'saveMeetingSummary', 'createMeetingHighlight', 'updateMeetingHighlight', 'reorderMeetingHighlights', 'removeMeetingHighlight', 'setMeetingRecordSafe'] as const
const meeting = (state: ReturnType<typeof createClubState>) => state.meetings.find((m) => m.id === 'mt1')!
describe('admin meeting records', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as const)('checks %s before lookup, input or simulated failure', async (session) => {
    const api = createMockClient({ session, failures: Object.fromEntries(methods.map((m) => [m, Infinity])) })
    for (const call of operations(api)) await expect(call()).rejects.toMatchObject({ status: session === 'anonymous' || session === 'denied' ? 401 : 403 })
  })
  it('wraps every operation and gives authorized unknown records 404', async () => {
    let unauthorized = 0
    for (const call of operations(withUnauthorizedHandler(createMockClient({ session: 'anonymous' }), () => unauthorized++))) await expect(call()).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toBe(7)
    for (const call of operations(createMockClient())) await expect(call()).rejects.toMatchObject({ status: 404 })
    const api = createMockClient()
    await expect(api.updateMeetingHighlight('mt1', 'missing', input)).rejects.toMatchObject({ status: 404 })
    await expect(api.removeMeetingHighlight('mt1', 'missing')).rejects.toMatchObject({ status: 404 })
  })
  it('all configured failures are atomic, with explicit editor projection', async () => {
    const state = createClubState(), original = JSON.stringify(state)
    const api = createMockClient({ state, failures: Object.fromEntries(methods.map((m) => [m, 1])) })
    for (const call of operations(api, 'mt1')) await expect(call()).rejects.toMatchObject({ status: 500 })
    expect(JSON.stringify(state)).toBe(original)
    const record = await api.getAdminMeetingRecord('mt1')
    expect(Object.keys(record).sort()).toEqual(['book','cancelled','highlights','id','markedSafe','speakerOptions','startsAt','summary','week'])
    expect(Object.keys(record.highlights[0]).sort()).toEqual(['id','kind','published','speakerIds','speakers','text'])
    expect(Object.keys(record.speakerOptions[0]).sort()).toEqual(['avatarUrl','displayName','id'])
    expect(JSON.stringify(record)).not.toMatch(/discordId|bio|scores|reviews|rating|overall/)
    record.highlights[0].speakerIds.push('unknown')
    expect(meeting(state).highlights[0].speakerIds).not.toContain('unknown')
  })
  it('publishes independently, retains literal breaks, and never exposes drafts to admin member reads', async () => {
    const state = createClubState(), api = createMockClient({ state })
    await api.saveMeetingSummary('mt1', { text: '  <b>Resumen</b>\nsegunda línea  ', published: false })
    const saved = await api.createMeetingHighlight('mt1', input), id = saved.highlights.at(-1)!.id
    expect(saved.summary?.text).toBe('<b>Resumen</b>\nsegunda línea')
    expect((await api.getMeeting('mt1')).record).toEqual({ status: 'visible', summary: null, highlights: expect.arrayContaining([expect.objectContaining({ id, text: input.text })]) })
    await api.saveMeetingSummary('mt1', { text: 'Publicado', published: true })
    await api.updateMeetingHighlight('mt1', id, { ...input, published: false })
    const record = (await api.getMeeting('mt1')).record
    expect(record).toMatchObject({ summary: 'Publicado' }); expect(JSON.stringify(record)).not.toContain(input.text)
    await api.saveMeetingSummary('mt1', { text: ' \n ', published: false })
    expect((await api.getAdminMeetingRecord('mt1')).summary).toBeNull()
    await api.setWeekCompleted('w1', false)
    expect((await api.getMeeting('mt1')).record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 1 })
    expect((await api.getAdminMeetingRecord('mt1')).summary).toBeNull()
  })
  it('checks exact limits and invalid input without partial changes', async () => {
    const state = createClubState(), api = createMockClient({ state })
    await api.saveMeetingSummary('mt1', { text: ' '.repeat(2) + 's'.repeat(10000), published: true })
    await api.createMeetingHighlight('mt1', { ...input, text: 'h'.repeat(2000) })
    const before = JSON.stringify(state)
    for (const bad of [{ text: '', published: true }, { text: 's'.repeat(10001), published: false }, { text: 'a', published: 1 }, { text: null, published: false }]) await expect(api.saveMeetingSummary('mt1', bad as MeetingSummaryInput)).rejects.toMatchObject({ status: 400 })
    for (const bad of [{ text: ' ' }, { text: 'h'.repeat(2001) }, { kind: 'unknown' }, { published: 1 }, { speakerIds: ['m1','m1'] }, { speakerIds: ['missing'] }, { speakerIds: ['m8'] }, { speakerIds: null }]) {
      await expect(api.createMeetingHighlight('mt1', { ...input, ...bad } as MeetingHighlightInput)).rejects.toMatchObject({ status: 400 })
      await expect(api.updateMeetingHighlight('mt1', meeting(state).highlights[0].id, { ...input, ...bad } as MeetingHighlightInput)).rejects.toMatchObject({ status: 400 })
    }
    for (const ids of [[], ['missing'], [meeting(state).highlights[0].id, meeting(state).highlights[0].id]]) await expect(api.reorderMeetingHighlights('mt1', ids)).rejects.toMatchObject({ status: 400 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('preserves revoked attribution, accepts unchanged history/removal, rejects new revoked selections', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const saved = await api.createMeetingHighlight('mt1', { ...input, speakerIds: ['m2'] }), id = saved.highlights.at(-1)!.id
    await api.revokeMember('m2')
    const record = await api.getAdminMeetingRecord('mt1')
    expect(record.speakerOptions.map((m) => m.id)).not.toContain('m2')
    expect(record.highlights.find((h) => h.id === id)?.speakers[0].id).toBe('m2')
    await api.updateMeetingHighlight('mt1', id, { ...input, speakerIds: ['m2'] })
    await expect(api.createMeetingHighlight('mt1', { ...input, speakerIds: ['m2'] })).rejects.toMatchObject({ status: 400 })
    await api.updateMeetingHighlight('mt1', id, { ...input, speakerIds: [] })
    await expect(api.updateMeetingHighlight('mt1', id, { ...input, speakerIds: ['m2'] })).rejects.toMatchObject({ status: 400 })
    await api.restoreMember('m2'); await api.updateMeetingHighlight('mt1', id, { ...input, speakerIds: ['m2'] })
    expect((await api.getAdminMeetingRecord('mt1')).speakerOptions.map((m) => m.id)).toContain('m2')
  })
  it('reorders only active ids and retains removed contents/order/deadline while every member projection omits them', async () => {
    const state = createClubState(), api = createMockClient({ state }), saved = await api.createMeetingHighlight('mt1', input)
    const ids = saved.highlights.map((h) => h.id).reverse()
    expect((await api.reorderMeetingHighlights('mt1', ids)).highlights.map((h) => h.id)).toEqual(ids)
    const old = structuredClone(meeting(state).highlights[0])
    await api.removeMeetingHighlight('mt1', old.id)
    expect(meeting(state).highlights[0]).toEqual({ ...old, removedPosition: 0, deletedAt: state.now, deletedBy: state.currentUserId, purgeDueAt: new Date(Date.parse(state.now) + 30*86400000).toISOString() })
    expect(JSON.stringify(await api.getMeeting('mt1'))).not.toContain(input.text)
    await expect(api.removeMeetingHighlight('mt1', old.id)).rejects.toMatchObject({ status: 404 })
    await expect(api.reorderMeetingHighlights('mt1', ids)).rejects.toMatchObject({ status: 400 })
    const active = (await api.getAdminMeetingRecord('mt1')).highlights.map((h) => h.id).reverse()
    await api.reorderMeetingHighlights('mt1', active); expect(meeting(state).highlights[0].id).toBe(old.id)
  })
  it('enforces linked/removed week, cancellation and safe rules and operational no leaks', async () => {
    const state = createClubState(), api = createMockClient({ state })
    await api.saveMeetingSummary('mt1', { text: 'SECRET_SUMMARY', published: true })
    await api.createMeetingHighlight('mt1', { ...input, text: 'SECRET_HIGHLIGHT' })
    for (const safe of [true, false]) await expect(api.setMeetingRecordSafe('mt1', safe)).rejects.toMatchObject({ status: 409 })
    await api.setMeetingCancelled('mt1', true)
    expect((await api.getMeeting('mt1')).record).toEqual({ status: 'lockedNoWeek' })
    expect((await api.getAdminMeetingRecord('mt1')).summary?.text).toBe('SECRET_SUMMARY')
    await api.setMeetingCancelled('mt1', false)
    expect((await api.getMeeting('mt1')).record).toMatchObject({ summary: 'SECRET_SUMMARY' })
    meeting(state).markedSafe = true
    await api.removeReadingWeek('b3','w1')
    expect((await api.getMeeting('mt1')).record).toEqual({ status: 'lockedNoWeek' })
    for (const safe of [true,false]) await expect(api.setMeetingRecordSafe('mt1', safe)).rejects.toMatchObject({ status: 409 })
    expect((await api.getAdminMeetingRecord('mt1')).week?.removed).toBe(true)
    const unlinked = state.meetings.find((m) => !m.cancelled && !state.weeks.some((w) => w.meetingId === m.id))!
    await api.saveMeetingSummary(unlinked.id, { text: 'SAFE_SUMMARY', published: true })
    await api.createMeetingHighlight(unlinked.id, { ...input, text: 'PRIVATE_DRAFT', published: false })
    await api.setMeetingRecordSafe(unlinked.id, false)
    expect((await api.getMeeting(unlinked.id)).record).toEqual({ status: 'lockedNoWeek' })
    await api.setMeetingRecordSafe(unlinked.id, true)
    expect((await api.getMeeting(unlinked.id)).record).toMatchObject({ summary: 'SAFE_SUMMARY' })
    expect(JSON.stringify(await api.getMeeting(unlinked.id))).not.toContain('PRIVATE_DRAFT')
    for (const result of await Promise.all([api.listMeetings(), api.getBook('b3'), api.getHome(), api.getStatistics(), api.listAdminMeetings(), api.getAdminReadingPlan('b3')])) expect(JSON.stringify(result)).not.toMatch(/SECRET_SUMMARY|SECRET_HIGHLIGHT|SAFE_SUMMARY|PRIVATE_DRAFT/)
  })
})
