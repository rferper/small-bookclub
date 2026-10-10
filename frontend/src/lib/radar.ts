// Geometry of the five-axis radar chart (#92). Pure: no React, DOM or API
// client. Axis i points `i × 72°` clockwise from straight up, so with the
// values in `CRITERIA` order Disfrute is at the top. The scale runs from 0 at
// the centre to `RADAR_MAX` at `radius`, so a value's distance from the
// centre is proportional to the value (a 1 sits at one fifth of the radius).

export const RADAR_AXES = 5
export const RADAR_MAX = 5
// The guide rings, one pentagon per whole score.
export const RADAR_RINGS: readonly number[] = [1, 2, 3, 4, 5]

export interface Point {
  x: number
  y: number
}

// The chart's drawing box in SVG units. It is 300 wide, so at the narrowest
// layout (about 286 CSS px on a 360 px phone) a 14-unit label is still over
// 13 CSS px, and the longest labels («Personajes», «Estilo», «Huella») fit
// inside the box at this radius.
export const RADAR_CHART = {
  width: 300,
  height: 226,
  center: { x: 150, y: 118 } as Point,
  radius: 90,
} as const

// Angle of axis `index` in radians, clockwise from straight up.
export function axisAngle(index: number): number {
  return (index * 2 * Math.PI) / RADAR_AXES
}

// The point at `distance` from `center` along axis `index` (SVG y grows
// downwards). Used for the axes, rings and labels too, so everything shares
// the same angles.
export function pointOnAxis(center: Point, distance: number, index: number): Point {
  const angle = axisAngle(index)
  return { x: center.x + distance * Math.sin(angle), y: center.y - distance * Math.cos(angle) }
}

// A score or mean from 1 to 5; anything else (including NaN and Infinity)
// is a bug upstream and must not be drawn.
function checkValue(value: number): number {
  if (!Number.isFinite(value) || value < 1 || value > RADAR_MAX) {
    throw new RangeError(`Radar value out of range 1–${RADAR_MAX}: ${value}`)
  }
  return value
}

// The five vertices for `values` (in `CRITERIA` order), unrounded.
export function radarVertices(center: Point, radius: number, values: readonly number[]): Point[] {
  if (values.length !== RADAR_AXES) throw new RangeError(`A radar needs ${RADAR_AXES} values, got ${values.length}`)
  return values.map((value, index) => pointOnAxis(center, (radius * checkValue(value)) / RADAR_MAX, index))
}

// Coordinates in an SVG `points` string are rounded to 3 decimals (far below
// a pixel); the vertices themselves are not rounded.
const coordinate = (value: number) => String(Number(value.toFixed(3)))

export function toPoints(vertices: readonly Point[]): string {
  return vertices.map(({ x, y }) => `${coordinate(x)},${coordinate(y)}`).join(' ')
}

// The polygon `points` string for `values` (in `CRITERIA` order).
export function radarPoints(center: Point, radius: number, values: readonly number[]): string {
  return toPoints(radarVertices(center, radius, values))
}

// The guide ring for a whole score: a pentagon with that value on every axis.
export function ringPoints(center: Point, radius: number, level: number): string {
  return radarPoints(center, radius, Array.from({ length: RADAR_AXES }, () => level))
}
