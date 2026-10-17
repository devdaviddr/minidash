import type { Dispatch } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { CARD_IDS } from '../layout/catalogue'
import { visibleCards, type Layout, type LayoutAction } from '../layout/model'
import { Summary } from './Summary'
import { SortableGrid } from './SortableGrid'

function EmptyState({ onShowAll, wall }: { onShowAll: () => void; wall: boolean }) {
  return (
    <div role="status" className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="max-w-md">
        <h2 className="text-base font-semibold">Nothing to show</h2>
        <p className="mt-2 text-sm text-muted">
          {wall ? 'Wall display hides some cards, and the rest are hidden in your layout. ' : 'Every card is hidden in your layout. '}
          Show them again, or open Customise to choose what appears.
        </p>
        <button
          type="button"
          onClick={onShowAll}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Show all cards
        </button>
      </div>
    </div>
  )
}

interface Props {
  history: Snapshot[]
  layout: Layout
  wall: boolean
  /** True while the customise panel is open: cards show drag handles. */
  editing?: boolean
  dispatch: Dispatch<LayoutAction>
}

/** Renders the summary strip and the cards exactly as the layout says. */
export function Dashboard({ history, layout, wall, editing = false, dispatch }: Props) {
  const snapshot = history.at(-1)
  const cards = visibleCards(layout, wall)

  const showAll = () => {
    dispatch({ type: 'setVisible', id: 'summary', visible: true })
    for (const id of CARD_IDS) dispatch({ type: 'setVisible', id, visible: true })
  }

  return (
    <main className={`mx-auto flex max-w-7xl flex-col gap-4 ${wall ? 'text-[1.15em]' : ''}`}>
      {layout.summary.visible && <Summary snapshot={snapshot} hidden={new Set(layout.summary.hidden)} />}
      {cards.length === 0 ? (
        <EmptyState onShowAll={showAll} wall={wall} />
      ) : (
        <SortableGrid cards={cards} history={history} editing={editing && !wall} dispatch={dispatch} />
      )}
    </main>
  )
}


