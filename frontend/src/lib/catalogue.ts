import type { BookInput } from '../api/types'
import { isBookStatus } from './library'
import { avatarProblem } from './profile'

export const CATALOGUE_LIMITS = { title: 200, author: 120, authors: 20, description: 5000, publicationDate: 100, publisher: 200, isbn: 100, query: 200 } as const
export type BookErrors = Partial<Record<keyof BookInput, string>>
export const DATE_FIELDS = ['plannedStartDate', 'plannedEndDate', 'readingStartDate', 'readingEndDate'] as const

// UTC round-trip rejects overflow dates and leap-day errors independently of timezone.
export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function bookErrors(input: BookInput): BookErrors {
  const errors: BookErrors = {}
  if (typeof input.title !== 'string' || !input.title.trim()) errors.title = 'Escribe un título.'
  else if (input.title.trim().length > CATALOGUE_LIMITS.title) errors.title = 'El título puede tener como máximo 200 caracteres.'
  if (!Array.isArray(input.authors) || input.authors.length > CATALOGUE_LIMITS.authors || input.authors.some((a) => typeof a !== 'string' || a.trim().length > CATALOGUE_LIMITS.author)) errors.authors = 'Añade como máximo 20 autores de hasta 120 caracteres, uno por línea.'
  for (const field of ['description', 'publicationDate', 'publisher', 'isbn'] as const) {
    const value = input[field]
    if (value !== null && (typeof value !== 'string' || value.trim().length > CATALOGUE_LIMITS[field])) errors[field] = `Este campo puede tener como máximo ${CATALOGUE_LIMITS[field]} caracteres.`
  }
  if (input.pageCount !== null && (!Number.isSafeInteger(input.pageCount) || input.pageCount <= 0)) errors.pageCount = 'Escribe un número entero positivo de páginas.'
  if (!isBookStatus(input.status)) errors.status = 'Elige un estado válido.'
  for (const field of DATE_FIELDS) {
    const value = input[field]
    if (value !== null && (typeof value !== 'string' || (value.trim() && !validCalendarDate(value.trim())))) errors[field] = 'Escribe una fecha válida (AAAA-MM-DD).'
  }
  for (const [start, end] of [['plannedStartDate', 'plannedEndDate'], ['readingStartDate', 'readingEndDate']] as const) {
    if (!errors[start] && !errors[end] && input[start]?.trim() && input[end]?.trim() && input[end]!.trim() < input[start]!.trim()) errors[end] = 'La fecha final no puede ser anterior a la inicial.'
  }
  if (typeof input.datesApproximate !== 'boolean') errors.datesApproximate = 'Indica si las fechas son aproximadas.'
  const cover = input.cover
  if (!cover || !['keep', 'remove', 'replace', 'metadata'].includes(cover.action)) errors.cover = 'Elige una portada válida.'
  else if (cover.action === 'replace') {
    if (!(cover.file instanceof Blob)) errors.cover = 'Elige un archivo de imagen.'
    else {
      const problem = avatarProblem(cover.file)
      if (problem) errors.cover = problem === 'type' ? 'La portada debe ser JPEG, PNG o WebP.' : problem === 'empty' ? 'Ese archivo está vacío.' : 'La portada puede ocupar como máximo 2 MB.'
    }
  }
  return errors
}

export function blankBookInput(): BookInput {
  return { title: '', authors: [], description: null, publicationDate: null, publisher: null, isbn: null, pageCount: null, status: 'propuesto', plannedStartDate: null, plannedEndDate: null, readingStartDate: null, readingEndDate: null, datesApproximate: false, cover: { action: 'keep' } }
}
