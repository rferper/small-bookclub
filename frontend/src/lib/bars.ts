// Geometry of the horizontal bar charts in Estadísticas (#68). Pure: no
// React, DOM or API client. The scale runs from 0 to BAR_MAX, so a bar's
// length is proportional to its unrounded value.

export const BAR_MAX = 5
// The labelled guide marks.
export const BAR_TICKS: readonly number[] = [0, 1, 2, 3, 4, 5]

// A bar's length as a percentage of the track. Means are 1–5; anything
// outside 0–5 (including NaN and Infinity) is a bug upstream and must not
// be drawn.
export function barPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > BAR_MAX) {
    throw new RangeError(`Bar value out of range 0–${BAR_MAX}: ${value}`)
  }
  return (value / BAR_MAX) * 100
}
