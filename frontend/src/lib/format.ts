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
