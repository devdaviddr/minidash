import { useEffect, useRef, type Dispatch } from 'react'
import { CARDS, SPANS, SUMMARY_PARTS, cardDef, type CardId, type PartDef, type Span } from '../layout/catalogue'
import type { CardLayout, Layout, LayoutAction } from '../layout/model'
import { LayoutFileControls } from './LayoutFileControls'

const SPAN_LABEL: Record<Span, string> = { 1: '1 column', 2: '2 columns', 3: '3 columns', 4: 'Full width' }
const SPAN_SHORT: Record<Span, string> = { 1: '1', 2: '2', 3: '3', 4: 'Full' }

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
const iconButton = `grid size-7 place-items-center rounded-md border border-line text-muted hover:text-fg disabled:opacity-40 disabled:hover:text-muted ${focusRing}`
const heading = 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted'

interface Props {
  layout: Layout
  dispatch: Dispatch<LayoutAction>
  onClose: () => void
  /** The card whose settings are shown, or null for the overview. */
  selectedId: CardId | null
  onSelect: (id: CardId | null) => void
  /** False when the browser would not let us store the layout: it then lasts for this session only. */
  saved: boolean
}

type D = Dispatch<LayoutAction>

function PartChecks({ owner, title, parts, hidden, dispatch }: { owner: string; title: string; parts: PartDef[]; hidden: string[]; dispatch: D }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {parts.map((p) => (
        <li key={p.id}>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={!hidden.includes(p.id)}
              onChange={() => dispatch({ type: 'togglePart', id: owner as 'summary', part: p.id })}
              aria-label={`Show ${p.label} in ${title}`}
            />
            {p.label}
          </label>
        </li>
      ))}
    </ul>
  )
}

function MoveButtons({ card, title, firstVisible, lastVisible, dispatch }: { card: CardLayout; title: string; firstVisible: boolean; lastVisible: boolean; dispatch: D }) {
  return (
    <>
      <button type="button" className={iconButton} disabled={!card.visible || firstVisible} onClick={() => dispatch({ type: 'step', id: card.id, delta: -1 })} aria-label={`Move ${title} earlier`}>
        ↑
      </button>
      <button type="button" className={iconButton} disabled={!card.visible || lastVisible} onClick={() => dispatch({ type: 'step', id: card.id, delta: 1 })} aria-label={`Move ${title} later`}>
        ↓
      </button>
    </>
  )
}

/** One compact row in the overview. Selecting works from here too, so it never needs a pointer. */
function OverviewRow({ card, firstVisible, lastVisible, dispatch, onSelect }: { card: CardLayout; firstVisible: boolean; lastVisible: boolean; dispatch: D; onSelect: (id: CardId) => void }) {
  const title = cardDef(card.id)!.title
  return (
    <li className={`flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 ${card.visible ? '' : 'opacity-70'}`} data-row={card.id}>
      <input
        type="checkbox"
        className="size-4 accent-[var(--accent)]"
        checked={card.visible}
        onChange={(e) => dispatch({ type: 'setVisible', id: card.id, visible: e.target.checked })}
        aria-label={`Show ${title}`}
      />
      <button id={`select-${card.id}`} type="button" onClick={() => onSelect(card.id)} aria-label={`Select ${title}`} className={`flex-1 rounded text-left text-sm font-medium hover:text-accent ${focusRing}`}>
        {title}
      </button>
      <span className="text-xs text-muted">{SPAN_SHORT[card.span]}</span>
      <MoveButtons card={card} title={title} firstVisible={firstVisible} lastVisible={lastVisible} dispatch={dispatch} />
    </li>
  )
}

/** Everything about one card: visibility, order, width and details. */
function CardDetail({ card, firstVisible, lastVisible, dispatch, onBack }: { card: CardLayout; firstVisible: boolean; lastVisible: boolean; dispatch: D; onBack: () => void }) {
  const def = cardDef(card.id)!
  const heading3 = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading3.current?.focus() // a keyboard user lands on the card they chose
  }, [card.id])
  return (
    <section aria-labelledby="selected-title" className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className={`self-start rounded text-xs font-medium text-muted hover:text-fg ${focusRing}`}>
        ← All cards
      </button>
      <h3 id="selected-title" ref={heading3} tabIndex={-1} className="text-lg font-semibold outline-none">
        {def.title}
      </h3>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={card.visible}
            onChange={(e) => dispatch({ type: 'setVisible', id: card.id, visible: e.target.checked })}
            aria-label={`Show ${def.title}`}
          />
          Show this card
        </label>
        <div className="flex gap-2">
          <MoveButtons card={card} title={def.title} firstVisible={firstVisible} lastVisible={lastVisible} dispatch={dispatch} />
        </div>
      </div>

      <div>
        <h4 className={heading}>Width</h4>
        <div role="radiogroup" aria-label={`${def.title} width`} className="inline-flex rounded-full border border-line bg-surface p-0.5">
          {SPANS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={card.span === s}
              aria-label={`${def.title} width: ${SPAN_LABEL[s]}`}
              onClick={() => dispatch({ type: 'setSpan', id: card.id, span: s })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${focusRing} ${card.span === s ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'}`}
            >
              {SPAN_SHORT[s]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Or drag the card&apos;s right edge. Widths apply on large screens; narrower screens use fewer columns.</p>
      </div>

      <div>
        <h4 className={heading}>Details shown</h4>
        <PartChecks owner={card.id} title={def.title} parts={def.parts} hidden={card.hidden} dispatch={dispatch} />
      </div>
    </section>
  )
}

/**
 * Non-modal side sheet: you keep seeing the dashboard change while you adjust it. With a card selected it
 * shows that card's settings; otherwise it shows the overview and the save, export and import controls.
 * Escape deselects first, then closes.
 */
export function CustomisePanel({ layout, dispatch, onClose, selectedId, onSelect, saved }: Props) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    panel.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return // drags and resizes handle their own Escape
      if (selectedId) onSelect(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSelect, selectedId])

  const visible = layout.cards.filter((c) => c.visible).map((c) => c.id)
  const selected = selectedId ? layout.cards.find((c) => c.id === selectedId) : undefined

  const back = () => {
    const id = selectedId
    onSelect(null)
    if (id) requestAnimationFrame(() => document.getElementById(`select-${id}`)?.focus())
  }

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="customise-title"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-4 shadow-xl outline-none"
    >
      <div className="flex items-center justify-between">
        <h2 id="customise-title" className="text-base font-semibold">
          Customise
        </h2>
        <button type="button" onClick={onClose} aria-label="Close customise panel" className={iconButton}>
          ✕
        </button>
      </div>

      {!saved && (
        <p role="alert" className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">
          This browser would not let minidash save your layout, so it lasts until you close the page.
        </p>
      )}

      {selected ? (
        <CardDetail card={selected} firstVisible={visible[0] === selected.id} lastVisible={visible.at(-1) === selected.id} dispatch={dispatch} onBack={back} />
      ) : (
        <>
          <p className="text-xs text-muted">Click a card, or choose one below, to change its width, details and position.</p>

          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className={heading}>
              Summary strip
            </h3>
            <div className="rounded-xl border border-line bg-bg p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={layout.summary.visible}
                  onChange={(e) => dispatch({ type: 'setVisible', id: 'summary', visible: e.target.checked })}
                  aria-label="Show Summary strip"
                />
                Summary strip
              </label>
              <details className="mt-2">
                <summary className={`cursor-pointer rounded text-xs text-muted hover:text-fg ${focusRing}`}>Details shown</summary>
                <div className="mt-2">
                  <PartChecks owner="summary" title="the summary strip" parts={SUMMARY_PARTS} hidden={layout.summary.hidden} dispatch={dispatch} />
                </div>
              </details>
            </div>
          </section>

          <section aria-labelledby="cards-heading">
            <h3 id="cards-heading" className={heading}>
              Cards, in display order
            </h3>
            <ul className="flex flex-col gap-2">
              {layout.cards.map((c) => (
                <OverviewRow key={c.id} card={c} firstVisible={visible[0] === c.id} lastVisible={visible.at(-1) === c.id} dispatch={dispatch} onSelect={onSelect} />
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{CARDS.length} cards. Hidden cards keep their place in the list.</p>
          </section>

          <LayoutFileControls layout={layout} dispatch={dispatch} />
        </>
      )}
    </aside>
  )
}
