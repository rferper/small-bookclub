import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../client'
import { blankBookInput } from '../../lib/catalogue'
import { applyVoteScenario, createClubState, createEmptyState } from './fixtures'
import { createMockClient } from './mockClient'

const methods = ['getBackupInfo', 'getAuditLog', 'exportClubData'] as const
describe('administrative operations permissions and payloads', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as const)('denies all operations without payload before failure injection: %s', async (session) => {
    const state = createClubState(), client = createMockClient({ state, session, failures: Object.fromEntries(methods.map((m) => [m, 1])) })
    const before = structuredClone(state)
    for (const method of methods) {
      await expect(client[method]()).rejects.toMatchObject({ status: ['anonymous', 'denied'].includes(session) ? 401 : 403 })
      try { await client[method]() } catch (error) { expect(JSON.stringify(error)).not.toMatch(/Lucía|Mateo|books|summary|audit|lastBackup|discordId/) }
    }
    expect(state).toEqual(before)
    state.session = 'signedIn'; state.currentUserId = 'm1'
    for (const method of methods) await expect(client[method]()).rejects.toMatchObject({ status: 500 })
  })
  it('checks effective role on each call and 409 does not expire the session or change state', async () => {
    const state = createClubState(), client = createMockClient({ state, exportReauthorisationRequired: true }), before = structuredClone(state)
    await expect(client.exportClubData()).rejects.toMatchObject({ status: 409, message: 'Se necesita volver a autorizar la exportación. En esta demostración no se realiza una reautenticación real.' })
    expect(state).toEqual(before); expect((await client.getSession()).status).toBe('signedIn')
    state.currentUserId = 'm2'
    for (const method of methods) await expect(client[method]()).rejects.toMatchObject({ status: 403 })
  })
  it('never invents backups and explicitly supplied timestamps remain simulated', async () => {
    const state = createClubState(), client = createMockClient({ state })
    expect(await client.getBackupInfo()).toEqual({ policy: 'pending', lastBackupAt: null })
    state.lastBackupAt = state.now
    expect(await client.getBackupInfo()).toEqual({ policy: 'pending', lastBackupAt: state.now })
  })
})

describe('explicit current-state fictional export', () => {
  it('includes canonical private business records, pending writes, recovery/tombstones and safe audit without control state', async () => {
    const state = createClubState(), client = createMockClient({ state })
    Object.assign(state, { token: 'secret-state', failures: 'secret-option' })
    Object.assign(state.members[0], { token: 'secret-member' })
    await client.saveMeetingSummary('mt1', { text: 'Fictional private draft', published: false })
    Object.assign(state.meetings.find((m) => m.id === 'mt1')!.summary!, { token: 'secret-summary' })
    const quote = await client.addLiteraryQuote({ text: 'purged-private-quote', author: null, source: null, active: false })
    await client.deleteLiteraryQuote(quote.id); await client.purgeDeleted('quote', quote.id)
    await client.deleteBook('b3')
    const result = await client.exportClubData()
    if (!('json' in result)) throw new Error('Expected illustrative mock JSON')
    const data = JSON.parse(result.json)
    expect(result.filename).toBe('club-de-lectura-demostracion.json')
    expect(data).toMatchObject({ schemaVersion: 1, simulated: true, createdAt: state.now, format: 'mock-json-placeholder' })
    expect(data.books.find((b: { id: string }) => b.id === 'b3').deletedAt).toBe(state.now)
    expect(data.meetings.find((m: { id: string }) => m.id === 'mt1').summary.text).toBe('Fictional private draft')
    for (const key of ['members', 'allowlist', 'profiles', 'books', 'weeks', 'meetings', 'completions', 'finished', 'reviews', 'votes', 'rubric', 'quotes', 'tombstones', 'audit']) expect(data).toHaveProperty(key)
    expect(data.members.some((m: { status: string }) => m.status === 'revoked')).toBe(true)
    expect(data.tombstones).toContainEqual({ type: 'quote', id: quote.id, purgedAt: state.now, purgedBy: 'm1' })
    expect(result.json).not.toMatch(/currentUserId|session|failures|secret-|purged-private-quote/)
    expect(data.audit.some((e: { action: string }) => e.action === 'exported')).toBe(true)
    data.books[0].title = 'consumer edit'; expect(state.books[0].title).not.toBe('consumer edit')
  })
  it('supports an empty club and export failure leaves no success event', async () => {
    const state = createEmptyState(), client = createMockClient({ state, failures: { exportClubData: 1 } })
    await expect(client.exportClubData()).rejects.toMatchObject({ status: 500 }); expect(state.audit).toEqual([])
    const result = await client.exportClubData()
    if (!('json' in result)) throw new Error('Expected illustrative mock JSON')
    const data = JSON.parse(result.json)
    for (const key of ['books', 'weeks', 'meetings', 'completions', 'finished', 'reviews', 'votes', 'quotes', 'tombstones']) expect(data[key]).toEqual([])
    expect(data.audit).toHaveLength(1)
  })
})

describe('safe critical-action audit', () => {
  it('records member lifecycle and curator changes, including clear on revoke, without duplicate/no-op events', async () => {
    const state = createClubState(), client = createMockClient({ state }), n = state.audit!.length
    await client.setCurator('m2'); await client.setCurator('m2')
    await client.revokeMember('m2'); await client.restoreMember('m2')
    await client.addMember({ discordId: '000000000000000199', displayName: 'Ficticia' })
    expect(state.audit!.slice(n).map((e) => e.action)).toEqual(['curator_assigned', 'member_revoked', 'curator_cleared', 'member_restored', 'member_approved'])
    const before = structuredClone(state.audit)
    await expect(client.addMember({ discordId: 'bad', displayName: 'Invalid' })).rejects.toMatchObject({ status: 400 })
    await expect(client.restoreMember('m2')).rejects.toMatchObject({ status: 409 })
    await client.getAuditLog(); await client.getBackupInfo()
    expect(state.audit).toEqual(before)
    await Promise.all([client.setCurator('m3'), client.setCurator('m3')])
    expect(state.audit!.slice(before!.length).map((e) => e.action)).toEqual(['curator_assigned'])
  })
  it('logs status/publication changes only and safe text-free targets survive removal/restore/purge', async () => {
    const state = createClubState()
    state.meetings.find((m) => m.id === 'mt1')!.summary!.published = false
    const client = createMockClient({ state }), n = state.audit!.length
    const book = await client.getAdminBook('b1'), input = { ...blankBookInput(), ...book, status: 'archivado' as const, cover: { action: 'keep' as const } }
    await client.updateBook('b1', input); await client.updateBook('b1', input)
    await client.saveMeetingSummary('mt1', { text: 'secret-summary', published: true })
    await client.saveMeetingSummary('mt1', { text: 'changed-private-content', published: true })
    await client.saveMeetingSummary('mt1', { text: 'secret-summary', published: false })
    const record = await client.createMeetingHighlight('mt1', { text: 'secret-highlight', kind: 'quote', speakerIds: [], published: true })
    const id = record.highlights.at(-1)!.id
    await client.updateMeetingHighlight('mt1', id, { text: 'secret-highlight', kind: 'quote', speakerIds: [], published: false })
    await client.removeMeetingHighlight('mt1', id); await client.restoreDeleted('highlight', id); await client.removeMeetingHighlight('mt1', id); await client.purgeDeleted('highlight', id)
    const events = state.audit!.slice(n)
    expect(events.map((e) => e.action)).toEqual(['book_status_changed', 'summary_published', 'summary_unpublished', 'highlight_published', 'highlight_unpublished', 'soft_deleted', 'restored', 'soft_deleted', 'purged'])
    for (const event of await client.getAuditLog()) {
      expect(Object.keys(event).sort()).toEqual(['action', 'actor', 'id', 'occurredAt', 'target'])
      expect(Object.keys(event.target).sort()).toEqual(['id', 'label', 'type'])
      expect(Object.keys(event.actor).sort()).toEqual(['displayName', 'id'])
    }
    expect(events.filter((e) => e.target.id === id).every((e) => e.target.label === 'Momento destacado')).toBe(true)
    expect(JSON.stringify(await client.getAuditLog())).not.toMatch(/secret-|changed-private|discordId|scores|summary"|bio"|tieNote|speakerIds|avatarUrl/)
    const read = await client.getAuditLog(); read[0].actor.displayName = 'Mutated'; read[0].target.label = 'Mutated'
    expect(JSON.stringify(await client.getAuditLog())).not.toContain('Mutated')
    expect((await client.getAuditLog()).map((e) => e.id)).toEqual([...await client.getAuditLog()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id.localeCompare(a.id)).map((e) => e.id))
  })
  it('covers each soft-delete category and atomic failure boundaries', async () => {
    const state = createClubState(), client = createMockClient({ state }), quote = await client.addLiteraryQuote({ text: 'private quote text', author: null, source: null, active: true })
    const week = (await client.createReadingWeek('b1', { percentStart: 0, percentEnd: 10, pageStart: 1, pageEnd: 10, dueDate: null, notes: null, meetingId: null }, true)).weeks[0]
    const meeting = await client.createMeeting({ startsAt: state.now, bookId: null, weekId: null })
    await client.removeReadingWeek('b1', week.id); await client.deleteMeeting(meeting.id); await client.deleteLiteraryQuote(quote.id); await client.deleteBook('b1')
    expect(state.audit!.filter((e) => e.action === 'soft_deleted').map((e) => e.target.type).sort()).toEqual(['book', 'meeting', 'quote', 'week'])
    await client.restoreDeleted('book', 'b1'); await client.restoreDeleted('week', week.id)
    await client.restoreDeleted('meeting', meeting.id); await client.restoreDeleted('quote', quote.id)
    const before = structuredClone(state.audit)
    const failing = createMockClient({ state, failures: { saveMeetingSummary: 1 } })
    await expect(failing.saveMeetingSummary('mt1', { text: 'private', published: false })).rejects.toMatchObject({ status: 500 })
    await expect(client.purgeDeleted('book', 'b1')).rejects.toMatchObject({ status: 404 })
    expect(state.audit).toEqual(before)
  })
  it('curator closure has its own actor but no audit access; admin resolves tie without retaining note', async () => {
    const state = applyVoteScenario(createClubState(), 'open-tie'), curator = createMockClient({ state, session: 'curator' })
    await curator.closeVote('v2'); expect(state.audit!.at(-1)).toMatchObject({ action: 'vote_closed', actor: { id: 'm6', displayName: 'Jordi' } })
    await expect(curator.getAuditLog()).rejects.toMatchObject({ status: 403 })
    const admin: ApiClient = createMockClient({ state, session: 'admin' })
    await admin.recordTieWinner('v2', 'b5', 'secret-tie-note')
    expect(state.audit!.at(-1)?.action).toBe('tie_resolved')
    expect(JSON.stringify(await admin.getAuditLog())).not.toContain('secret-tie-note')
    const before = structuredClone(state.audit)
    await expect(admin.closeVote('v2')).rejects.toMatchObject({ status: 409 })
    expect(state.audit).toEqual(before)
  })
})
