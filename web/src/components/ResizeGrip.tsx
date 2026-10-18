import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import type { Span } from '../layout/catalogue'
import { MAX_SPAN, MIN_SPAN, readGridMetrics, spanFromKey, spanFromPointer } from '../layout/resize'

interface Props {
  title: string
  span: Span
  /** Called only when the snapped width changes, so a drag does not redraw charts on every pointer move. */
  onSpan: (span: Span) => void
  /** The card's grid cell, used to measure columns. */
  itemRef: RefObject<HTMLElement | null>
}

interface Drag {
  startSpan: Span
  last: Span
  cardLeft: number
  columnWidth: number
  gap: number
}

/**
 * A grip on a card's right edge. Drag it to resize in whole columns (Escape cancels), or focus it and use the
 * arrow keys. It is a slider for assistive technology. It is shown only where the grid has four columns.
 */
export function ResizeGrip({ title, span, onSpan, itemRef }: Props) {
  const drag = useRef<Drag | null>(null)
  const [active, setActive] = useState(false)
  const [focused, setFocused] = useState(false)

  const end = () => {
    drag.current = null
    setActive(false)
  }

  // Escape during a drag puts the width back as it was. It listens in the capture phase so it runs before the
  // customise panel's own Escape handler, and preventDefault tells that handler the key was already used.
  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || !drag.current) return
      e.preventDefault()
      onSpan(drag.current.startSpan)
      end()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, onSpan])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const item = itemRef.current
    const grid = item?.parentElement
    const m = grid && readGridMetrics(grid)
    if (!item || !m || m.columns !== MAX_SPAN) return // resizing is offered on the four-column grid only
    e.preventDefault()
    e.stopPropagation() // do not also select the card or start a card drag
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { startSpan: span, last: span, cardLeft: item.getBoundingClientRect().left, columnWidth: m.columnWidth, gap: m.gap }
    setActive(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const next = spanFromPointer(e.clientX, d.cardLeft, d)
    if (next !== d.last) {
      d.last = next
      onSpan(next)
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    end()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = spanFromKey(e.key, span)
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    if (next !== span) onSpan(next)
  }

  const show = active || focused
  return (
    <>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Resize ${title}`}
        aria-orientation="horizontal"
        aria-valuemin={MIN_SPAN}
        aria-valuemax={MAX_SPAN}
        aria-valuenow={span}
        aria-valuetext={`${span} of ${MAX_SPAN} columns`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(e) => e.stopPropagation()}
        className="group absolute inset-y-3 -right-2.5 z-10 hidden w-5 cursor-ew-resize touch-none items-center justify-center outline-none lg:flex"
      >
        <span className={`h-12 w-1.5 rounded-full transition-colors ${show ? 'bg-accent' : 'bg-accent/50 group-hover:bg-accent'} group-focus-visible:ring-2 group-focus-visible:ring-accent/50`} />
      </div>
      {show && (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-3 z-10 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-on-accent shadow">
          {span} / {MAX_SPAN}
        </span>
      )}
    </>
  )
}
