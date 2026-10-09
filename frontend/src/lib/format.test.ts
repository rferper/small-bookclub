import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatAuthors,
  formatCalendarDate,
  formatLongDate,
  formatMeetingDate,
  formatMeetingDateWithYear,
  formatMeetingDay,
  formatMeetingTime,
  formatPageRange,
  formatPercentRange,
  formatReadingDates,
  formatShortDay,
  formatTitles,
  formatVoteCount,
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
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('formats an exact date in Spanish', () => {
    expect(formatCalendarDate('2025-03-01')).toBe('1 de marzo de 2025')
  })

  it('shows only the month and year of an approximate date', () => {
    expect(formatCalendarDate('2024-10-01', true)).toBe('octubre de 2024')
  })

  it('never moves a date to the day before, whatever the machine timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Madrid', 'UTC']) {
      // Node applies a changed TZ to later Date calls.
      vi.stubEnv('TZ', tz)
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

describe('meeting dates with the year', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('formats a meeting date-time in Spanish with the year, in the club timezone', () => {
    // 17:30 UTC is 19:30 in Madrid (CEST).
    expect(formatMeetingDateWithYear('2026-09-24T17:30:00Z', 'Europe/Madrid')).toBe(
      'jueves, 24 de septiembre de 2026, 19:30',
    )
    expect(formatMeetingDay('2026-09-24T19:30:00+02:00', 'Europe/Madrid')).toBe('jueves, 24 de septiembre de 2026')
    expect(formatMeetingTime('2026-09-24T19:30:00+02:00', 'Europe/Madrid')).toBe('19:30')
  })

  it('uses the club calendar day when it differs from the UTC day, even across a new year', () => {
    // 23:30 UTC on 31 December is 00:30 on 1 January in Madrid (CET).
    expect(formatMeetingDateWithYear('2025-12-31T23:30:00Z', 'Europe/Madrid')).toBe('jueves, 1 de enero de 2026, 00:30')
    expect(formatMeetingDateWithYear('2025-12-31T23:30:00Z', 'UTC')).toBe('miércoles, 31 de diciembre de 2025, 23:30')
  })

  it('does not change with the machine timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Madrid', 'UTC']) {
      vi.stubEnv('TZ', tz)
      expect(formatMeetingDateWithYear('2025-12-31T23:30:00Z', 'Europe/Madrid')).toBe('jueves, 1 de enero de 2026, 00:30')
      expect(formatMeetingDateWithYear('2026-09-24T19:30:00+02:00')).toBe('jueves, 24 de septiembre de 2026, 19:30')
    }
  })

  it('leaves the existing meeting date without the year', () => {
    expect(formatMeetingDate('2026-09-24T19:30:00+02:00', 'Europe/Madrid')).toBe('jueves, 24 de septiembre, 19:30')
  })

  it('formats vote dates with the year in the club timezone', () => {
    expect(formatLongDate('2026-09-14T21:00:00+02:00', 'Europe/Madrid')).toBe('14 de septiembre de 2026')
    // 23:30 UTC on the 30th is already 1 October in Madrid, but not in New York.
    expect(formatLongDate('2026-09-30T23:30:00Z', 'Europe/Madrid')).toBe('1 de octubre de 2026')
    expect(formatLongDate('2026-09-30T23:30:00Z', 'America/New_York')).toBe('30 de septiembre de 2026')
  })

  it('formats vote counts with Spanish plurals', () => {
    expect(formatVoteCount(0)).toBe('Sin votos todavía')
    expect(formatVoteCount(0, false)).toBe('Sin votos')
    expect(formatVoteCount(1)).toBe('1 voto')
    expect(formatVoteCount(3, false)).toBe('3 votos')
  })

  it('lists titles in Spanish quotes', () => {
    expect(formatTitles(['A'])).toBe('«A»')
    expect(formatTitles(['A', 'B'])).toBe('«A» y «B»')
    expect(formatTitles(['A', 'B', 'C'])).toBe('«A», «B» y «C»')
  })
})
