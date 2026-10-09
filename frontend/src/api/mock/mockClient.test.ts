import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient } from './mockClient'

describe('mock API client', () => {
  it('picks the reading week linked to the next meeting', async () => {
    const home = await createMockClient().getHome()

    expect(home.currentBook?.title).toBe('La Regenta')
    expect(home.currentWeek).toMatchObject({ weekNumber: 3, percentStart: 25, percentEnd: 40, pageStart: 205, pageEnd: 330 })
    expect(home.nextMeeting?.assignment).toEqual({
      weekNumber: 3,
      percentStart: 25,
      percentEnd: 40,
      pageStart: 205,
      pageEnd: 330,
    })
  })

  it('marking a week read changes only the signed-in member', async () => {
    const state = createClubState()
    const api = createMockClient({ state })

    await api.setWeekCompleted('w3', true)
    const home = await api.getHome()

    expect(home.currentWeek?.completedByMe).toBe(true)
    expect(state.completions.w3.sort()).toEqual(['m1', 'm3', 'm6'])

    await api.setWeekCompleted('w3', false)
    expect(state.completions.w3.sort()).toEqual(['m3', 'm6'])
  })

  it('rejects an unknown week', async () => {
    await expect(createMockClient().setWeekCompleted('nope', true)).rejects.toBeInstanceOf(ApiError)
  })

  it('returns empty sections for a new club', async () => {
    const home = await createMockClient({ state: createEmptyState() }).getHome()

    expect(home).toMatchObject({
      currentBook: null,
      currentWeek: null,
      nextMeeting: null,
      memberProgress: [],
      recentActivity: [],
      quote: null,
    })
  })

  it('can be configured to fail a call a number of times', async () => {
    const api = createMockClient({ failures: { getHome: 1, setWeekCompleted: Infinity } })

    await expect(api.getHome()).rejects.toMatchObject({ status: 500 })
    await expect(api.getHome()).resolves.toMatchObject({ currentBook: { title: 'La Regenta' } })
    await expect(api.setWeekCompleted('w3', true)).rejects.toBeInstanceOf(ApiError)
    await expect(api.setWeekCompleted('w3', true)).rejects.toBeInstanceOf(ApiError)
    await expect(api.getCurrentUser()).resolves.toMatchObject({ id: 'm1' })
  })

  it('chooses the quote with the injected random source', async () => {
    const home = await createMockClient({ random: () => 0.99 }).getHome()
    expect(home.quote?.source).toBe('Francisco de Quevedo')
  })
})
