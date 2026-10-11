import { describe, expect, it } from 'vitest'
import type { CriterionScores, HomeData } from '../types'
import { createClubState, type MockActivity, type MockState } from './fixtures'
import { createMockClient } from './mockClient'

const scores: CriterionScores = { disfrute: 4, estilo: 4, personajes: 4, trama: 4, huella: 4 }
const event = (type: MockActivity['type'], subject: Partial<MockActivity> = {}): MockActivity => ({
  id: `private-${type}`, type, text: `PRIVATE_EVENT_${type}`, occurredAt: '2026-10-01T15:43:21Z', ...subject,
})
const withoutEvent = (home: HomeData, hidden: MockActivity) => {
  const json = JSON.stringify(home)
  for (const value of [hidden.id, hidden.text, hidden.occurredAt]) expect(json).not.toContain(value)
}
const lockedState = () => {
  const state = createClubState()
  state.finished = {}
  state.reviews = state.reviews.filter((r) => r.userId !== 'm1')
  state.activity = [event('review_available', { bookId: 'b2' })]
  return state
}

describe('Home review privacy', () => {
  it('hidden-review additions and the obsolete global counter cannot change the serialized response', async () => {
    const state = lockedState(), api = createMockClient({ state, random: () => 0 })
    const before = JSON.stringify(await api.getHome())
    state.reviews.push({ ...state.reviews[0], bookId: 'b3', userId: 'm7', text: 'PRIVATE_REVIEW', scores })
    state.reviewCount += 1000
    expect(JSON.stringify(await api.getHome())).toBe(before)
    expect((await api.getHome()).stats.reviews).toBe(0)
    withoutEvent(await api.getHome(), state.activity[0])
  })

  it('finishing alone stays locked; submitting unlocks actual reviews and editing does not inflate counts', async () => {
    const state = lockedState(), api = createMockClient({ state })
    await api.setBookFinished('b2', true)
    expect((await api.getHome()).stats.reviews).toBe(0)
    withoutEvent(await api.getHome(), state.activity[0])
    await api.saveMyReview('b2', { scores, text: 'OWN_REVIEW' })
    const unlocked = await api.getHome()
    expect(unlocked.stats.reviews).toBe(4)
    expect(unlocked.recentActivity).toEqual([{ id: state.activity[0].id, type: 'review_available', occurredAt: state.activity[0].occurredAt, text: state.activity[0].text }])
    expect(JSON.stringify(unlocked)).not.toMatch(/OWN_REVIEW|scores|PRIVATE_REVIEW/)
    await api.saveMyReview('b2', { scores: { ...scores, huella: 5 }, text: 'EDITED_REVIEW' })
    expect((await api.getHome()).stats.reviews).toBe(4)
    await expect(api.setBookFinished('b2', false)).rejects.toMatchObject({ status: 409 })
    expect((await api.getHome()).stats.reviews).toBe(4)
  })

  it('counts multiple unlocked visible books like statistics, retaining revoked historical reviews', async () => {
    const state = createClubState(), api = createMockClient({ state })
    expect((await api.getHome()).stats.reviews).toBe(13)
    await api.revokeMember('m3')
    expect((await api.getHome()).stats.reviews).toBe(13)
    const ratings = (await api.getStatistics()).ratings
    expect(ratings.status).toBe('available')
    if (ratings.status === 'available') expect((await api.getHome()).stats.reviews).toBe(ratings.reviewCount)
    await api.deleteBook('b2')
    expect((await api.getHome()).stats.reviews).toBe(9)
    withoutEvent(await api.getHome(), { ...state.activity.find((a) => a.id === 'a4')!, occurredAt: 'unused-private-time' })
    await api.restoreDeleted('book', 'b2')
    expect((await api.getHome()).stats.reviews).toBe(13)
    expect((await api.getHome()).recentActivity.map((a) => a.id)).toContain('a4')
  })

  it.each(['admin', 'member', 'curator'] as const)('ordinary Home gives the same access to the same viewer as %s', async (role) => {
    const state = lockedState()
    state.members.find((m) => m.id === 'm1')!.role = role === 'admin' ? 'admin' : 'member'
    state.curatorId = role === 'curator' ? 'm1' : null
    const api = createMockClient({ state })
    expect((await api.getHome()).stats.reviews).toBe(0)
    withoutEvent(await api.getHome(), state.activity[0])
    await api.setBookFinished('b2', true)
    await api.saveMyReview('b2', { scores, text: null })
    expect((await api.getHome()).stats.reviews).toBe(4)
  })

  it.each([undefined, 'unknown'])('omits a review event without a verifiable book (%s)', async (bookId) => {
    const state = createClubState()
    const hidden = event('review_available', { bookId })
    state.activity = [hidden]
    withoutEvent(await createMockClient({ state }).getHome(), hidden)
  })
})

describe('Home summary privacy', () => {
  const setup = () => {
    const state = createClubState()
    const hidden = event('summary_published', { meetingId: 'mt2' })
    state.activity = [hidden]
    state.completions.w2 = []
    return { state, hidden, api: createMockClient({ state }) }
  }

  it('tracks actual linked completion and relocking, leaving no event metadata when locked', async () => {
    const { state, hidden, api } = setup()
    withoutEvent(await api.getHome(), hidden)
    expect((await api.getMeeting('mt2')).record.status).toBe('lockedWeekNotRead')
    await api.setWeekCompleted('w2', true)
    expect((await api.getHome()).recentActivity.map((a) => a.id)).toEqual([hidden.id])
    expect((await api.getMeeting('mt2')).record.status).toBe('visible')
    await api.setWeekCompleted('w2', false)
    withoutEvent(await api.getHome(), hidden)
    expect(state.activity).toEqual([hidden])
  })

  const blocked: [string, (state: MockState) => void][] = [
    ['removed linked week even when marked safe', (s) => { s.weeks.find((w) => w.id === 'w2')!.deletedAt = s.now; s.meetings.find((m) => m.id === 'mt2')!.markedSafe = true }],
    ['unpublished summary', (s) => { s.meetings.find((m) => m.id === 'mt2')!.summary!.published = false }],
    ['missing summary', (s) => { s.meetings.find((m) => m.id === 'mt2')!.summary = null }],
    ['cancelled meeting', (s) => { s.meetings.find((m) => m.id === 'mt2')!.cancelled = true }],
    ['removed meeting', (s) => { s.meetings.find((m) => m.id === 'mt2')!.deletedAt = s.now }],
    ['removed parent book', (s) => { s.books.find((b) => b.id === 'b3')!.deletedAt = s.now }],
    ['unsafe unlinked meeting', (s) => { s.weeks.find((w) => w.id === 'w2')!.meetingId = null }],
  ]
  it.each(blocked)('suppresses stale text after %s', async (_label, change) => {
    const { state, hidden, api } = setup()
    state.completions.w2 = ['m1']
    expect((await api.getHome()).recentActivity).toHaveLength(1)
    change(state)
    withoutEvent(await api.getHome(), hidden)
    expect(state.activity).toEqual([hidden])
  })

  it('permits explicitly safe unlinked summaries and composes real removal/recovery with current gates', async () => {
    const { state, hidden, api } = setup()
    state.weeks.find((w) => w.id === 'w2')!.meetingId = null
    state.meetings.find((m) => m.id === 'mt2')!.markedSafe = true
    expect((await api.getMeeting('mt2')).record.status).toBe('visible')
    expect((await api.getHome()).recentActivity).toHaveLength(1)
    await api.deleteMeeting('mt2')
    withoutEvent(await api.getHome(), hidden)
    await api.restoreDeleted('meeting', 'mt2')
    expect((await api.getHome()).recentActivity).toHaveLength(1)
    state.meetings.find((m) => m.id === 'mt2')!.markedSafe = false
    withoutEvent(await api.getHome(), hidden)
  })

  it('restoring a removed linked week restores only currently unlocked summary activity', async () => {
    const { state, hidden, api } = setup()
    await api.setWeekCompleted('w2', true)
    await api.removeReadingWeek('b3', 'w2')
    withoutEvent(await api.getHome(), hidden)
    expect((await api.getMeeting('mt2')).record.status).toBe('lockedNoWeek')
    await api.restoreDeleted('week', 'w2')
    expect((await api.getHome()).recentActivity).toHaveLength(1)
    expect(state.activity).toEqual([hidden])
    await api.setWeekCompleted('w2', false)
    withoutEvent(await api.getHome(), hidden)
  })

  it.each([undefined, 'unknown'])('omits summaries without verifiable meeting provenance (%s)', async (meetingId) => {
    const { state, api } = setup()
    const hidden = event('summary_published', { meetingId, bookId: 'b2' })
    state.activity = [hidden]
    withoutEvent(await api.getHome(), hidden)
  })

  it.each(['admin', 'member', 'curator'] as const)('uses the weekly predicate for a %s with the same completion', async (role) => {
    const { state, hidden } = setup()
    state.members.find((m) => m.id === 'm1')!.role = role === 'admin' ? 'admin' : 'member'
    state.curatorId = role === 'curator' ? 'm1' : null
    const api = createMockClient({ state })
    withoutEvent(await api.getHome(), hidden)
    await api.setWeekCompleted('w2', true)
    expect((await api.getHome()).recentActivity).toHaveLength(1)
  })

  it('keeps ordinary activity copy/order, public progress and vote approvals', async () => {
    const state = lockedState(), api = createMockClient({ state })
    const ordinary = createClubState().activity.filter((a) => !['review_available', 'summary_published'].includes(a.type))
    ordinary.push(event('nomination_added', { id: 'public-nomination', bookId: 'b5', occurredAt: '2026-10-01T15:43:22Z' }))
    state.activity.push(...ordinary)
    const home = await api.getHome()
    expect(home.recentActivity).toEqual(ordinary.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map(({ id, type, text, occurredAt }) => ({ id, type, text, occurredAt })))
    expect(home.memberProgress).toHaveLength(7)
    expect((await api.getVotes()).current!.candidates.some((c) => c.approvals.length > 0)).toBe(true)
    expect(Object.keys(home.stats).sort()).toEqual(['booksCompleted', 'members', 'reviews'])
    withoutEvent(home, state.activity[0])
  })
})
