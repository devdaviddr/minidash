import { describe, expect, it } from 'vitest'
import { SPANS } from './catalogue'
import { parseTracks, readGridMetrics, spanFromKey, spanFromPointer } from './resize'

const M = { columnWidth: 300, gap: 16 }
/** Right edge of a card of n columns that starts at `left`. */
const edge = (n: number, left = 0) => left + n * M.columnWidth + (n - 1) * M.gap

describe('spanFromPointer', () => {
  it('returns n when the pointer is exactly on the right edge of an n-column card', () => {
    for (const n of SPANS) expect(spanFromPointer(edge(n), 0, M)).toBe(n)
  })
  it('snaps to the nearest column', () => {
    expect(spanFromPointer(edge(2) - 100, 0, M)).toBe(2)
    expect(spanFromPointer(edge(2) + 100, 0, M)).toBe(2)
    expect(spanFromPointer(edge(2) + 200, 0, M)).toBe(3)
    expect(spanFromPointer(edge(3) - 200, 0, M)).toBe(2)
  })
  it('never goes below 1 or above 4', () => {
    for (const x of [-500, 0, 1, 50]) expect(spanFromPointer(x, 0, M)).toBe(1)
    for (const x of [edge(4), edge(4) + 40, 5000]) expect(spanFromPointer(x, 0, M)).toBe(4)
  })
  it('measures from where the card started, so a card in the middle of a row works', () => {
    const left = 2 * (M.columnWidth + M.gap) // third column
    expect(spanFromPointer(edge(1, left), left, M)).toBe(1)
    expect(spanFromPointer(edge(2, left), left, M)).toBe(2)
    expect(spanFromPointer(edge(4, left), left, M)).toBe(4) // wider than the row: it will wrap, still follows the pointer
  })
  it('is monotonic: moving right never makes the card narrower', () => {
    let prev = 0
    for (let x = -100; x <= 1400; x += 7) {
      const s = spanFromPointer(x, 0, M)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
  it('handles a grid with no gap', () => {
    expect(spanFromPointer(600, 0, { columnWidth: 300, gap: 0 })).toBe(2)
  })
})

describe('spanFromKey', () => {
  it('steps one column and stops at the ends', () => {
    expect(spanFromKey('ArrowRight', 2)).toBe(3)
    expect(spanFromKey('ArrowUp', 2)).toBe(3)
    expect(spanFromKey('ArrowLeft', 2)).toBe(1)
    expect(spanFromKey('ArrowDown', 2)).toBe(1)
    expect(spanFromKey('ArrowRight', 4)).toBe(4)
    expect(spanFromKey('ArrowLeft', 1)).toBe(1)
  })
  it('jumps with Home and End and ignores other keys', () => {
    expect(spanFromKey('Home', 3)).toBe(1)
    expect(spanFromKey('End', 2)).toBe(4)
    for (const k of ['Tab', 'Enter', ' ', 'a', 'Escape']) expect(spanFromKey(k, 2)).toBeNull()
  })
})

describe('measuring the grid', () => {
  it('reads resolved pixel tracks', () => expect(parseTracks(' 301.5px 301.5px 301.5px 301.5px ')).toEqual([301.5, 301.5, 301.5, 301.5]))
  it('ignores what it cannot measure', () => {
    expect(parseTracks('')).toEqual([])
    expect(parseTracks('none')).toEqual([])
    expect(parseTracks('repeat(4, minmax(0, 1fr))')).toEqual([])
  })
  it('combines tracks and gap, and gives null when unmeasurable', () => {
    const style = (cols: string, gap: string) => ({ gridTemplateColumns: cols, columnGap: gap }) as CSSStyleDeclaration
    expect(readGridMetrics({} as Element, () => style('300px 300px 300px 300px', '16px'))).toEqual({ columnWidth: 300, gap: 16, columns: 4 })
    expect(readGridMetrics({} as Element, () => style('600px 600px', 'normal'))).toEqual({ columnWidth: 600, gap: 0, columns: 2 })
    expect(readGridMetrics({} as Element, () => style('', '16px'))).toBeNull()
  })
})
