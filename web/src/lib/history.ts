import type { Snapshot } from '../contract/snapshot'

/** 5 minutes at 1 Hz. */
export const HISTORY_LIMIT = 300

/** Appends s and keeps the newest HISTORY_LIMIT entries (returns a new array for React). */
export function pushHistory(prev: Snapshot[], s: Snapshot): Snapshot[] {
  const last = prev.at(-1)
  if (last && s.seq <= last.seq) return [s] // agent restarted: seq reset, start over
  const next = prev.length >= HISTORY_LIMIT ? prev.slice(prev.length - HISTORY_LIMIT + 1) : prev.slice()
  next.push(s)
  return next
}

/** Time axis (seconds) and one series per selector, aligned for uPlot. */
export function toSeries(history: Snapshot[], ...selectors: Array<(s: Snapshot) => number | null>): number[][] {
  const xs = history.map((s) => Date.parse(s.ts) / 1000)
  return [xs, ...selectors.map((sel) => history.map(sel) as number[])]
}
