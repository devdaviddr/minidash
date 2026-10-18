import { SPANS, type Span } from './catalogue'

export const MIN_SPAN = SPANS[0]
export const MAX_SPAN = SPANS[SPANS.length - 1]

export interface GridMetrics {
  /** Width of one column in pixels. */
  columnWidth: number
  /** Gap between columns in pixels. */
  gap: number
  /** Number of columns the grid currently has. */
  columns: number
}

/** "300px 300px 300px 300px" (what getComputedStyle reports for a resolved grid) -> [300, 300, 300, 300]. */
export function parseTracks(template: string): number[] {
  return template
    .trim()
    .split(/\s+/)
    .map((t) => (t.endsWith('px') ? parseFloat(t) : NaN))
    .filter((n) => Number.isFinite(n))
}

/** Measures a rendered grid. Returns null when it cannot be measured (for example in a test DOM). */
export function readGridMetrics(grid: Element, getStyle: (el: Element) => CSSStyleDeclaration = getComputedStyle): GridMetrics | null {
  const style = getStyle(grid)
  const tracks = parseTracks(style.gridTemplateColumns)
  if (tracks.length === 0) return null
  return { columnWidth: tracks[0], gap: parseFloat(style.columnGap) || 0, columns: tracks.length }
}

/**
 * The width a card should have when its right edge is dragged to pointerX.
 * A card of n columns is n * columnWidth + (n - 1) * gap wide, so n = (width + gap) / (columnWidth + gap),
 * rounded to the nearest whole column and kept between 1 and 4. `cardLeft` is where the card's left edge was
 * when the drag began; it is not re-measured, so reflowing the card to another row cannot feed back into the maths.
 */
export function spanFromPointer(pointerX: number, cardLeft: number, m: Pick<GridMetrics, 'columnWidth' | 'gap'>): Span {
  const n = Math.round((pointerX - cardLeft + m.gap) / (m.columnWidth + m.gap))
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, n)) as Span
}

/** One step of the keyboard slider: Left/Down narrower, Right/Up wider, Home 1, End 4. Null for other keys. */
export function spanFromKey(key: string, span: Span): Span | null {
  const clamp = (n: number) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, n)) as Span
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(span - 1)
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(span + 1)
    case 'Home':
      return MIN_SPAN
    case 'End':
      return MAX_SPAN
    default:
      return null
  }
}
