import { describe, expect, it } from 'vitest'
import {
  formatAuthors,
  formatMeetingDate,
  formatPageRange,
  formatPercentRange,
  formatShortDay,
  initials,
} from './format'

describe('format helpers', () => {
  it('shows meeting times in the club timezone, not the browser timezone', () => {
    // 17:30 UTC is 19:30 in Madrid (CEST) and 13:30 in New York.
    expect(formatMeetingDate('2026-10-15T17:30:00Z', 'Europe/Madrid')).toBe('jueves, 15 de octubre, 19:30')
    expect(formatShortDay('2026-10-15T17:30:00Z', 'Europe/Madrid')).toBe('jueves 15')
  })

  it('handles a meeting just after midnight in the club timezone', () => {
    // 22:30 UTC on Wednesday is 00:30 on Thursday in Madrid.
    expect(formatShortDay('2026-10-14T22:30:00Z', 'Europe/Madrid')).toBe('jueves 15')
  })

  it('formats reading ranges', () => {
    expect(formatPercentRange(25, 40)).toBe('25–40 %')
    expect(formatPageRange(82, 130)).toBe('páginas 82–130')
  })

  it('joins authors in Spanish', () => {
    expect(formatAuthors(['Ana'])).toBe('Ana')
    expect(formatAuthors(['Ana', 'Luis'])).toBe('Ana y Luis')
  })

  it('builds initials for avatar placeholders', () => {
    expect(initials('Lucía')).toBe('L')
    expect(initials('María José Ruiz')).toBe('MJ')
  })
})
