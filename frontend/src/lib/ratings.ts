// Rating maths and display helpers (§5.5, §8). Pure functions shared by the
// mock API (which mirrors the backend calculations, #36) and the rating form.

import type { Criterion, CriterionScores } from '../api/types'

// The five mandatory criteria, always in this order.
export const CRITERIA: readonly Criterion[] = ['disfrute', 'estilo', 'personajes', 'trama', 'huella']

export const CRITERION_LABELS: Record<Criterion, string> = {
  disfrute: 'Disfrute',
  estilo: 'Estilo',
  personajes: 'Personajes',
  trama: 'Trama',
  huella: 'Huella',
}

// The nine values a score can take: 1 to 5 in steps of 0.5. There is no 0.
export const SCORE_VALUES: readonly number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

export const REVIEW_TEXT_MAX_LENGTH = 5000

export function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5 && Number.isInteger(value * 2)
}

// Half-star sums are exact in floating point, so dividing once keeps the
// result as close as possible to the true mean.
const sum = (scores: CriterionScores) => CRITERIA.reduce((total, criterion) => total + scores[criterion], 0)

// A review's overall: the unweighted mean of its five scores, not rounded
// to half-stars (5, 4.5, 3, 4, 2.5 give exactly 3.8).
export function reviewOverall(scores: CriterionScores): number {
  return sum(scores) / CRITERIA.length
}

export interface ClubAggregates {
  reviewCount: number
  overallMean: number
  criterionMeans: CriterionScores
}

// The club's figures over every submitted review, or null when there is none
// (an unrated book has no mean, never 0/5). `overallMean` is the mean of the
// reviews' overalls, each member weighted equally; it is computed from the
// sum of all scores, which is the same value with a single division.
export function clubAggregates(reviews: CriterionScores[]): ClubAggregates | null {
  const n = reviews.length
  if (n === 0) return null
  const means = Object.fromEntries(
    CRITERIA.map((criterion) => [criterion, reviews.reduce((total, scores) => total + scores[criterion], 0) / n]),
  ) as CriterionScores
  return {
    reviewCount: n,
    overallMean: reviews.reduce((total, scores) => total + sum(scores), 0) / (CRITERIA.length * n),
    criterionMeans: means,
  }
}

// A mean or overall with exactly one decimal and a decimal comma, rounding
// half up: 3.8 → «3,8», 4 → «4,0», 3.75 → «3,8», 4.25 → «4,3». The tiny
// offset absorbs floating-point error (4.05 is stored as 4.0499…), so the
// display never shows it. The underlying value is never rounded.
export function formatMean(value: number): string {
  const tenths = Math.round(value * 10 + 1e-9)
  return (tenths / 10).toFixed(1).replace('.', ',')
}

// A single score as the control shows it: «4», «4,5».
export function formatScore(value: number): string {
  return String(value).replace('.', ',')
}

// The accessible name of a score: «1 estrella», «1,5 estrellas».
export function formatStars(value: number): string {
  return `${formatScore(value)} ${value === 1 ? 'estrella' : 'estrellas'}`
}

// `n` in text: «1 valoración», «4 valoraciones».
export function formatReviewCount(count: number): string {
  return count === 1 ? '1 valoración' : `${count} valoraciones`
}

// The whole-star anchors around a value: one for a whole value, the one
// below and the one above for a half value (§5.5: half-stars sit between
// anchors).
export function neighbouringAnchors(value: number): (1 | 2 | 3 | 4 | 5)[] {
  const below = Math.floor(value) as 1 | 2 | 3 | 4 | 5
  const above = Math.ceil(value) as 1 | 2 | 3 | 4 | 5
  return below === above ? [below] : [below, above]
}
