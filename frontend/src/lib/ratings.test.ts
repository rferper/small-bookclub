import { describe, expect, it } from 'vitest'
import type { CriterionScores } from '../api/types'
import {
  clubAggregates,
  formatMean,
  formatReviewCount,
  formatScore,
  formatStars,
  isValidScore,
  neighbouringAnchors,
  reviewOverall,
  SCORE_VALUES,
} from './ratings'

const scores = (disfrute: number, estilo: number, personajes: number, trama: number, huella: number): CriterionScores => ({
  disfrute,
  estilo,
  personajes,
  trama,
  huella,
})

describe('rating maths', () => {
  it('gives an overall of exactly 3.8 for 5, 4.5, 3, 4 and 2.5', () => {
    expect(reviewOverall(scores(5, 4.5, 3, 4, 2.5))).toBe(3.8)
  })

  it('does not round the overall to half-stars', () => {
    expect(reviewOverall(scores(4, 4, 4, 4, 4.5))).toBe(4.1)
    expect(reviewOverall(scores(1, 1, 1, 1, 1))).toBe(1)
    expect(reviewOverall(scores(5, 5, 5, 5, 5))).toBe(5)
  })

  it('gives a club mean of 3.75 for overalls of 3.8 and 3.7, each member weighted equally', () => {
    const club = clubAggregates([scores(5, 4.5, 3, 4, 2.5), scores(4, 4, 4, 3.5, 3)])!
    expect(reviewOverall(scores(4, 4, 4, 3.5, 3))).toBe(3.7)
    expect(club.overallMean).toBe(3.75)
    expect(club.reviewCount).toBe(2)
  })

  it('weights every member equally, not every score', () => {
    // Three members: overalls 5, 1 and 3 give 3, whatever the spread of each.
    const club = clubAggregates([scores(5, 5, 5, 5, 5), scores(1, 1, 1, 1, 1), scores(1, 5, 3, 1, 5)])!
    expect(club.overallMean).toBe(3)
    expect(club.reviewCount).toBe(3)
  })

  it('means each criterion over the same reviews', () => {
    const club = clubAggregates([
      scores(5, 4.5, 3, 4, 2.5),
      scores(4, 5, 4.5, 3.5, 5),
      scores(3, 3.5, 5, 4, 4.5),
      scores(4, 4, 4, 4.5, 3.5),
    ])!
    expect(club.criterionMeans).toEqual({ disfrute: 4, estilo: 4.25, personajes: 4.125, trama: 4, huella: 3.875 })
    expect(club.overallMean).toBe(4.05)
    expect(club.reviewCount).toBe(4)
  })

  it('has no figures for a book nobody has rated, never 0', () => {
    expect(clubAggregates([])).toBeNull()
  })

  it('accepts only 1 to 5 in steps of 0.5', () => {
    expect(SCORE_VALUES).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])
    for (const value of SCORE_VALUES) expect(isValidScore(value)).toBe(true)
    for (const value of [0, 0.5, 5.5, 3.3, Number.NaN, Infinity, -1, '3', null, undefined]) {
      expect(isValidScore(value)).toBe(false)
    }
  })
})

describe('rating display', () => {
  it('shows means with one decimal and a decimal comma, rounding half up', () => {
    expect(formatMean(3.8)).toBe('3,8')
    expect(formatMean(4)).toBe('4,0')
    expect(formatMean(3.75)).toBe('3,8')
    expect(formatMean(4.25)).toBe('4,3')
    expect(formatMean(4.125)).toBe('4,1')
    expect(formatMean(3.875)).toBe('3,9')
    expect(formatMean(59 / 15)).toBe('3,9')
    expect(formatMean(1)).toBe('1,0')
    expect(formatMean(5)).toBe('5,0')
  })

  it('never shows floating-point error', () => {
    // 4.05 is stored as 4.0499…, and 0.1 + 0.2 as 0.3000…4.
    expect(formatMean(81 / 20)).toBe('4,1')
    expect(formatMean(3.7999999999999998)).toBe('3,8')
    expect(formatMean(0.1 + 0.2 + 3)).toBe('3,3')
    expect(formatMean(3.85)).toBe('3,9')
  })

  it('shows single scores as the control does', () => {
    expect(formatScore(4)).toBe('4')
    expect(formatScore(4.5)).toBe('4,5')
    expect(formatStars(1)).toBe('1 estrella')
    expect(formatStars(1.5)).toBe('1,5 estrellas')
    expect(formatStars(5)).toBe('5 estrellas')
  })

  it('states the number of reviews', () => {
    expect(formatReviewCount(1)).toBe('1 valoración')
    expect(formatReviewCount(4)).toBe('4 valoraciones')
  })

  it('finds the whole-star anchors around a value', () => {
    expect(neighbouringAnchors(3)).toEqual([3])
    expect(neighbouringAnchors(3.5)).toEqual([3, 4])
    expect(neighbouringAnchors(1)).toEqual([1])
    expect(neighbouringAnchors(4.5)).toEqual([4, 5])
  })
})
