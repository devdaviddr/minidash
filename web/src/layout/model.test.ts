import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARDS, CARD_IDS, partIds } from './catalogue'
import {
  defaultLayout,
  layoutReducer,
  LAYOUT_KEY,
  loadLayout,
  parseLayoutFile,
  saveLayout,
  serializeLayout,
  validateLayout,
  visibleCards,
  type Layout,
} from './model'

const ids = (l: Layout) => l.cards.map((c) => c.id)
const mem = (initial?: string) => {
  const store = new Map<string, string>(initial === undefined ? [] : [[LAYOUT_KEY, initial]])
  return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), store }
}

describe('default layout', () => {
  it('shows every card in the 0.1.0 order with the 0.1.0 widths and nothing hidden', () => {
    const l = defaultLayout()
    expect(ids(l)).toEqual(['cpu', 'gpu', 'memory', 'network', 'storage', 'shares', 'containers', 'processes'])
    expect(l.cards.map((c) => c.span)).toEqual([2, 2, 2, 2, 2, 2, 4, 4])
    expect(l.cards.every((c) => c.visible && c.hidden.length === 0)).toBe(true)
    expect(l.summary).toEqual({ visible: true, hidden: [] })
  })
  it('is built from the catalogue', () => expect(ids(defaultLayout())).toEqual(CARD_IDS))
})

describe('validateLayout', () => {
  it('accepts the default layout unchanged', () => {
    const v = validateLayout(defaultLayout())
    expect(v.ok && v.layout).toEqual(defaultLayout())
    expect(v.ok && v.notes).toEqual([])
  })
  it.each([
    ['null', null], ['a string', 'x'], ['an array', []], ['no version', {}], ['a string version', { version: '1' }],
  ])('refuses %s', (_, input) => expect(validateLayout(input).ok).toBe(false))
  it('refuses a newer version with a helpful message', () => {
    const v = validateLayout({ ...defaultLayout(), version: 2 })
    expect(!v.ok && v.error).toMatch(/newer minidash/)
  })
  it('refuses structurally wrong content', () => {
    expect(validateLayout({ ...defaultLayout(), summary: { visible: 'yes' } }).ok).toBe(false)
    expect(validateLayout({ ...defaultLayout(), cards: 'no' }).ok).toBe(false)
    expect(validateLayout({ ...defaultLayout(), cards: [{ visible: true }] }).ok).toBe(false)
    expect(validateLayout({ ...defaultLayout(), cards: [{ id: 'cpu', visible: 'yes' }] }).ok).toBe(false)
  })
  it('ignores unknown cards and parts, repairs widths, drops duplicates', () => {
    const l = defaultLayout()
    const input = {
      ...l,
      summary: { visible: true, hidden: ['power', 'bogus'] },
      cards: [
        { id: 'gpu', visible: false, span: 3, hidden: ['fans', 'nope', 'fans'] },
        { id: 'warp-drive', visible: true, span: 1, hidden: [] },
        { id: 'gpu', visible: true, span: 1, hidden: [] },
        ...l.cards.filter((c) => c.id !== 'gpu'),
      ],
    }
    const v = validateLayout(input)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.layout.cards[0]).toEqual({ id: 'gpu', visible: false, span: 2, hidden: ['fans'] }) // span reset to the default 2
    expect(v.layout.summary.hidden).toEqual(['power'])
    expect(ids(v.layout)).not.toContain('warp-drive')
    expect(v.layout.cards.length).toBe(CARDS.length)
    expect(v.notes.join(' ')).toMatch(/unknown card "warp-drive"/)
  })
  // AC-15: a card missing from an imported file appears with its defaults (e.g. one added by a newer minidash)
  it('appends cards missing from the file with their defaults', () => {
    const l = defaultLayout()
    const v = validateLayout({ ...l, cards: l.cards.filter((c) => c.id !== 'containers') })
    expect(v.ok && v.layout.cards.at(-1)).toEqual({ id: 'containers', visible: true, span: 4, hidden: [] })
    expect(v.ok && v.notes).toContain('added the new card containers')
  })
})

describe('reducer', () => {
  const base = defaultLayout()
  it('shows and hides cards and the summary', () => {
    let l = layoutReducer(base, { type: 'setVisible', id: 'gpu', visible: false })
    expect(l.cards.find((c) => c.id === 'gpu')?.visible).toBe(false)
    l = layoutReducer(l, { type: 'setVisible', id: 'summary', visible: false })
    expect(l.summary.visible).toBe(false)
    expect(base.cards[1].visible).toBe(true) // inputs are never mutated
  })
  it('sets widths', () => {
    expect(layoutReducer(base, { type: 'setSpan', id: 'cpu', span: 4 }).cards[0].span).toBe(4)
    expect(layoutReducer(base, { type: 'setSpan', id: 'cpu', span: 3 as never })).toBe(base)
  })
  it('toggles known parts only', () => {
    let l = layoutReducer(base, { type: 'togglePart', id: 'cpu', part: 'cores' })
    expect(l.cards[0].hidden).toEqual(['cores'])
    l = layoutReducer(l, { type: 'togglePart', id: 'cpu', part: 'cores' })
    expect(l.cards[0].hidden).toEqual([])
    expect(layoutReducer(base, { type: 'togglePart', id: 'cpu', part: 'bogus' })).toBe(base)
    expect(layoutReducer(base, { type: 'togglePart', id: 'summary', part: 'power' }).summary.hidden).toEqual(['power'])
  })
  // AC-12
  it('moves a card earlier and later by one place', () => {
    const l = layoutReducer(base, { type: 'step', id: 'gpu', delta: -1 })
    expect(ids(l).slice(0, 2)).toEqual(['gpu', 'cpu'])
    expect(ids(layoutReducer(l, { type: 'step', id: 'gpu', delta: 1 })).slice(0, 2)).toEqual(['cpu', 'gpu'])
  })
  it('does nothing at the ends', () => {
    expect(layoutReducer(base, { type: 'step', id: 'cpu', delta: -1 })).toBe(base)
    expect(layoutReducer(base, { type: 'step', id: 'processes', delta: 1 })).toBe(base)
  })
  it('steps relative to visible cards, so a hidden card never absorbs a step', () => {
    const hidden = layoutReducer(base, { type: 'setVisible', id: 'gpu', visible: false }) // cpu, [gpu], memory, ...
    const visibleIds = (l: Layout) => visibleCards(l, false).map((c) => c.id)

    const earlier = layoutReducer(hidden, { type: 'step', id: 'memory', delta: -1 })
    expect(visibleIds(earlier).slice(0, 2)).toEqual(['memory', 'cpu']) // one visible place earlier, over the hidden gpu's neighbour
    expect(ids(earlier).slice(0, 3)).toEqual(['memory', 'cpu', 'gpu'])

    const later = layoutReducer(hidden, { type: 'step', id: 'cpu', delta: 1 })
    expect(visibleIds(later).slice(0, 2)).toEqual(['memory', 'cpu']) // cpu jumped over the hidden gpu to pass memory
  })
  it('reorders by drag (move before the card dropped on)', () => {
    const l = layoutReducer(base, { type: 'reorder', id: 'processes', overId: 'cpu' })
    expect(ids(l)[0]).toBe('processes')
    expect(layoutReducer(base, { type: 'reorder', id: 'cpu', overId: 'cpu' })).toBe(base)
  })
  it('resets and replaces', () => {
    const changed = layoutReducer(base, { type: 'setVisible', id: 'cpu', visible: false })
    expect(layoutReducer(changed, { type: 'reset' })).toEqual(defaultLayout())
    expect(layoutReducer(base, { type: 'replace', layout: changed })).toBe(changed)
  })
})

describe('display', () => {
  // AC-16: wall mode filters at display time and never touches the saved layout.
  it('wall mode hides processes and shares without changing the layout', () => {
    const l = defaultLayout()
    const snapshot = JSON.stringify(l)
    expect(visibleCards(l, true).map((c) => c.id)).not.toEqual(expect.arrayContaining(['processes']))
    expect(visibleCards(l, true).map((c) => c.id)).not.toContain('shares')
    expect(visibleCards(l, false).length).toBe(8)
    expect(JSON.stringify(l)).toBe(snapshot)
  })
  it('hidden cards are not displayed', () => {
    const l = layoutReducer(defaultLayout(), { type: 'setVisible', id: 'network', visible: false })
    expect(visibleCards(l, false).map((c) => c.id)).not.toContain('network')
  })
})

describe('persistence and files (AC-15)', () => {
  const custom = layoutReducer(layoutReducer(defaultLayout(), { type: 'step', id: 'gpu', delta: -1 }), { type: 'togglePart', id: 'cpu', part: 'cores' })
  it('round-trips through storage', () => {
    const s = mem()
    expect(saveLayout(custom, s)).toBe(true)
    expect(loadLayout(s).layout).toEqual(custom)
  })
  it('loads the default when nothing is saved', () => expect(loadLayout(mem()).layout).toEqual(defaultLayout()))
  it('falls back to the default on corrupt or invalid stored data, without throwing', () => {
    for (const bad of ['{not json', '[]', '{"version":9}', 'null']) {
      const r = loadLayout(mem(bad))
      expect(r.layout).toEqual(defaultLayout())
      expect(r.notes.length).toBeGreaterThan(0)
    }
  })
  it('survives storage that throws', () => {
    const boom = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(loadLayout(boom).layout).toEqual(defaultLayout())
    expect(saveLayout(custom, boom)).toBe(false)
  })
  it('an exported file imports to an identical layout', () => {
    const v = parseLayoutFile(serializeLayout(custom))
    expect(v.ok && v.layout).toEqual(custom)
  })
  it('refuses a file that is not JSON or not a layout, with a message', () => {
    const a = parseLayoutFile('hello')
    expect(!a.ok && a.error).toMatch(/not valid JSON/)
    expect(parseLayoutFile('{"hello":1}').ok).toBe(false)
  })
})

describe('catalogue', () => {
  it('every card has at least one part and unique part ids', () => {
    for (const c of CARDS) {
      const p = partIds(c.id)
      expect(p.length).toBeGreaterThan(0)
      expect(new Set(p).size).toBe(p.length)
    }
  })
})

// AC-17: layout operations are browser-only. They must never touch the agent or the network.
describe('no network access (AC-17)', () => {
  it('the layout code never uses fetch, WebSocket or XMLHttpRequest', () => {
    const dir = import.meta.dirname
    const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    expect(sources.length).toBeGreaterThan(1)
    for (const f of sources) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/\b(fetch|WebSocket|XMLHttpRequest|sendBeacon)\b/)
  })
})
