import type { ReadingWeekInput } from '../api/types'

export function readingErrors(input: ReadingWeekInput): string[] {
  const errors: string[] = []
  if (![input.percentStart, input.percentEnd].every((n) => Number.isFinite(n) && n >= 0)) errors.push('Introduce porcentajes válidos, iguales o mayores que cero.')
  if (![input.pageStart, input.pageEnd].every((n) => Number.isSafeInteger(n) && n >= 1)) errors.push('Introduce páginas enteras, iguales o mayores que uno.')
  if (input.dueDate !== null) {
    if (typeof input.dueDate !== 'string') errors.push('Introduce una fecha de entrega válida (AAAA-MM-DD).')
    else {
    const date = new Date(`${input.dueDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || input.dueDate.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.dueDate) errors.push('Introduce una fecha de entrega válida (AAAA-MM-DD).')
    }
  }
  if (input.notes !== null && (typeof input.notes !== 'string' || input.notes.trim().length > 1000)) errors.push('La nota puede tener como máximo 1000 caracteres.')
  return errors
}

// Diagnostics only: never calculate replacements for either independent fact.
export function readingWarnings(weeks: ReadingWeekInput[], pageCount: number | null): string[] {
  const warnings: string[] = []
  weeks.forEach((w, i) => {
    const prefix = `Semana ${i + 1}: `
    if (w.percentStart > w.percentEnd) warnings.push(prefix + 'los porcentajes están invertidos.')
    if (w.pageStart > w.pageEnd) warnings.push(prefix + 'las páginas están invertidas.')
    if (w.percentStart > 100 || w.percentEnd > 100) warnings.push(prefix + 'hay porcentajes superiores a 100.')
    if (pageCount !== null && pageCount > 0) {
      if (w.pageStart > pageCount || w.pageEnd > pageCount) warnings.push(prefix + 'hay páginas superiores al total del libro.')
      if (Math.abs(w.percentStart - 100 * w.pageStart / pageCount) > 10 || Math.abs(w.percentEnd - 100 * w.pageEnd / pageCount) > 10) warnings.push(prefix + 'las páginas y los porcentajes difieren en más de 10 puntos porcentuales.')
    }
    const previous = weeks[i - 1]
    if (!previous) return
    if (w.percentStart < previous.percentStart || w.pageStart < previous.pageStart) warnings.push(prefix + 'el inicio retrocede respecto a la semana anterior.')
    if (Math.max(Math.min(w.percentStart, w.percentEnd), Math.min(previous.percentStart, previous.percentEnd)) < Math.min(Math.max(w.percentStart, w.percentEnd), Math.max(previous.percentStart, previous.percentEnd))) warnings.push(prefix + 'los porcentajes se solapan con la semana anterior.')
    if (Math.max(Math.min(w.pageStart, w.pageEnd), Math.min(previous.pageStart, previous.pageEnd)) <= Math.min(Math.max(w.pageStart, w.pageEnd), Math.max(previous.pageStart, previous.pageEnd))) warnings.push(prefix + 'las páginas se solapan con la semana anterior.')
  })
  return warnings
}
