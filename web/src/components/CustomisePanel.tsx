import { useEffect, useRef, type Dispatch } from 'react'
import { CARDS, SPANS, SUMMARY_PARTS, cardDef, type PartDef, type Span } from '../layout/catalogue'
import type { CardLayout, Layout, LayoutAction } from '../layout/model'
import { LayoutFileControls } from './LayoutFileControls'

const SPAN_LABEL: Record<Span, string> = { 1: '1 column', 2: '2 columns', 3: '3 columns', 4: 'Full width' }
const SPAN_SHORT: Record<Span, string> = { 1: '1', 2: '2', 3: '3', 4: 'Full' }

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
const iconButton = `grid size-7 place-items-center rounded-md border border-line text-muted hover:text-fg disabled:opacity-40 disabled:hover:text-muted ${focusRing}`

interface Props {
  layout: Layout
  dispatch: Dispatch<LayoutAction>
  onClose: () => void
  /** False when the browser would not let us store the layout: it then lasts for this session only. */
  saved: boolean
}

function PartChecks({ owner, title, parts, hidden, dispatch }: { owner: string; title: string; parts: PartDef[]; hidden: string[]; dispatch: Dispatch<LayoutAction> }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {parts.map((p) => (
        <li key={p.id}>
          <label className="flex items-center gap-2 text-xs text-fg">
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

function CardRow({ card, firstVisible, lastVisible, dispatch }: { card: CardLayout; firstVisible: boolean; lastVisible: boolean; dispatch: Dispatch<LayoutAction> }) {
  const def = cardDef(card.id)!
  return (
    <li className={`rounded-xl border border-line bg-bg p-3 ${card.visible ? '' : 'opacity-70'}`} data-row={card.id}>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={card.visible}
            onChange={(e) => dispatch({ type: 'setVisible', id: card.id, visible: e.target.checked })}
            aria-label={`Show ${def.title}`}
          />
          {def.title}
        </label>
        <button type="button" className={iconButton} disabled={!card.visible || firstVisible} onClick={() => dispatch({ type: 'step', id: card.id, delta: -1 })} aria-label={`Move ${def.title} earlier`}>
          ↑
        </button>
        <button type="button" className={iconButton} disabled={!card.visible || lastVisible} onClick={() => dispatch({ type: 'step', id: card.id, delta: 1 })} aria-label={`Move ${def.title} later`}>
          ↓
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Width</span>
        <div role="radiogroup" aria-label={`${def.title} width`} className="inline-flex rounded-full border border-line bg-surface p-0.5">
          {SPANS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={card.span === s}
              aria-label={`${def.title} width: ${SPAN_LABEL[s]}`}
              onClick={() => dispatch({ type: 'setSpan', id: card.id, span: s })}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${focusRing} ${card.span === s ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'}`}
            >
              {SPAN_SHORT[s]}
            </button>
          ))}
        </div>
      </div>

      <details className="mt-2">
        <summary className={`cursor-pointer rounded text-xs text-muted hover:text-fg ${focusRing}`}>Details shown</summary>
        <PartChecks owner={card.id} title={def.title} parts={def.parts} hidden={card.hidden} dispatch={dispatch} />
      </details>
    </li>
  )
}

/** Non-modal side sheet: you keep seeing the dashboard change while you adjust it. Escape closes it. */
export function CustomisePanel({ layout, dispatch, onClose, saved }: Props) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    panel.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = layout.cards.filter((c) => c.visible).map((c) => c.id)

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

      <section aria-labelledby="summary-heading">
        <h3 id="summary-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
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
            <PartChecks owner="summary" title="the summary strip" parts={SUMMARY_PARTS} hidden={layout.summary.hidden} dispatch={dispatch} />
          </details>
        </div>
      </section>

      <section aria-labelledby="cards-heading">
        <h3 id="cards-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Cards, in display order
        </h3>
        <ul className="flex flex-col gap-2">
          {layout.cards.map((c) => (
            <CardRow key={c.id} card={c} firstVisible={visible[0] === c.id} lastVisible={visible.at(-1) === c.id} dispatch={dispatch} />
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{CARDS.length} cards. Hidden cards keep their place in the list.</p>
      </section>
      <LayoutFileControls layout={layout} dispatch={dispatch} />
    </aside>
  )
}
