import type { Span } from './catalogue'

/** Widths apply on large screens; below that, cards stack in one column in layout order.
 * Full class names, so Tailwind can see them. */
export const SPAN_CLASS: Record<Span, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  4: 'lg:col-span-4',
}
