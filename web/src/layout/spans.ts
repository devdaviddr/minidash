import type { Span } from './catalogue'

/** Column spans by viewport. The grid is 1 column below md, 2 from md, 4 from lg (FR-21), so:
 * on 4 columns a card spans exactly its width; on 2 columns width 1 takes half and 2 to 4 take the row;
 * on 1 column everything takes the row. Full class names, so Tailwind can see them. */
export const SPAN_CLASS: Record<Span, string> = {
  1: '',
  2: 'md:col-span-2 lg:col-span-2',
  3: 'md:col-span-2 lg:col-span-3',
  4: 'md:col-span-2 lg:col-span-4',
}
