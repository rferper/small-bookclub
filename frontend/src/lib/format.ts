// Spanish display helpers. Dates are always shown in the club's timezone,
// never the browser's, so every member sees the same meeting time.

export const CLUB_TIMEZONE: string = import.meta.env.VITE_CLUB_TIMEZONE || 'Europe/Madrid'

export function formatMeetingDate(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

// The day of a meeting with its year, e.g. "jueves, 24 de septiembre de 2026".
// Used in Reuniones, where meetings from earlier years are listed too.
export function formatMeetingDay(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

// The start time of a meeting on a 24-hour clock, e.g. "19:30".
export function formatMeetingTime(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(
    new Date(iso),
  )
}

// A meeting date-time with the year, e.g. "jueves, 24 de septiembre de 2026, 19:30".
export function formatMeetingDateWithYear(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return `${formatMeetingDay(iso, timeZone)}, ${formatMeetingTime(iso, timeZone)}`
}

// Short form used inside the weekly label, e.g. "jueves 15".
export function formatShortDay(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', timeZone }).format(new Date(iso))
}

export function formatDayMonth(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone }).format(new Date(iso))
}

export function formatPercentRange(start: number, end: number): string {
  return `${start}–${end} %`
}

export function formatPageRange(start: number, end: number): string {
  return `páginas ${start}–${end}`
}

export function formatAuthors(authors: string[]): string {
  return new Intl.ListFormat('es-ES', { style: 'long', type: 'conjunction' }).format(authors)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

// Calendar dates (YYYY-MM-DD) have no time or timezone: they are read as UTC
// and formatted in UTC, so 2025-03-01 is the 1st of March on every machine.
function parseCalendarDate(date: string | null): Date | null {
  const match = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null
}

// "1 de marzo de 2025", or "marzo de 2025" for an approximate date.
// Returns null for a missing or malformed date, never "Invalid Date".
export function formatCalendarDate(date: string | null, approximate = false): string | null {
  const parsed = parseCalendarDate(date)
  if (!parsed) return null
  return new Intl.DateTimeFormat('es-ES', {
    day: approximate ? undefined : 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export const UNKNOWN_READING_DATES = 'Fechas de lectura desconocidas'

// The club's reading period for a book, with whichever dates are known.
export function formatReadingDates(start: string | null, end: string | null, approximate: boolean): string {
  const from = formatCalendarDate(start, approximate)
  const to = formatCalendarDate(end, approximate)
  const mark = approximate ? ' (aprox.)' : ''
  // Exact dates read "desde el 1 de…"; month-only ones "desde marzo de…".
  const article = approximate ? '' : 'el '
  if (from && to) return `${from} – ${to}${mark}`
  if (from) return `Desde ${article}${from}${mark}`
  if (to) return `Hasta ${article}${to}${mark}`
  return UNKNOWN_READING_DATES
}

// The day of a date-time with its year and no weekday, in the club timezone,
// e.g. "14 de septiembre de 2026". Used for vote dates.
export function formatLongDate(iso: string, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso))
}

// "1 voto", "3 votos". With no votes: «Sin votos todavía» while the vote is
// open, «Sin votos» once it is closed.
export function formatVoteCount(count: number, open = true): string {
  if (count === 0) return open ? 'Sin votos todavía' : 'Sin votos'
  return count === 1 ? '1 voto' : `${count} votos`
}

// Book titles in Spanish quotes as a list, e.g. "«A», «B» y «C»".
export function formatTitles(titles: string[]): string {
  return formatAuthors(titles.map((title) => `«${title}»`))
}

// A member's public status for the current reading week, in Inicio's
// low-pressure wording (#69): never «pendiente», «atrasado» or a ranking.
export function formatWeekStatus(completed: boolean): string {
  return completed ? '✓ Leído' : 'Leyendo'
}
