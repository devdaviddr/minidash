import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Fixed Tailwind palette colours ignore the theme: pale text that works on dark is unreadable on light.
// Components must use theme tokens (bg-surface, text-fg, text-ok, bg-accent, ...).
const FIXED = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-[0-9]+)?\b/

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

describe('theming discipline (AC-10)', () => {
  const files = sources(join(import.meta.dirname, '..'))
  it('the scanner catches fixed colours and allows theme tokens', () => {
    for (const bad of ['text-emerald-300', 'bg-white', 'border-gray-200', 'bg-red-500/15', 'text-black'])
      expect(FIXED.test(`className="${bad}"`), bad).toBe(true)
    for (const ok of ['bg-surface', 'text-fg', 'text-on-accent', 'bg-bad/10', 'border-line', 'text-muted', 'ring-accent/50'])
      expect(FIXED.test(`className="${ok}"`), ok).toBe(false)
  })
  it('scans real files', () => expect(files.length).toBeGreaterThan(10))
  it('no component uses a fixed palette colour', () => {
    const offenders = files.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((l, i) => ({ f, i: i + 1, l }))
        .filter(({ l }) => FIXED.test(l))
        .map(({ f, i, l }) => `${f.split('/src/')[1]}:${i}: ${l.trim()}`),
    )
    expect(offenders).toEqual([])
  })
})
