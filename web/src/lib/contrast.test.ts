import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FILL_OPACITY } from './reactor'

// AC-10: parse the real CSS so the test checks what ships, not a copy of the tokens.
const css = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  expect(start, `block ${selector} not found`).toBeGreaterThan(-1)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

const THEMES = {
  light: block(':root {'),
  dark: block(':root[data-theme="dark"]'),
  systemDark: block(':root:not([data-theme])'),
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text colours used on cards (surface) and on the page (bg), plus white text on accent buttons.
const TEXT_ON_SURFACE = ['fg', 'muted', 'accent', 'accent2', 'ok', 'warn', 'bad']

describe('contrast (WCAG AA, 4.5:1)', () => {
  it('knows the maths', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })
  for (const theme of ['light', 'dark'] as const) {
    const t = THEMES[theme]
    for (const name of TEXT_ON_SURFACE) {
      it(`${theme}: ${name} on surface`, () => expect(contrast(t[name], t.surface)).toBeGreaterThanOrEqual(4.5))
    }
    it(`${theme}: fg and muted on the page background`, () => {
      expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.muted, t.bg)).toBeGreaterThanOrEqual(4.5)
    })
    it(`${theme}: button text (--on-accent) on the accent`, () => expect(contrast(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5))
  }
  it('System under a dark OS uses exactly the dark tokens', () => expect(THEMES.systemDark).toEqual(THEMES.dark))
})

// AC-25: the reactor prints text (both numbers in the foreground colour) over a tier colour blended into the cell.
// The worst case is a full cell. (A muted colour for the core number failed at 2.2 to 2.6, and 0.55 opacity failed on amber in dark.)
describe('text on the reactor cells (WCAG AA, 4.5:1)', () => {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const blend = (top: string, bottom: string, a: number) => '#' + rgb(top).map((v, i) => Math.round(v * a + rgb(bottom)[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
  for (const theme of ['light', 'dark'] as const) {
    const t = THEMES[theme]
    for (const tier of ['accent', 'warn', 'bad']) {
      it(`${theme}: text on a full ${tier} cell`, () => expect(contrast(t.fg, blend(t[tier], t.bg, FILL_OPACITY))).toBeGreaterThanOrEqual(4.5))
    }
    it(`${theme}: text on an empty cell`, () => expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5))
  }
  it('would fail at the old 0.55 opacity (so the test is meaningful)', () => {
    const worst = Math.min(...(['light', 'dark'] as const).flatMap((th) => ['accent', 'warn', 'bad'].map((k) => contrast(THEMES[th].fg, blend(THEMES[th][k], THEMES[th].bg, 0.55)))))
    expect(worst).toBeLessThan(4.5)
  })
})
