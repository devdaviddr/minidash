import type { LayoutAction } from './model'
import type { CardId } from './catalogue'

/** The part of dnd-kit's DragEndEvent we use. */
export interface DropEvent {
  active: { id: string | number }
  over: { id: string | number } | null
}

/** Turns a finished drag into a layout action: the dragged card moves to where it was dropped.
 * Returns null when nothing should change (dropped outside, or on itself). */
export function reorderFromDrop(e: DropEvent): LayoutAction | null {
  if (!e.over || e.over.id === e.active.id) return null
  return { type: 'reorder', id: String(e.active.id) as CardId, overId: String(e.over.id) as CardId }
}
