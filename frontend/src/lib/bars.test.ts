import { describe, expect, it } from 'vitest'
import { BAR_TICKS, barPercent } from './bars'

describe('barPercent', () => {
  it('is proportional to the unrounded value on a 0–5 scale', () => {
    expect(barPercent(0)).toBe(0)
    expect(barPercent(5)).toBe(100)
    expect(barPercent(2.5)).toBe(50)
    expect(barPercent(4.05)).toBeCloseTo(81, 9)
    expect(barPercent(11.8 / 3)).toBeCloseTo(78.666666666, 6)
  })

  it.each([-0.1, 5.01, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s', (value) => {
    expect(() => barPercent(value)).toThrow(RangeError)
  })

  it('has a guide mark for each whole value from 0 to 5', () => {
    expect(BAR_TICKS).toEqual([0, 1, 2, 3, 4, 5])
  })
})
