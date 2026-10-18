import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../contract/snapshot'
import { HISTORY_LIMIT, pushHistory, toSeries, clampRange, RANGE_OPTIONS } from './history'

const snap = (seq: number, total = 0): Snapshot => ({
  schema: 1,
  seq,
  ts: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  intervalMs: 1000,
  collectors: { cpu: { ok: true, data: { total, cores: [total], load: { one: 0, five: 0, fifteen: 0 } } } },
})

describe('history', () => {
  it('caps at the limit, dropping the oldest', () => {
    let h: Snapshot[] = []
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = pushHistory(h, snap(i))
    expect(h.length).toBe(HISTORY_LIMIT)
    expect(h[0].seq).toBe(11)
  })
  it('resets when the agent restarts (seq goes backwards)', () => {
    const h = pushHistory(pushHistory([], snap(50)), snap(1))
    expect(h.map((s) => s.seq)).toEqual([1])
  })
  it('builds aligned series', () => {
    const [xs, ys] = toSeries([snap(1, 10), snap(2, 20)], (s) => s.collectors.cpu?.data?.total ?? null)
    expect(xs.length).toBe(2)
    expect(ys).toEqual([10, 20])
  })

  // AC-39 (FR-38): the requested range is clamped to the agent's retention window.
  it('clamps a range larger than the agent window', () => {
    expect(clampRange(2419200, 3600)).toBe(3600)
  })
  it('keeps a range within the agent window', () => {
    expect(clampRange(600, 3600)).toBe(600)
  })
  it('falls back to 5 min for a non-positive range', () => {
    expect(clampRange(0, 3600)).toBe(300)
  })
  it('offers the documented retention windows', () => {
    expect(RANGE_OPTIONS.map((r) => r.seconds)).toEqual([300, 600, 1200, 1800, 3600, 25200, 86400, 604800, 2419200])
  })
})
