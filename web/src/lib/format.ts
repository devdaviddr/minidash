const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** 1536 -> "1.5 KB". Uses 1024 steps, matching Activity Monitor and Finder. */
export function bytes(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)
  const v = n / 1024 ** i
  return `${i === 0 ? v.toFixed(0) : v.toFixed(v >= 100 ? 0 : digits)} ${UNITS[i]}`
}

/** Bytes per second as "12.3 MB/s". */
export const rate = (n: number): string => `${bytes(n)}/s`

export const pct = (v: number): string => `${Math.round(v)}%`
