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

/** Retention windows the UI can request, in seconds (FR-38). */
export const RANGE_OPTIONS: Array<{ label: string; seconds: number }> = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '20 min', seconds: 1200 },
  { label: '30 min', seconds: 1800 },
  { label: '1 h', seconds: 3600 },
  { label: '7 h', seconds: 25200 },
  { label: '1 day', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '28 days', seconds: 2419200 },
]

/**
 * Clamp a requested range to the agent's retention window (FR-38). A range larger than the agent
 * keeps is reduced to the agent's maximum; a non-positive range falls back to the live 5-minute view.
 */
export function clampRange(requested: number, agentWindow: number): number {
  if (requested <= 0) return 300
  if (agentWindow <= 0) return requested
  return Math.min(requested, agentWindow)
}

/**
 * Fetch downsampled history from the agent's /history endpoint and return it as Snapshot-shaped
 * points for the charts. The token is passed as a query parameter.
 */
export async function fetchHistory(baseUrl: string, token: string, windowSeconds: number): Promise<Snapshot[]> {
  const url = `${baseUrl}/history?window=${windowSeconds}&token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) return []
  const body = (await res.json()) as { points: Array<{ ts: string; collectors: Snapshot['collectors'] }> }
  return (body.points ?? []).map((p) => ({
    schema: 1,
    seq: 0,
    ts: p.ts,
    intervalMs: 1000,
    collectors: p.collectors,
  }))
}
