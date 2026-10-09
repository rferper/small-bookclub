import type { BookStatus, LibraryBook } from '../api/types'

export const BOOK_STATUSES: readonly BookStatus[] = ['propuesto', 'elegido', 'leyendo', 'terminado', 'archivado']

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  propuesto: 'Propuesto',
  elegido: 'Elegido',
  leyendo: 'Leyendo',
  terminado: 'Terminado',
  archivado: 'Archivado',
}

export const isBookStatus = (value: string | null): value is BookStatus => BOOK_STATUSES.includes(value as BookStatus)

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

// The date a book is placed by in time: when the club started it, or when
// it finished it if the start is unknown. Null when neither is known.
export function readingDateKey(book: LibraryBook): string | null {
  for (const date of [book.readingStartDate, book.readingEndDate]) {
    if (date && CALENDAR_DATE.test(date)) return date
  }
  return null
}

// Spanish collation: «Ángel» sorts with the A's, not after the Z's.
const titleCollator = new Intl.Collator('es', { sensitivity: 'base' })

export const compareTitles = (a: LibraryBook, b: LibraryBook) => titleCollator.compare(a.title, b.title)

export function sortByTitle(books: readonly LibraryBook[]): LibraryBook[] {
  return [...books].sort(compareTitles)
}

// Newest first; books without dates go last. Ties are broken by title.
export function sortByReadingDate(books: readonly LibraryBook[]): LibraryBook[] {
  return [...books].sort((a, b) => {
    const keyA = readingDateKey(a)
    const keyB = readingDateKey(b)
    if (keyA !== keyB) {
      if (keyA === null) return 1
      if (keyB === null) return -1
      return keyB.localeCompare(keyA)
    }
    return compareTitles(a, b)
  })
}

export const UNKNOWN_DATE_GROUP = 'Fecha desconocida'

export interface TimelineGroup {
  heading: string
  books: LibraryBook[]
}

// Books grouped by the year of their reading date, newest year first, with
// the undated ones last under «Fecha desconocida».
export function groupByYear(books: readonly LibraryBook[]): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  for (const book of sortByReadingDate(books)) {
    const heading = readingDateKey(book)?.slice(0, 4) ?? UNKNOWN_DATE_GROUP
    const last = groups.at(-1)
    if (last?.heading === heading) last.books.push(book)
    else groups.push({ heading, books: [book] })
  }
  return groups
}
