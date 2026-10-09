import { afterEach, describe, expect, it } from 'vitest'
import {
  formatAuthors,
  formatCalendarDate,
  formatMeetingDate,
  formatPageRange,
  formatPercentRange,
  formatReadingDates,
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

describe('calendar dates', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it('formats an exact date in Spanish', () => {
    expect(formatCalendarDate('2025-03-01')).toBe('1 de marzo de 2025')
  })

  it('shows only the month and year of an approximate date', () => {
    expect(formatCalendarDate('2024-10-01', true)).toBe('octubre de 2024')
  })

  it('never moves a date to the day before, whatever the machine timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Madrid', 'UTC']) {
      process.env.TZ = tz
      expect(formatCalendarDate('2025-03-01')).toBe('1 de marzo de 2025')
      expect(formatCalendarDate('2025-01-01', true)).toBe('enero de 2025')
    }
  })

  it('returns null for a missing or malformed date', () => {
    expect(formatCalendarDate(null)).toBeNull()
    expect(formatCalendarDate('')).toBeNull()
    expect(formatCalendarDate('2025-02-30')).toBeNull()
    expect(formatCalendarDate('marzo')).toBeNull()
  })

  it('formats a reading period with both, one or no dates', () => {
    expect(formatReadingDates('2025-03-01', '2025-04-12', false)).toBe('1 de marzo de 2025 – 12 de abril de 2025')
    expect(formatReadingDates('2026-09-15', null, false)).toBe('Desde el 15 de septiembre de 2026')
    expect(formatReadingDates(null, '2023-06-15', false)).toBe('Hasta el 15 de junio de 2023')
    expect(formatReadingDates(null, null, false)).toBe('Fechas de lectura desconocidas')
  })

  it('marks approximate reading periods', () => {
    expect(formatReadingDates('2024-10-01', '2024-11-30', true)).toBe('octubre de 2024 – noviembre de 2024 (aprox.)')
    expect(formatReadingDates(null, '2023-06-15', true)).toBe('Hasta junio de 2023 (aprox.)')
    expect(formatReadingDates(null, null, true)).toBe('Fechas de lectura desconocidas')
  })
})
