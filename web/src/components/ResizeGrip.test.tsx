// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardId } from '../layout/catalogue'
import { defaultLayout, layoutReducer, loadLayout } from '../layout/model'
import { useLayout } from '../layout/useLayout'
import { fixture } from '../test/fixture'
import { CustomisePanel } from './CustomisePanel'
import { Dashboard } from './Dashboard'
import { SortableGrid } from './SortableGrid'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))

const history = [fixture()]
const spanOf = (c: HTMLElement, id: string) => c.querySelector(`[data-card="${id}"]`)?.getAttribute('data-span')
const slider = (title: string) => screen.getByRole('slider', { name: `Resize ${title}` })

// jsdom has no layout engine: give the grid four 300px columns with a 16px gap, and put every card at x = 0.
let tracks = '300px 300px 300px 300px'
beforeEach(() => {
  tracks = '300px 300px 300px 300px'
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    if (el.parentElement && el.className?.toString().includes('grid-cols-1')) return { gridTemplateColumns: tracks, columnGap: '16px' } as CSSStyleDeclaration
    return real(el, pseudo)
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 600, 300))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// One synthetic pointer event. (jsdom's PointerEvent support is partial, and React only reads clientX and button.)
const fire = (el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number, button = 0) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button }))
  })

function Harness() {
  const [layout, dispatch] = useReducer(layoutReducer, defaultLayout())
  return <Dashboard history={history} layout={layout} wall={false} editing dispatch={dispatch} />
}

// AC-18 (keyboard half)
describe('resize slider', () => {
  it('is a slider with its width exposed, one per card', () => {
    render(<Harness />)
    expect(screen.getAllByRole('slider')).toHaveLength(8)
    const s = slider('Network')
    expect(s.getAttribute('aria-valuemin')).toBe('1')
    expect(s.getAttribute('aria-valuemax')).toBe('4')
    expect(s.getAttribute('aria-valuenow')).toBe('2')
    expect(s.getAttribute('aria-valuetext')).toBe('2 of 4 columns')
  })

  it('changes by one column with the arrow keys and stops at 1 and 4', async () => {
    const { container } = render(<Harness />)
    slider('Network').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(spanOf(container, 'network')).toBe('3')
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(spanOf(container, 'network')).toBe('4')
    expect(slider('Network').getAttribute('aria-valuetext')).toBe('4 of 4 columns')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(spanOf(container, 'network')).toBe('1')
  })

  it('jumps with Home and End and leaves other keys alone', async () => {
    const { container } = render(<Harness />)
    slider('Network').focus()
    await userEvent.keyboard('{End}')
    expect(spanOf(container, 'network')).toBe('4')
    await userEvent.keyboard('{Home}')
    expect(spanOf(container, 'network')).toBe('1')
    await userEvent.keyboard('a')
    expect(spanOf(container, 'network')).toBe('1')
  })

  it('only resizes the card whose slider is used', async () => {
    const { container } = render(<Harness />)
    slider('CPU').focus()
    await userEvent.keyboard('{End}')
    expect(spanOf(container, 'cpu')).toBe('4')
    expect(spanOf(container, 'gpu')).toBe('2')
  })

  it('does not select the card or leak keys to the page', async () => {
    const { container } = render(<Harness />)
    slider('Network').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(container.querySelector('[data-selected]')).toBeNull()
  })

  it('shows the new width next to the grip while it has focus', async () => {
    render(<Harness />)
    expect(screen.queryByText('2 / 4')).toBeNull()
    slider('Network').focus()
    expect(await screen.findByText('2 / 4')).toBeTruthy()
  })
})

describe('resize by dragging', () => {
  const startAt = (title: string, x = 616) => {
    const s = slider(title)
    fire(s, 'pointerdown', x)
    return s
  }

  it('follows the pointer, snapping to whole columns, live', () => {
    const { container } = render(<Harness />)
    const s = startAt('Network') // span 2: right edge at 616
    expect(spanOf(container, 'network')).toBe('2')
    fire(s, 'pointermove', 940)
    expect(spanOf(container, 'network')).toBe('3')
    fire(s, 'pointermove', 1264)
    expect(spanOf(container, 'network')).toBe('4')
    fire(s, 'pointermove', 2000)
    expect(spanOf(container, 'network')).toBe('4') // clamped
    fire(s, 'pointermove', 316)
    expect(spanOf(container, 'network')).toBe('1')
    fire(s, 'pointermove', -50)
    expect(spanOf(container, 'network')).toBe('1') // clamped
  })

  it('keeps the width where it was released and ignores later movement', () => {
    const { container } = render(<Harness />)
    const s = startAt('Network')
    fire(s, 'pointermove', 940)
    fire(s, 'pointerup', 940)
    expect(spanOf(container, 'network')).toBe('3')
    fire(s, 'pointermove', 316)
    expect(spanOf(container, 'network')).toBe('3')
  })

  it('Escape during a drag restores the width from before it', async () => {
    const { container } = render(<Harness />)
    const s = startAt('Network')
    fire(s, 'pointermove', 1264)
    expect(spanOf(container, 'network')).toBe('4')
    await userEvent.keyboard('{Escape}')
    expect(spanOf(container, 'network')).toBe('2')
    fire(s, 'pointermove', 316) // the drag is over
    expect(spanOf(container, 'network')).toBe('2')
  })

  it('does not select the card, and ignores the right mouse button', () => {
    const { container } = render(<Harness />)
    const s = slider('Network')
    fire(s, 'pointerdown', 616, 2)
    fire(s, 'pointermove', 1264)
    expect(spanOf(container, 'network')).toBe('2')
    fire(s, 'pointerdown', 616)
    fire(s, 'pointerup', 616)
    expect(container.querySelector('[data-selected]')).toBeNull()
  })

  it('is not available when the grid has fewer than four columns', () => {
    tracks = '500px 500px'
    const { container } = render(<Harness />)
    const s = startAt('Network')
    fire(s, 'pointermove', 1264)
    expect(spanOf(container, 'network')).toBe('2')
  })

  // The layout changes only when the snapped width does, so charts are not redrawn on every pointer move.
  it('reports a width only when it changes', () => {
    const dispatch = vi.fn()
    const layout = defaultLayout()
    render(<SortableGrid cards={layout.cards} history={history} editing dispatch={dispatch} />)
    const s = startAt('Network')
    for (const x of [620, 640, 660, 700]) fire(s, 'pointermove', x) // all still 2 columns
    expect(dispatch).not.toHaveBeenCalled()
    fire(s, 'pointermove', 940)
    fire(s, 'pointermove', 945)
    fire(s, 'pointermove', 950)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setSpan', id: 'network', span: 3 })
  })
})

// AC-18: the width survives a reload
describe('persistence', () => {
  function Saved() {
    const { layout, dispatch } = useLayout()
    return <Dashboard history={history} layout={layout} wall={false} editing dispatch={dispatch} />
  }
  it('a resized card keeps its width after a reload', async () => {
    const first = render(<Saved />)
    slider('Network').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(spanOf(first.container, 'network')).toBe('3')
    expect(loadLayout().layout.cards.find((c) => c.id === 'network')?.span).toBe(3)
    first.unmount()
    const second = render(<Saved />)
    expect(spanOf(second.container, 'network')).toBe('3')
  })
})

// Escape belongs to the innermost thing in progress: cancelling a drag must not also deselect the card
// or close the panel.
describe('Escape with the customise panel open', () => {
  function WithPanel({ onClose }: { onClose: () => void }) {
    const [layout, dispatch] = useReducer(layoutReducer, defaultLayout())
    const [selected, setSelected] = useState<CardId | null>('network')
    return (
      <>
        <Dashboard history={history} layout={layout} wall={false} editing selectedId={selected} onSelect={setSelected} dispatch={dispatch} />
        <CustomisePanel layout={layout} dispatch={dispatch} onClose={onClose} selectedId={selected} onSelect={setSelected} saved />
      </>
    )
  }
  it('cancels the resize only, leaving the selection and the panel alone', async () => {
    const onClose = vi.fn()
    const { container } = render(<WithPanel onClose={onClose} />)
    const s = slider('Network')
    fire(s, 'pointerdown', 616)
    fire(s, 'pointermove', 1264)
    expect(spanOf(container, 'network')).toBe('4')
    await userEvent.keyboard('{Escape}')
    expect(spanOf(container, 'network')).toBe('2') // the drag was cancelled
    expect(container.querySelector('[data-card="network"]')?.getAttribute('data-selected')).toBe('true') // still selected
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}') // now nothing is in progress, so Escape deselects as usual
    expect(container.querySelector('[data-selected]')).toBeNull()
  })
})
