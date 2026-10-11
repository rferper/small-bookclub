import type { LiteraryQuoteInput, RatingRubric, RubricAnchors } from '../api/types'
import { CRITERIA } from './ratings'

export const ANCHORS = [1, 2, 3, 4, 5] as const
export const quoteKey = (text: string) => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es')

// Shared form/mock limits. Null optional text and preserved internal whitespace.
export function normalizeQuote(input: LiteraryQuoteInput): LiteraryQuoteInput | null {
  if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.trim().length > 1000 || typeof input.active !== 'boolean') return null
  for (const value of [input.author, input.source]) {
    if (value !== null && (typeof value !== 'string' || value.trim().length > 200)) return null
  }
  return { text: input.text.trim(), author: input.author?.trim() || null, source: input.source?.trim() || null, active: input.active }
}

export function normalizeRubric(input: RatingRubric): RatingRubric | null {
  if (!input || typeof input !== 'object' || Object.keys(input).length !== 5 || Object.keys(input).some((key) => !CRITERIA.includes(key as typeof CRITERIA[number]))) return null
  const result = {} as RatingRubric
  for (const criterion of CRITERIA) {
    const anchors = input[criterion]
    if (!anchors || typeof anchors !== 'object' || Object.keys(anchors).length !== 5 || Object.keys(anchors).some((key) => !ANCHORS.some((star) => String(star) === key))) return null
    result[criterion] = {} as RubricAnchors
    for (const star of ANCHORS) {
      const value = anchors[star]
      if (value !== null && (typeof value !== 'string' || value.trim().length > 500)) return null
      result[criterion][star] = value?.trim() || null
    }
  }
  return result
}
