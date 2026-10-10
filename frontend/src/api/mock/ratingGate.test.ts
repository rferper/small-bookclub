import { describe, expect, it } from 'vitest'
import { createClubState } from './fixtures'
import { ratingGate } from './ratingGate'

describe('rating gate', () => {
  it('is locked when the user has neither finished nor rated the book', () => {
    expect(ratingGate({ userId: 'u1', finishedBy: ['u2'], reviewerIds: ['u2'] })).toEqual({ visible: false })
  })

  it('is locked when the user has only finished the book', () => {
    expect(ratingGate({ userId: 'u1', finishedBy: ['u1', 'u2'], reviewerIds: ['u2'] })).toEqual({ visible: false })
  })

  it('is locked when the user has a review but has not marked the book finished', () => {
    expect(ratingGate({ userId: 'u1', finishedBy: ['u2'], reviewerIds: ['u1', 'u2'] })).toEqual({ visible: false })
  })

  it('is visible once the user has finished the book and submitted a review', () => {
    expect(ratingGate({ userId: 'u1', finishedBy: ['u1'], reviewerIds: ['u1'] })).toEqual({ visible: true })
  })

  it('gives the admin the same answer as a member in the same situation', () => {
    const { members } = createClubState()
    const admin = members.find((m) => m.role === 'admin')!.id
    const member = members.find((m) => m.role === 'member')!.id
    const cases = [
      [[], []],
      [['X'], []],
      [[], ['X']],
      [['X'], ['X']],
    ] as const
    for (const [finished, reviewers] of cases) {
      const answer = (userId: string) =>
        ratingGate({
          userId,
          finishedBy: finished.map((id) => (id === 'X' ? userId : id)),
          reviewerIds: reviewers.map((id) => (id === 'X' ? userId : id)),
        })
      expect(answer(admin)).toEqual(answer(member))
    }
    // Others' activity never unlocks it for the admin.
    expect(ratingGate({ userId: admin, finishedBy: [member], reviewerIds: [member] })).toEqual({ visible: false })
  })
})
