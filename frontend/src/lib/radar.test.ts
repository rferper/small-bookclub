import { describe, expect, it } from 'vitest'
import { axisAngle, pointOnAxis, radarPoints, radarVertices, ringPoints, type Point } from './radar'

// Exact trigonometry of the regular pentagon, independent of Math.sin/cos.
const SQRT5 = Math.sqrt(5)
const SIN72 = Math.sqrt(10 + 2 * SQRT5) / 4
const COS72 = (SQRT5 - 1) / 4
const SIN144 = Math.sqrt(10 - 2 * SQRT5) / 4
const COS144 = -(SQRT5 + 1) / 4
// Unit direction of each axis in SVG coordinates (y grows downwards):
// Disfrute up, then 72° clockwise each.
const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: SIN72, y: -COS72 },
  { x: SIN144, y: -COS144 },
  { x: -SIN144, y: -COS144 },
  { x: -SIN72, y: -COS72 },
]

const CENTER = { x: 150, y: 120 }
const RADIUS = 100

// Where `value` on axis `index` must be: proportional to the value, 0 at the centre.
const expected = (value: number, index: number): Point => ({
  x: CENTER.x + (RADIUS * value * DIRECTIONS[index].x) / 5,
  y: CENTER.y + (RADIUS * value * DIRECTIONS[index].y) / 5,
})

function expectVertices(values: number[]) {
  const vertices = radarVertices(CENTER, RADIUS, values)
  expect(vertices).toHaveLength(5)
  vertices.forEach((vertex, index) => {
    const want = expected(values[index], index)
    expect(Math.abs(vertex.x - want.x)).toBeLessThan(1e-9)
    expect(Math.abs(vertex.y - want.y)).toBeLessThan(1e-9)
  })
}

describe('radar geometry', () => {
  it('puts Disfrute at 5 directly above the centre at full radius', () => {
    const [disfrute] = radarVertices(CENTER, RADIUS, [5, 5, 5, 5, 5])
    expect(disfrute.x).toBeCloseTo(150, 12)
    expect(disfrute.y).toBeCloseTo(20, 12)
  })

  it('rotates each axis 72° clockwise from the previous one', () => {
    for (let index = 0; index < 5; index++) {
      expect(axisAngle(index)).toBeCloseTo((index * 72 * Math.PI) / 180, 12)
    }
    // Clockwise on screen: the second axis is to the right of the top one.
    expect(pointOnAxis(CENTER, 10, 1).x).toBeGreaterThan(CENTER.x)
    expect(pointOnAxis(CENTER, 10, 4).x).toBeLessThan(CENTER.x)
  })

  it.each([1, 3, 5])('places %s on every axis at value / 5 of the radius', (value) => {
    expectVertices([value, value, value, value, value])
  })

  it('places a 1 at one fifth of the radius, not at the centre', () => {
    const vertices = radarVertices(CENTER, RADIUS, [1, 1, 1, 1, 1])
    for (const vertex of vertices) {
      expect(Math.hypot(vertex.x - CENTER.x, vertex.y - CENTER.y)).toBeCloseTo(20, 9)
    }
  })

  it('places half values exactly', () => {
    expectVertices([2.5, 4.5, 2.5, 4.5, 1.5])
  })

  it('places a mean that is not a half step exactly (4.125, not its display 4,1)', () => {
    expectVertices([4, 4.25, 4.125, 4, 3.875])
    const personajes = radarVertices(CENTER, RADIUS, [4, 4.25, 4.125, 4, 3.875])[2]
    expect(Math.hypot(personajes.x - CENTER.x, personajes.y - CENTER.y)).toBeCloseTo(82.5, 9)
  })

  it('writes the points string from the vertices, rounded to 3 decimals', () => {
    expect(radarPoints({ x: 0, y: 0 }, 50, [5, 5, 5, 5, 5])).toBe(
      '0,-50 47.553,-15.451 29.389,40.451 -29.389,40.451 -47.553,-15.451',
    )
    expect(radarPoints(CENTER, RADIUS, [1, 2, 3, 4, 5])).toBe(
      [0, 1, 2, 3, 4]
        .map((index) => expected(index + 1, index))
        .map(({ x, y }) => `${Number(x.toFixed(3))},${Number(y.toFixed(3))}`)
        .join(' '),
    )
  })

  it('draws each guide ring as the pentagon of that value', () => {
    expect(ringPoints(CENTER, RADIUS, 2)).toBe(radarPoints(CENTER, RADIUS, [2, 2, 2, 2, 2]))
    expect(ringPoints({ x: 0, y: 0 }, 50, 5)).toBe('0,-50 47.553,-15.451 29.389,40.451 -29.389,40.451 -47.553,-15.451')
  })

  it.each([0, 0.5, 5.5, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'throws instead of drawing %s',
    (bad) => {
      expect(() => radarVertices(CENTER, RADIUS, [4, 4, bad, 4, 4])).toThrow(RangeError)
      expect(() => radarPoints(CENTER, RADIUS, [bad, 4, 4, 4, 4])).toThrow(RangeError)
    },
  )

  it('throws unless it gets exactly five values', () => {
    expect(() => radarVertices(CENTER, RADIUS, [4, 4, 4, 4])).toThrow(RangeError)
    expect(() => radarVertices(CENTER, RADIUS, [4, 4, 4, 4, 4, 4])).toThrow(RangeError)
  })
})
