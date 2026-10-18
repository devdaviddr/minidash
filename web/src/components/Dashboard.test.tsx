// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARDS, SUMMARY_PARTS } from '../layout/catalogue'
import { defaultLayout, layoutReducer, type Layout, type LayoutAction } from '../layout/model'
import { COMPONENTS } from '../layout/registry'
import { fixture } from '../test/fixture'
import { Dashboard } from './Dashboard'
import { Summary } from './Summary'

// uPlot needs a real canvas; charts are exercised by the stream/history tests and visual review.
vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(cleanup)

const history = [fixture()]
const parts = (root: ParentNode) => [...new Set([...root.querySelectorAll('[data-part]')].map((e) => e.getAttribute('data-part')))].sort()

// The catalogue says which parts exist; the components must agree, or the customise panel would lie.
describe('catalogue and components agree', () => {
  for (const card of CARDS) {
    const Card = COMPONENTS[card.id]
    const declared = card.parts.map((p) => p.id).sort()

    it(`${card.id}: every declared part is rendered, and nothing undeclared is`, () => {
      const { container } = render(<Card history={history} />)
      expect(parts(container)).toEqual(declared)
    })
    for (const part of declared) {
      it(`${card.id}: hiding "${part}" removes it and leaves the other parts`, () => {
        const { container } = render(<Card history={history} hidden={new Set([part])} />)
        expect(parts(container)).toEqual(declared.filter((p) => p !== part))
        expect(container.textContent?.length).toBeGreaterThan(0) // the card itself is still there
      })
    }
  }
  it('summary pills match the catalogue and can be hidden one by one', () => {
    const declared = SUMMARY_PARTS.map((p) => p.id).sort()
    const { container, rerender } = render(<Summary snapshot={history[0]} />)
    expect(parts(container)).toEqual(declared)
    rerender(<Summary snapshot={history[0]} hidden={new Set(['gpu', 'power'])} />)
    expect(parts(container)).toEqual(['cpu', 'memory', 'network'])
  })
})

const renderDash = (layout: Layout, wall = false, dispatch: (a: LayoutAction) => void = () => {}) =>
  render(<Dashboard history={history} layout={layout} wall={wall} dispatch={dispatch} />)
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-card]')].map((e) => e.getAttribute('data-card'))

describe('Dashboard renders the layout', () => {
  it('shows every card in the default order with the default widths', () => {
    const { container } = renderDash(defaultLayout())
    expect(order(container)).toEqual(['cpu', 'gpu', 'memory', 'network', 'storage', 'shares', 'containers', 'processes'])
    expect(screen.getByLabelText('Summary')).toBeTruthy()
    expect(container.querySelector('[data-card="cpu"]')?.className).toContain('lg:col-span-2')
    expect(container.querySelector('[data-card="containers"]')?.className).toContain('lg:col-span-4')
  })

  // AC-11
  it('hidden cards and a hidden summary are not in the page', () => {
    let l = layoutReducer(defaultLayout(), { type: 'setVisible', id: 'gpu', visible: false })
    l = layoutReducer(l, { type: 'setVisible', id: 'summary', visible: false })
    const { container } = renderDash(l)
    expect(order(container)).not.toContain('gpu')
    expect(screen.queryByLabelText('Summary')).toBeNull()
    expect(screen.queryByText('GPU & power')).toBeNull()
  })

  it('shows an explanatory empty state, with a way back, when everything is hidden', async () => {
    let l = layoutReducer(defaultLayout(), { type: 'setVisible', id: 'summary', visible: false })
    for (const c of defaultLayout().cards) l = layoutReducer(l, { type: 'setVisible', id: c.id, visible: false })
    const dispatch = vi.fn()
    renderDash(l, false, dispatch)
    expect(screen.getByText('Nothing to show')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Show all cards' }))
    expect(dispatch).toHaveBeenCalledTimes(9) // the summary and eight cards
    expect(dispatch).toHaveBeenCalledWith({ type: 'setVisible', id: 'cpu', visible: true })
  })

  // AC-12 (render order half; the move controls are tested with the panel)
  it('renders in layout order', () => {
    const l = layoutReducer(defaultLayout(), { type: 'step', id: 'gpu', delta: -1 })
    expect(order(renderDash(l).container).slice(0, 2)).toEqual(['gpu', 'cpu'])
  })

  // AC-13
  it.each([
    [1, 'lg:col-span-'],
    [2, 'lg:col-span-2'],
    [3, 'lg:col-span-3'],
    [4, 'lg:col-span-4'],
  ] as const)('a card of width %i spans the matching columns on large screens', (span, cls) => {
    const l = layoutReducer(defaultLayout(), { type: 'setSpan', id: 'network', span })
    const el = renderDash(l).container.querySelector('[data-card="network"]')
    if (span === 1) expect(el?.className).not.toContain(cls) // width 1 is the grid default: one cell
    else expect(el?.className).toContain(cls)
    expect(el?.getAttribute('data-span')).toBe(String(span))
  })

  // AC-14
  it('hiding the per-core reactor leaves the CPU card and every other card intact', () => {
    const l = layoutReducer(defaultLayout(), { type: 'togglePart', id: 'cpu', part: 'cores' })
    const { container } = renderDash(l)
    expect(screen.queryByLabelText('Per-core utilisation')).toBeNull()
    const cpuCard = container.querySelector('[data-card="cpu"]') as HTMLElement
    expect(within(cpuCard).getByText('42')).toBeTruthy() // the total is still there
    expect(order(container).length).toBe(8)
  })

  // AC-16
  it('wall mode hides processes and shares in the page without changing the layout', () => {
    const l = defaultLayout()
    const before = JSON.stringify(l)
    const { container, unmount } = renderDash(l, true)
    expect(order(container)).not.toContain('processes')
    expect(order(container)).not.toContain('shares')
    expect(JSON.stringify(l)).toBe(before)
    unmount()
    expect(order(renderDash(l, false).container)).toContain('processes')
  })

  it('keeps showing a healthy card when another collector failed', () => {
    const snap = fixture({ memory: { ok: false, error: 'boom' } })
    render(<Dashboard history={[snap]} layout={defaultLayout()} wall={false} dispatch={() => {}} />)
    expect(screen.getByText('Unavailable: boom')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })
})
