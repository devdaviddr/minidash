/** Load tiers: normal below WARM, warm from WARM up to HOT, hot above HOT. */
export const WARM = 60
export const HOT = 85

/** How strongly a tier colour shows through the cell. Text stays in the foreground colour on top of it,
 * so this is kept low enough for WCAG AA contrast in both themes and for every tier (checked in contrast.test.ts; 0.55 failed on amber in dark mode). */
export const FILL_OPACITY = 0.45

/** Clamps to 0 to 100; anything that is not a finite number counts as 0. */
export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, v))
}

export type Tier = 'normal' | 'warm' | 'hot'

export function tierOf(pct: number): Tier {
  const v = clampPct(pct)
  if (v > HOT) return 'hot'
  if (v >= WARM) return 'warm'
  return 'normal'
}

export const TIER_COLOR: Record<Tier, string> = {
  normal: 'var(--accent)',
  warm: 'var(--warn)',
  hot: 'var(--bad)',
}

/** Points of a pointy-top hexagon with circumradius r centred on (cx, cy). */
export function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90)
    return `${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`
  }).join(' ')
}

/** Radius of the drawn hexagon, as a share of the cell: a little under 1 leaves a thin gap between cells. */
export const CELL = 0.93
