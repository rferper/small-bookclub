import { describe, expect, it } from 'vitest'
import { meetingGate } from './meetingGate'

const week = { id: 'w2', weekNumber: 2 }

describe('meeting gate', () => {
  it('shows a meeting with a linked week only to someone who completed that week', () => {
    const completions = { w2: ['m2'] }
    expect(meetingGate({ week, markedSafe: false, completions, userId: 'm2' })).toEqual({ visible: true })
    expect(meetingGate({ week, markedSafe: false, completions, userId: 'm3' })).toEqual({
      visible: false,
      reason: 'weekNotRead',
      weekNumber: 2,
    })
  })

  it('ignores the safe mark when the meeting has a linked week', () => {
    expect(meetingGate({ week, markedSafe: true, completions: {}, userId: 'm2' })).toMatchObject({ visible: false })
  })

  it('shows a meeting without a linked week only when it is marked safe', () => {
    expect(meetingGate({ week: null, markedSafe: true, completions: {}, userId: 'm2' })).toEqual({ visible: true })
    expect(meetingGate({ week: null, markedSafe: false, completions: {}, userId: 'm2' })).toEqual({
      visible: false,
      reason: 'noWeek',
    })
  })
})
