import { describe, expect, it } from 'vitest'
import { descNullsLast } from './sort'

// AC-32: highest first, unknown values last.
describe('descNullsLast', () => {
  it('sorts numbers highest first and null and undefined last', () => {
    const v = [null, 3, 0, 50.5, null, 7]
    expect([...v].sort(descNullsLast)).toEqual([50.5, 7, 3, 0, null, null])
    const rows = [{ g: undefined }, { g: 2 }, { g: null }, { g: 9 }]
    expect(rows.sort((a, b) => descNullsLast(a.g, b.g)).map((r) => r.g)).toEqual([9, 2, undefined, null])
  })
  it('treats two unknown values as equal', () => {
    expect(descNullsLast(null, undefined)).toBe(0)
    expect(descNullsLast(undefined, undefined)).toBe(0)
  })
  it('keeps 0 as a known value ahead of null', () => {
    expect(descNullsLast(0, null)).toBeLessThan(0)
    expect(descNullsLast(null, 0)).toBeGreaterThan(0)
  })
})
