// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARDS } from '../layout/catalogue'
import { defaultLayout, layoutReducer } from '../layout/model'
import { fixture } from '../test/fixture'
import { Dashboard } from './Dashboard'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const history = [fixture()]
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-card]')].map((e) => e.getAttribute('data-card'))

function Harness({ editing, wall = false }: { editing: boolean; wall?: boolean }) {
  const [layout, dispatch] = useReducer(layoutReducer, defaultLayout())
  return <Dashboard history={history} layout={layout} wall={wall} editing={editing} dispatch={dispatch} />
}

describe('drag handles', () => {
  it('appear only while customising', () => {
    const { rerender } = render(<Harness editing={false} />)
    expect(screen.queryAllByRole('button', { name: /to reorder/ })).toHaveLength(0)
    rerender(<Harness editing />)
    expect(screen.getAllByRole('button', { name: /to reorder/ })).toHaveLength(CARDS.length)
    expect(screen.getByRole('button', { name: 'Drag GPU & power to reorder' })).toBeTruthy()
  })
  it('are never shown in wall mode', () => {
    render(<Harness editing wall />)
    expect(screen.queryAllByRole('button', { name: /to reorder/ })).toHaveLength(0)
  })
  it('are announced as sortable and described for screen readers', () => {
    render(<Harness editing />)
    const handle = screen.getByRole('button', { name: 'Drag CPU to reorder' })
    expect(handle.getAttribute('aria-roledescription')).toBe('sortable')
    expect(handle.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('are keyboard focusable', async () => {
    render(<Harness editing />)
    await userEvent.tab()
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/to reorder/)
  })
})

// jsdom has no layout, so give each card a rectangle in a two-column grid. That lets dnd-kit's real
// keyboard sensor work out which card is "to the left" and complete a genuine drag.
describe('keyboard drag (AC-12)', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const id = this.getAttribute('data-card')
      const i = CARDS.findIndex((c) => c.id === id)
      if (i < 0) return new DOMRect(0, 0, 0, 0)
      return new DOMRect((i % 2) * 520, Math.floor(i / 2) * 320, 500, 300)
    })
  })

  it('picking up GPU and moving it left drops it before CPU, and the order sticks', async () => {
    const { container } = render(<Harness editing />)
    expect(order(container).slice(0, 2)).toEqual(['cpu', 'gpu'])
    const handle = screen.getByRole('button', { name: 'Drag GPU & power to reorder' })
    handle.focus()
    await userEvent.keyboard(' ') // pick up
    await userEvent.keyboard('{ArrowLeft}') // move over CPU
    await userEvent.keyboard(' ') // drop
    expect(order(container).slice(0, 2)).toEqual(['gpu', 'cpu'])
  })

  it('Escape cancels a drag and leaves the order alone', async () => {
    const { container } = render(<Harness editing />)
    screen.getByRole('button', { name: 'Drag GPU & power to reorder' }).focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('{Escape}')
    expect(order(container).slice(0, 2)).toEqual(['cpu', 'gpu'])
  })
})
