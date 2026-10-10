import { describe, expect, it, vi } from 'vitest'
import { meetingInstant, meetingLocalValues } from './meetingTime'

describe('club local meeting times', () => {
  it.each([['2026-01-15', '2026-01-15T18:30:00.000Z'], ['2026-07-15', '2026-07-15T17:30:00.000Z']])('round trips %s in Madrid independently of the process timezone', (date, expected) => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    try {
      expect(meetingInstant(date, '19:30', 'Europe/Madrid')).toBe(expected)
      expect(meetingLocalValues(expected, 'Europe/Madrid')).toEqual({ date, time: '19:30' })
    } finally { vi.unstubAllEnvs() }
  })
  it('refuses DST gaps and folds with specific guidance', () => {
    expect(() => meetingInstant('2026-03-29', '02:30', 'Europe/Madrid')).toThrow('no existe')
    expect(() => meetingInstant('2026-10-25', '02:30', 'Europe/Madrid')).toThrow('ambigua')
  })
  it.each([['', '19:30'], ['2026-02-30', '19:30'], ['2026-01-01', '24:00'], ['0000-01-01', '12:00']])('refuses invalid %s %s', (date, time) => {
    expect(() => meetingInstant(date, time)).toThrow('válidas')
  })
  it('supports a configured zone with a fractional offset', () => {
    expect(meetingInstant('2026-07-15', '19:30', 'Asia/Kathmandu')).toBe('2026-07-15T13:45:00.000Z')
  })
})
