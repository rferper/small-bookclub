import { describe, expect, it } from 'vitest'
import { createClubState } from './fixtures'
import { createMockClient } from './mockClient'

describe('book schedule completion', () => {
  it.each(['admin', 'member', 'curator'] as const)('keeps %s changes isolated and idempotent', async (session) => {
    const state = createClubState()
    const api = createMockClient({ state, session })
    const before = structuredClone(state.completions)
    const id = state.currentUserId
    expect((await api.getBook('b3')).schedule.find((w) => w.id === 'w3')).toMatchObject({ completedByMe: before.w3.includes(id) })
    await api.setWeekCompleted('w3', true)
    await api.setWeekCompleted('w3', true)
    expect(state.completions.w3.filter((member) => member === id)).toHaveLength(1)
    expect(state.completions.w3.filter((member) => member !== id)).toEqual(before.w3.filter((member) => member !== id))
    expect(state.completions.w1).toEqual(before.w1)
    expect(state.completions.w2).toEqual(before.w2)
    expect((await api.getBook('b3')).schedule.find((w) => w.id === 'w3')).toMatchObject({ completedByMe: true })
    const home = await api.getHome()
    expect(home.currentWeek?.completedByMe).toBe(true)
    expect(home.memberProgress.find((entry) => entry.member.id === id)?.completed).toBe(true)
    await api.setWeekCompleted('w3', false)
    await api.setWeekCompleted('w3', false)
    expect(state.completions.w3).toEqual(before.w3.filter((member) => member !== id))
    expect((await api.getBook('b3')).schedule.find((w) => w.id === 'w3')).toMatchObject({ completedByMe: false })
  })

  it.each(['leyendo', 'terminado', 'archivado'] as const)('allows every assignment on a %s book without finishing it', async (status) => {
    const state = createClubState()
    state.books.find((book) => book.id === 'b3')!.status = status
    const api = createMockClient({ state })
    const before = await api.getBookRatings('b3')
    for (const week of (await api.getBook('b3')).schedule) await api.setWeekCompleted(week.id, true)
    expect((await api.getBook('b3')).schedule.every((week) => week.completedByMe)).toBe(true)
    expect(await api.getBookRatings('b3')).toEqual(before)
    for (const week of (await api.getBook('b3')).schedule) await api.setWeekCompleted(week.id, false)
    expect((await api.getBook('b3')).schedule.every((week) => !week.completedByMe)).toBe(true)
  })

  it('unlocks and relocks only the linked published meeting record', async () => {
    const state = createClubState()
    state.completions.w1 = state.completions.w1.filter((id) => id !== 'm1')
    const api = createMockClient({ state })
    expect((await api.getMeeting('mt2')).record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 2 })
    await api.setWeekCompleted('w2', true)
    expect((await api.getMeeting('mt2')).record).toMatchObject({ status: 'visible', summary: state.meetings.find((m) => m.id === 'mt2')!.summary!.text })
    expect((await api.getMeeting('mt1')).record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 1 })
    expect(JSON.stringify(await api.getBook('b3'))).not.toMatch(/summary|highlight|rating|review|score/i)
    await api.setWeekCompleted('w2', false)
    expect((await api.getMeeting('mt2')).record).toEqual({ status: 'lockedWeekNotRead', weekNumber: 2 })
  })

  it('changes nothing for an unknown week', async () => {
    const state = createClubState()
    const before = structuredClone(state.completions)
    const api = createMockClient({ state })
    await expect(api.setWeekCompleted('missing', true)).rejects.toMatchObject({ status: 404 })
    expect(state.completions).toEqual(before)
  })
})
