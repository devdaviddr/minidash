import { CARDS, CARD_IDS, SPANS, partIds, type CardId, type Span } from './catalogue'

export const LAYOUT_VERSION = 1
export const LAYOUT_KEY = 'minidash.layout'

export interface CardLayout {
  id: CardId
  visible: boolean
  span: Span
  hidden: string[]
}

export interface Layout {
  version: 1
  summary: { visible: boolean; hidden: string[] }
  /** Array order is the display order. */
  cards: CardLayout[]
}

export function defaultLayout(): Layout {
  return {
    version: 1,
    summary: { visible: true, hidden: [] },
    cards: CARDS.map((c) => ({ id: c.id, visible: true, span: c.defaultSpan, hidden: [] })),
  }
}

// ---------------------------------------------------------------- validation

export type Validation = { ok: true; layout: Layout; notes: string[] } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isSpan = (v: unknown): v is Span => SPANS.includes(v as Span)

/** Keeps only known part ids, once each, and reports how many were dropped. */
function knownParts(raw: unknown, id: string, notes: string[]): string[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(partIds(id))
  const out = [...new Set(raw.filter((p): p is string => typeof p === 'string' && known.has(p)))]
  if (out.length !== raw.length) notes.push(`ignored unknown or repeated parts in ${id}`)
  return out
}

/**
 * Checks untrusted input (a stored value or an imported file) against spec §7.
 * Refuses structurally wrong input; repairs what a different app version could legitimately produce
 * (unknown cards or parts, missing cards, an unusable width, duplicates).
 */
export function validateLayout(input: unknown): Validation {
  if (!isObject(input)) return { ok: false, error: 'This is not a minidash layout (expected a JSON object).' }
  if (typeof input.version !== 'number') return { ok: false, error: 'This is not a minidash layout (no version).' }
  if (input.version > LAYOUT_VERSION) return { ok: false, error: `This layout is from a newer minidash (version ${input.version}); update minidash to import it.` }
  if (input.version !== LAYOUT_VERSION) return { ok: false, error: `Unsupported layout version ${input.version}.` }

  const notes: string[] = []

  const s = input.summary
  if (!isObject(s) || typeof s.visible !== 'boolean') return { ok: false, error: 'The layout is missing "summary.visible".' }
  const summary = { visible: s.visible, hidden: knownParts(s.hidden, 'summary', notes) }

  if (!Array.isArray(input.cards)) return { ok: false, error: 'The layout is missing the "cards" list.' }

  const seen = new Set<string>()
  const cards: CardLayout[] = []
  for (const raw of input.cards) {
    if (!isObject(raw) || typeof raw.id !== 'string') return { ok: false, error: 'A card entry has no id.' }
    const def = CARDS.find((c) => c.id === raw.id)
    if (!def) { notes.push(`ignored unknown card "${raw.id}"`); continue }
    if (seen.has(def.id)) { notes.push(`ignored a repeated entry for ${def.id}`); continue }
    if (typeof raw.visible !== 'boolean') return { ok: false, error: `Card "${def.id}" is missing "visible".` }
    seen.add(def.id)
    let span: Span = def.defaultSpan
    if (isSpan(raw.span)) span = raw.span
    else notes.push(`reset the width of ${def.id}`)
    cards.push({ id: def.id, visible: raw.visible, span, hidden: knownParts(raw.hidden, def.id, notes) })
  }
  for (const def of CARDS) {
    if (!seen.has(def.id)) {
      cards.push({ id: def.id, visible: true, span: def.defaultSpan, hidden: [] })
      notes.push(`added the new card ${def.id}`)
    }
  }
  return { ok: true, layout: { version: 1, summary, cards }, notes }
}

// ---------------------------------------------------------------- reducer

export type LayoutAction =
  | { type: 'setVisible'; id: CardId | 'summary'; visible: boolean }
  | { type: 'setSpan'; id: CardId; span: Span }
  | { type: 'togglePart'; id: CardId | 'summary'; part: string }
  | { type: 'step'; id: CardId; delta: -1 | 1 }
  | { type: 'reorder'; id: CardId; overId: CardId }
  | { type: 'replace'; layout: Layout }
  | { type: 'reset' }

const updateCard = (l: Layout, id: CardId, fn: (c: CardLayout) => CardLayout): Layout => ({
  ...l,
  cards: l.cards.map((c) => (c.id === id ? fn(c) : c)),
})

const toggle = (list: string[], part: string): string[] => (list.includes(part) ? list.filter((p) => p !== part) : [...list, part])

export function layoutReducer(l: Layout, a: LayoutAction): Layout {
  switch (a.type) {
    case 'setVisible':
      return a.id === 'summary' ? { ...l, summary: { ...l.summary, visible: a.visible } } : updateCard(l, a.id, (c) => ({ ...c, visible: a.visible }))
    case 'setSpan':
      return isSpan(a.span) ? updateCard(l, a.id, (c) => ({ ...c, span: a.span })) : l
    case 'togglePart':
      if (!partIds(a.id).includes(a.part)) return l
      return a.id === 'summary'
        ? { ...l, summary: { ...l.summary, hidden: toggle(l.summary.hidden, a.part) } }
        : updateCard(l, a.id, (c) => ({ ...c, hidden: toggle(c.hidden, a.part) }))
    case 'step': {
      // "Earlier"/"later" means relative to the cards you can see, so hidden cards never absorb a step.
      const visible = l.cards.filter((c) => c.visible).map((c) => c.id)
      const at = visible.indexOf(a.id)
      const neighbour = visible[at + a.delta]
      if (at < 0 || neighbour === undefined) return l
      return layoutReducer(l, { type: 'reorder', id: a.id, overId: neighbour })
    }
    case 'reorder': {
      const from = l.cards.findIndex((c) => c.id === a.id)
      const to = l.cards.findIndex((c) => c.id === a.overId)
      if (from < 0 || to < 0 || from === to) return l
      const cards = [...l.cards]
      const [moved] = cards.splice(from, 1)
      cards.splice(to, 0, moved)
      return { ...l, cards }
    }
    case 'replace':
      return a.layout
    case 'reset':
      return defaultLayout()
  }
}

// ---------------------------------------------------------------- display helpers

/** Wall-display mode hides these cards at display time. It never changes the saved layout. */
export const WALL_HIDDEN: CardId[] = ['processes', 'shares']

export function visibleCards(l: Layout, wall: boolean): CardLayout[] {
  return l.cards.filter((c) => c.visible && !(wall && WALL_HIDDEN.includes(c.id)))
}

// ---------------------------------------------------------------- persistence and files

/** Reads the saved layout. Missing, unreadable or invalid data gives the default; this never throws. */
export function loadLayout(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): { layout: Layout; notes: string[] } {
  try {
    const raw = storage?.getItem(LAYOUT_KEY)
    if (raw == null) return { layout: defaultLayout(), notes: [] }
    const v = validateLayout(JSON.parse(raw))
    return v.ok ? { layout: v.layout, notes: v.notes } : { layout: defaultLayout(), notes: [`saved layout ignored: ${v.error}`] }
  } catch {
    return { layout: defaultLayout(), notes: ['saved layout was unreadable and was reset'] }
  }
}

/** Saves the layout; returns false if storage is unavailable (the layout then lasts for the session). */
export function saveLayout(l: Layout, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(LAYOUT_KEY, JSON.stringify(l))
    return true
  } catch {
    return false
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** The export file: the layout as readable JSON. */
export const serializeLayout = (l: Layout): string => JSON.stringify(l, null, 2) + '\n'

/** Parses an imported file's text. Never throws. */
export function parseLayoutFile(text: string): Validation {
  try {
    return validateLayout(JSON.parse(text))
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
}

export { CARD_IDS }
