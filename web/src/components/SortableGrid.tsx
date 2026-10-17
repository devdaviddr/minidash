import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Dispatch } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { cardDef } from '../layout/catalogue'
import { reorderFromDrop } from '../layout/dnd'
import type { CardLayout, LayoutAction } from '../layout/model'
import { COMPONENTS } from '../layout/registry'
import { SPAN_CLASS } from '../layout/spans'

interface ItemProps {
  card: CardLayout
  history: Snapshot[]
  editing: boolean
}

/** One grid cell. While customising it gets a drag handle; otherwise it is a plain cell. */
function Item({ card, history, editing }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !editing })
  const Card = COMPONENTS[card.id]
  const title = cardDef(card.id)?.title ?? card.id
  return (
    <div
      ref={setNodeRef}
      data-card={card.id}
      data-span={card.span}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative min-w-0 ${SPAN_CLASS[card.span]} ${editing ? 'rounded-2xl ring-1 ring-accent/40' : ''} ${isDragging ? 'z-30 opacity-80 shadow-xl' : ''}`}
    >
      {editing && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${title} to reorder`}
          className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 cursor-grab touch-none rounded-full border border-line bg-surface px-3 py-0.5 text-xs font-medium text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing"
        >
          ⠿ Drag
        </button>
      )}
      <Card history={history} hidden={new Set(card.hidden)} />
    </div>
  )
}

interface Props {
  cards: CardLayout[]
  history: Snapshot[]
  editing: boolean
  dispatch: Dispatch<LayoutAction>
}

/** The card grid. Reordering by drag works with mouse, touch and keyboard (focus the handle, press
 * Space, move with the arrow keys, press Space again), and dnd-kit announces each step to screen readers.
 * The move earlier/later buttons in the customise panel remain as the simplest accessible route. */
export function SortableGrid({ cards, history, editing, dispatch }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const action = reorderFromDrop(e)
    if (action) dispatch(action)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className={`grid grid-cols-1 gap-4 lg:grid-cols-4 ${editing ? 'pt-3' : ''}`}>
          {cards.map((c) => (
            <Item key={c.id} card={c} history={history} editing={editing} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
