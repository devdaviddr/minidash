import { describe, expect, it } from 'vitest'
import { clampPct, hexPoints, HOT, tierOf, WARM } from './reactor'

describe('clampPct', () => {
  it('keeps 0 to 100 and clamps the rest', () => {
    expect(clampPct(42)).toBe(42)
    expect(clampPct(0)).toBe(0)
    expect(clampPct(100)).toBe(100)
    expect(clampPct(150)).toBe(100)
    expect(clampPct(-5)).toBe(0)
  })
  it('counts anything that is not a finite number as 0', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined as unknown as number]) expect(clampPct(bad)).toBe(0)
  })
})

// AC-25: the tier switches at exactly 60 and 85
describe('tierOf', () => {
  it('is normal below 60, warm from 60 to 85 inclusive, hot above 85', () => {
    expect(WARM).toBe(60)
    expect(HOT).toBe(85)
    expect(tierOf(0)).toBe('normal')
    expect(tierOf(59.99)).toBe('normal')
    expect(tierOf(60)).toBe('warm')
    expect(tierOf(85)).toBe('warm')
    expect(tierOf(85.01)).toBe('hot')
    expect(tierOf(100)).toBe('hot')
  })
  it('clamps first', () => {
    expect(tierOf(500)).toBe('hot')
    expect(tierOf(-3)).toBe('normal')
    expect(tierOf(NaN)).toBe('normal')
  })
})

describe('hexPoints', () => {
  const pts = (cx: number, cy: number, r: number) => hexPoints(cx, cy, r).split(' ').map((p) => p.split(',').map(Number))
  it('has six vertices, all on the circle of radius r', () => {
    const p = pts(3, 4, 2)
    expect(p).toHaveLength(6)
    for (const [x, y] of p) expect(Math.hypot(x - 3, y - 4)).toBeCloseTo(2, 2)
  })
  it('is pointy-top: a vertex straight above the centre, flat sides left and right', () => {
    const p = pts(0, 0, 1)
    expect(p[0][0]).toBeCloseTo(0, 2)
    expect(p[0][1]).toBeCloseTo(-1, 2)
    const xs = p.map(([x]) => x)
    expect(Math.max(...xs)).toBeCloseTo(Math.sqrt(3) / 2, 2)
  })
})
