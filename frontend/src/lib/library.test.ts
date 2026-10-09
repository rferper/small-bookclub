import { describe, expect, it } from 'vitest'
import type { LibraryBook } from '../api/types'
import { groupByYear, readingDateKey, sortByReadingDate, sortByTitle } from './library'

function book(id: string, title: string, start: string | null = null, end: string | null = null): LibraryBook {
  return {
    id,
    title,
    authors: ['Autora Inventada'],
    coverUrl: null,
    status: 'terminado',
    readingStartDate: start,
    readingEndDate: end,
    datesApproximate: false,
  }
}

const titles = (books: LibraryBook[]) => books.map((b) => b.title)

describe('library ordering', () => {
  it('keys a book by its start date, or its end date when the start is unknown', () => {
    expect(readingDateKey(book('1', 'A', '2025-03-01', '2025-04-01'))).toBe('2025-03-01')
    expect(readingDateKey(book('1', 'A', null, '2025-04-01'))).toBe('2025-04-01')
    expect(readingDateKey(book('1', 'A'))).toBeNull()
  })

  it('sorts titles with Spanish collation', () => {
    const books = [book('1', 'Zarza'), book('2', 'Ébano'), book('3', 'Árbol'), book('4', 'Bosque'), book('5', 'ñu')]
    expect(titles(sortByTitle(books))).toEqual(['Árbol', 'Bosque', 'Ébano', 'ñu', 'Zarza'])
  })

  it('sorts by reading date newest first, with undated books last', () => {
    const books = [
      book('1', 'Sin fecha'),
      book('2', 'Antiguo', '2020-01-10'),
      book('3', 'Solo final', null, '2024-05-01'),
      book('4', 'Reciente', '2025-02-01'),
    ]
    expect(titles(sortByReadingDate(books))).toEqual(['Reciente', 'Solo final', 'Antiguo', 'Sin fecha'])
  })

  it('groups the timeline by year, newest first, with «Fecha desconocida» last', () => {
    const groups = groupByYear([
      book('1', 'Sin fecha'),
      book('2', 'Enero', '2024-01-05'),
      book('3', 'Diciembre', null, '2024-12-20'),
      book('4', 'Otro año', '2025-06-01'),
      book('5', 'También sin fecha'),
    ])
    expect(groups.map((g) => [g.heading, titles(g.books)])).toEqual([
      ['2025', ['Otro año']],
      ['2024', ['Diciembre', 'Enero']],
      ['Fecha desconocida', ['Sin fecha', 'También sin fecha']],
    ])
  })
})
