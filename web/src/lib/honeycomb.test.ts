import { describe, expect, it } from 'vitest'
import { honeycomb, honeycombRows, SQRT3, TARGET_ASPECT } from './honeycomb'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// AC-26
describe('honeycombRows', () => {
  it('lays out the common Apple Silicon core counts like a reactor', () => {
    expect(honeycombRows(10)).toEqual([3, 4, 3]) // M4 and M4 Pro: a hexagonal cluster
    expect(honeycombRows(8)).toEqual([3, 2, 3])
    expect(honeycombRows(7)).toEqual([2, 3, 2])
    expect(honeycombRows(1)).toEqual([1])
  })

  it('always uses exactly n cells, for every count from 1 to 128', () => {
    for (let n = 1; n <= 128; n++) expect(sum(honeycombRows(n)), `n=${n}`).toBe(n)
  })

  it('rows differ by at most one cell, or are all equal (and then get staggered)', () => {
    for (let n = 1; n <= 128; n++) {
      const { rows, missing } = honeycomb(n)
      if (missing > 0) continue // a short last row is how an inexact count stays round
      const equal = rows.every((r) => r === rows[0])
      for (let i = 1; i < rows.length; i++) expect(equal || Math.abs(rows[i] - rows[i - 1]) <= 1, `n=${n} ${rows}`).toBe(true)
    }
  })

  it('leaves at most a few slots empty, always at the end of the last row, and never a whole row', () => {
    for (let n = 1; n <= 128; n++) {
      const { rows, missing } = honeycomb(n)
      expect(missing, `n=${n}`).toBeLessThanOrEqual(3)
      expect(rows[rows.length - 1], `n=${n}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('prefers an exact hexagon to a cluster with holes (7, 10, 19 and 37 cores)', () => {
    for (const n of [7, 10, 19, 37]) expect(honeycomb(n).missing, `n=${n}`).toBe(0)
    expect(honeycombRows(19)).toEqual([3, 4, 5, 4, 3])
    expect(honeycombRows(37)).toEqual([4, 5, 6, 7, 6, 5, 4])
  })

  it('keeps the cluster reasonably round', () => {
    for (let n = 3; n <= 128; n++) {
      const { width, height } = honeycomb(n)
      const aspect = width / height
      expect(aspect, `n=${n}`).toBeGreaterThan(0.55)
      expect(aspect, `n=${n}`).toBeLessThan(2.3)
    }
  })

  it('stays close to the target aspect for the counts real Macs have', () => {
    for (const n of [8, 10, 12, 14, 16, 20, 24, 32]) {
      const { width, height } = honeycomb(n)
      expect(Math.abs(Math.log(width / height / TARGET_ASPECT)), `n=${n}`).toBeLessThan(0.5)
    }
  })

  it('refuses nonsense', () => {
    for (const bad of [0, -3, 2.5, NaN]) expect(honeycombRows(bad)).toEqual([])
    expect(honeycomb(0).cells).toEqual([])
  })
})

describe('honeycomb geometry', () => {
  it('numbers the cells 0..n-1 in reading order', () => {
    const { cells } = honeycomb(10)
    expect(cells.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (let i = 1; i < cells.length; i++) expect(cells[i].cy >= cells[i - 1].cy - 1e-9).toBe(true)
  })

  it('keeps every cell inside the drawing', () => {
    for (let n = 1; n <= 128; n++) {
      const { cells, width, height } = honeycomb(n)
      for (const c of cells) {
        expect(c.cx - SQRT3 / 2, `n=${n} left`).toBeGreaterThanOrEqual(-1e-9)
        expect(c.cx + SQRT3 / 2, `n=${n} right`).toBeLessThanOrEqual(width + 1e-9)
        expect(c.cy - 1, `n=${n} top`).toBeGreaterThanOrEqual(-1e-9)
        expect(c.cy + 1, `n=${n} bottom`).toBeLessThanOrEqual(height + 1e-9)
      }
    }
  })

  // Hexagons are SQRT3 apart between centres when they touch: any closer would overlap.
  it('never overlaps two cells, and interlocks neighbours exactly', () => {
    for (const n of [1, 2, 3, 7, 8, 10, 12, 14, 16, 20, 33, 64, 127]) {
      const { cells } = honeycomb(n)
      let touching = 0
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const d = Math.hypot(cells[i].cx - cells[j].cx, cells[i].cy - cells[j].cy)
          expect(d, `n=${n} cells ${i},${j}`).toBeGreaterThanOrEqual(SQRT3 - 1e-9)
          if (Math.abs(d - SQRT3) < 1e-9) touching++
        }
      }
      if (n >= 7) expect(touching, `n=${n} should have touching neighbours`).toBeGreaterThan(n - 1) // a true honeycomb, not loose cells
    }
  })

  it('has the shape of a hexagon for 10 cores (3-4-3)', () => {
    const { cells, width, height } = honeycomb(10)
    expect(height).toBeCloseTo(5)
    expect(width).toBeCloseTo(4 * SQRT3)
    // the middle row's cells sit between the cells of the rows above and below
    const top = cells.slice(0, 3).map((c) => c.cx)
    const mid = cells.slice(3, 7).map((c) => c.cx)
    expect(mid[1]).toBeCloseTo((top[0] + (top[0] + SQRT3)) / 2 + 0, 5)
  })

  it('staggers equal rows so they interlock', () => {
    const { rows, cells } = honeycomb(9)
    expect(rows).toEqual([3, 3, 3])
    expect(cells[3].cx - cells[0].cx).toBeCloseTo(SQRT3 / 2) // second row shifted half a cell
    expect(cells[6].cx - cells[0].cx).toBeCloseTo(0)
  })
})
