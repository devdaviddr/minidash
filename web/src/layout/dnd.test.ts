import { describe, expect, it } from 'vitest'
import { layoutReducer, defaultLayout } from './model'
import { reorderFromDrop } from './dnd'

describe('reorderFromDrop', () => {
  it('moves the dragged card to where it was dropped', () => {
    const a = reorderFromDrop({ active: { id: 'processes' }, over: { id: 'cpu' } })
    expect(a).toEqual({ type: 'reorder', id: 'processes', overId: 'cpu' })
    expect(layoutReducer(defaultLayout(), a!).cards[0].id).toBe('processes')
  })
  it('does nothing when dropped outside or on itself', () => {
    expect(reorderFromDrop({ active: { id: 'cpu' }, over: null })).toBeNull()
    expect(reorderFromDrop({ active: { id: 'cpu' }, over: { id: 'cpu' } })).toBeNull()
  })
})
