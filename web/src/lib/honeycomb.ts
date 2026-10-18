/**
 * Honeycomb layout for pointy-top hexagons. Everything is in "hex units": a hexagon has circumradius 1, so it is
 * SQRT3 wide and 2 tall, neighbouring columns are SQRT3 apart and rows are 1.5 apart.
 */
export const SQRT3 = Math.sqrt(3)

/** A round cluster reads best as a reactor core: a little wider than tall. */
export const TARGET_ASPECT = 1.2

export interface Cell {
  /** 0-based position in the input, i.e. the core number. */
  index: number
  /** Centre, in hex units from the top-left of the drawing. */
  cx: number
  cy: number
}

export interface Honeycomb {
  /** Cells per row as drawn (the last row is short when slots are left empty). */
  rows: number[]
  /** Empty slots at the end of the last row, so a pattern that is not an exact fit can still be round. */
  missing: number
  /** Whole drawing, in hex units. */
  width: number
  height: number
  cells: Cell[]
}

/** Equal rows are staggered by half a cell so they interlock; rows that differ by one interlock by centring. */
const isStaggered = (rows: number[]) => rows.length > 1 && rows.every((r) => r === rows[0])

function size(rows: number[]): { width: number; height: number } {
  const widest = Math.max(...rows)
  return { width: (widest + (isStaggered(rows) ? 0.5 : 0)) * SQRT3, height: 2 + 1.5 * (rows.length - 1) }
}

/**
 * Rows that grow by one cell to a peak and then shrink by one: the classic hexagonal cluster ([3,4,5,4,3]).
 * Totals are computed with arithmetic, and only matching patterns are built, so this is cheap even for 128 cells.
 * The peak is capped: a cluster much taller than it is wide is never round, and the flat shapes are covered elsewhere.
 */
function hexagonal(n: number): number[][] {
  const out: number[][] = []
  const maxPeak = Math.min(n, Math.ceil(2 * Math.sqrt(n)) + 2)
  for (let peak = 1; peak <= maxPeak; peak++) {
    for (let start = 1; start <= peak; start++) {
      const rising = (peak * (peak + 1) - (start - 1) * start) / 2 // start + ... + peak
      for (let end = 1; end <= peak; end++) {
        const falling = ((peak - 1) * peak - (end - 1) * end) / 2 // (peak - 1) + ... + end
        if (rising + falling !== n) continue
        const rows: number[] = []
        for (let k = start; k <= peak; k++) rows.push(k)
        for (let k = peak - 1; k >= end; k--) rows.push(k)
        out.push(rows)
      }
    }
  }
  return out
}

const symmetric = (rows: number[]) => rows.every((r, i) => r === rows[rows.length - 1 - i])

/** Every way to lay n cells in rows that interlock: equal staggered rows, rows alternating a and a+1, or hexagonal. */
function candidates(n: number): number[][] {
  const out: number[][] = hexagonal(n)
  for (let r = 1; r <= n; r++) {
    if (n % r === 0) out.push(Array<number>(r).fill(n / r))
    if (r < 2) continue
    for (const startBig of [false, true]) {
      const bigRows = startBig ? Math.ceil(r / 2) : Math.floor(r / 2)
      const a = (n - bigRows) / r // r rows of a, plus one extra in each of the `bigRows` big rows
      if (!Number.isInteger(a) || a < 1) continue
      out.push(Array.from({ length: r }, (_, i) => (i % 2 === (startBig ? 0 : 1) ? a + 1 : a)))
    }
  }
  return out
}

/** The most cells we are willing to leave empty to get a rounder cluster. */
const MAX_MISSING = 3
/** Cost of each empty slot, on the same scale as the aspect score. */
const MISSING_PENALTY = 0.12

interface Choice {
  /** Row lengths of the full pattern (>= n slots). */
  full: number[]
  missing: number
}

/** The interlocking pattern, possibly with a few empty slots, whose shape is closest to round. */
function choose(n: number, targetAspect: number): Choice | null {
  if (!Number.isInteger(n) || n < 1) return null
  let best: Choice = { full: [n], missing: 0 }
  let bestScore = Infinity
  for (let missing = 0; missing <= MAX_MISSING; missing++) {
    for (const rows of candidates(n + missing)) {
      if (rows[rows.length - 1] <= missing) continue // never empty a whole row
      const { width, height } = size(rows)
      // Distance from the target aspect on a log scale (so 2x too wide and 2x too tall count the same), a small
      // preference for symmetric arrangements that look like a core, a larger penalty for lopsided ones (a triangle
      // is not a reactor), and a cost per empty slot.
      const score =
        Math.abs(Math.log(width / height / targetAspect)) + (isStaggered(rows) ? 0.02 : 0) + (symmetric(rows) ? 0 : 0.25) + missing * MISSING_PENALTY
      if (score < bestScore - 1e-9) {
        best = { full: rows, missing }
        bestScore = score
      }
    }
  }
  return best
}

/** Cells per row, as drawn, for n cells. */
export function honeycombRows(n: number, targetAspect = TARGET_ASPECT): number[] {
  const c = choose(n, targetAspect)
  if (!c) return []
  const rows = [...c.full]
  rows[rows.length - 1] -= c.missing
  return rows
}

/** Cell centres for n cells, row by row, left to right. */
export function honeycomb(n: number, targetAspect = TARGET_ASPECT): Honeycomb {
  const c = choose(n, targetAspect)
  if (!c) return { rows: [], missing: 0, width: 0, height: 0, cells: [] }
  const { width, height } = size(c.full)
  const widest = Math.max(...c.full)
  const staggered = isStaggered(c.full)
  const cells: Cell[] = []
  c.full.forEach((len, r) => {
    const shift = staggered && r % 2 === 1 ? SQRT3 / 2 : 0
    const left = ((widest - len) * SQRT3) / 2 + shift
    for (let k = 0; k < len; k++) cells.push({ index: cells.length, cx: left + (k + 0.5) * SQRT3, cy: 1 + 1.5 * r })
  })
  const kept = cells.slice(0, n) // the empty slots are the last ones, so every position stays interlocked
  const rows = [...c.full]
  rows[rows.length - 1] -= c.missing
  return { rows, missing: c.missing, width, height, cells: kept }
}
