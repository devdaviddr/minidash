// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARDS, type CardId } from '../layout/catalogue'
import { defaultLayout, layoutReducer } from '../layout/model'
import { fixture } from '../test/fixture'
import { CustomisePanel } from './CustomisePanel'
import { Dashboard } from './Dashboard'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(cleanup)

const history = [fixture()]
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-card]')].map((e) => e.getAttribute('data-card'))
const dash = (c: HTMLElement) => c.querySelector('main') as HTMLElement
const layoutJson = () => screen.getByTestId('layout-json').textContent

/** The panel and the dashboard share one reducer and one selection, as in the app. */
function Harness({ onClose = () => {}, saved = true, editing = true }: { onClose?: () => void; saved?: boolean; editing?: boolean }) {
  const [layout, dispatch] = useReducer(layoutReducer, defaultLayout())
  const [selected, setSelected] = useState<CardId | null>(null)
  return (
    <>
      <Dashboard history={history} layout={layout} wall={false} editing={editing} selectedId={selected} onSelect={setSelected} dispatch={dispatch} />
      <CustomisePanel layout={layout} dispatch={dispatch} onClose={onClose} selectedId={selected} onSelect={setSelected} saved={saved} />
      <output data-testid="layout-json">{JSON.stringify(layout)}</output>
    </>
  )
}
const panel = () => within(screen.getByRole('dialog', { name: 'Customise' }))
const select = (title: string) => userEvent.click(screen.getByRole('button', { name: `Select ${title}` }))

describe('overview', () => {
  it('lists every card with show, select and move controls, and no width controls yet', () => {
    render(<Harness />)
    for (const c of CARDS) {
      expect(screen.getByRole('checkbox', { name: `Show ${c.title}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Select ${c.title}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Move ${c.title} earlier` })).toBeTruthy()
    }
    expect(screen.getByRole('checkbox', { name: 'Show Summary strip' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull() // widths live in the selected card's view
    expect(screen.getByRole('button', { name: 'Export layout' })).toBeTruthy() // file controls belong to the overview
  })

  // Accessibility NFR: every control has a name a screen reader can announce.
  it('gives every control an accessible name, in the overview and in a card view', async () => {
    render(<Harness />)
    const named = (root: HTMLElement, atLeast: number) => {
      const controls = [...root.querySelectorAll('button, input, [role="radio"]')]
      expect(controls.length).toBeGreaterThan(atLeast)
      for (const el of controls) {
        const name = el.getAttribute('aria-label') || el.textContent?.trim() || (el.closest('label')?.textContent ?? '').trim()
        expect(name, el.outerHTML.slice(0, 80)).toBeTruthy()
      }
    }
    named(screen.getByRole('dialog', { name: 'Customise' }), 30) // overview: rows, checkboxes, file controls
    await select('CPU')
    named(screen.getByRole('dialog', { name: 'Customise' }), 8) // card view: width, details, show, move
  })

  // AC-11
  it('showing and hiding a card changes the page at once', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show GPU & power' }))
    expect(order(dash(container))).not.toContain('gpu')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show GPU & power' }))
    expect(order(dash(container))).toContain('gpu')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Summary strip' }))
    expect(within(dash(container)).queryByLabelText('Summary')).toBeNull()
  })

  // AC-12 (button half)
  it('moves a card earlier and later, disabling the buttons at the ends', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Move GPU & power earlier' }))
    expect(order(dash(container)).slice(0, 2)).toEqual(['gpu', 'cpu'])
    expect((screen.getByRole('button', { name: 'Move GPU & power earlier' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Move Processes later' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Move GPU & power later' }))
    expect(order(dash(container)).slice(0, 2)).toEqual(['cpu', 'gpu'])
  })

  it('does not offer to move a hidden card', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Network' }))
    expect((screen.getByRole('button', { name: 'Move Network earlier' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('hides a summary pill', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByText('Details shown')) // open the summary details
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Power in the summary strip' }))
    expect(container.querySelector('main [data-part="power"]')).toBeNull()
    expect(container.querySelector('main [data-part="cpu"]')).toBeTruthy()
  })
})

// AC-19
describe('selecting a card', () => {
  it('clicking a card while customising outlines it and shows only its settings in the sidebar', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(container.querySelector('[data-card="network"]') as HTMLElement)
    expect(container.querySelector('[data-card="network"]')?.getAttribute('data-selected')).toBe('true')
    expect(container.querySelectorAll('[data-selected]').length).toBe(1)
    const panel = within(screen.getByRole('dialog', { name: 'Customise' }))
    expect(panel.getByRole('heading', { name: 'Network' })).toBeTruthy()
    expect(panel.getByRole('radiogroup', { name: 'Network width' })).toBeTruthy()
    expect(panel.queryByRole('button', { name: 'Select CPU' })).toBeNull() // the overview list is gone
    expect(panel.queryByRole('button', { name: 'Export layout' })).toBeNull()
  })

  it('clicking another card switches the selection', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(container.querySelector('[data-card="network"]') as HTMLElement)
    await userEvent.click(container.querySelector('[data-card="cpu"]') as HTMLElement)
    expect(container.querySelector('[data-card="cpu"]')?.getAttribute('data-selected')).toBe('true')
    expect(container.querySelector('[data-card="network"]')?.getAttribute('data-selected')).toBeNull()
    expect(panel().getByRole('heading', { name: 'CPU' })).toBeTruthy()
  })

  it('can be chosen from the overview list, so it never needs a pointer on the page', async () => {
    const { container } = render(<Harness />)
    await select('Storage')
    expect(container.querySelector('[data-card="storage"]')?.getAttribute('data-selected')).toBe('true')
    expect(panel().getByRole('heading', { name: 'Storage' })).toBeTruthy()
    expect(document.activeElement).toBe(panel().getByRole('heading', { name: 'Storage' })) // focus follows the choice
  })

  it('"All cards" returns to the overview and focus goes back to that card in the list', async () => {
    const { container } = render(<Harness />)
    await select('Unified memory')
    await userEvent.click(screen.getByRole('button', { name: '← All cards' }))
    expect(container.querySelector('[data-selected]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Export layout' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Select Unified memory' })))
  })

  it('Escape deselects first and only then closes the panel', async () => {
    const onClose = vi.fn()
    const { container } = render(<Harness onClose={onClose} />)
    await select('CPU')
    await userEvent.keyboard('{Escape}')
    expect(container.querySelector('[data-selected]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('never changes the layout', async () => {
    const { container } = render(<Harness />)
    const before = layoutJson()
    await userEvent.click(container.querySelector('[data-card="gpu"]') as HTMLElement) // select by clicking the page
    await userEvent.click(container.querySelector('[data-card="cpu"]') as HTMLElement) // switch
    await userEvent.click(screen.getByRole('button', { name: '← All cards' })) // back to the overview
    await select('Network') // and from the list
    expect(layoutJson()).toBe(before)
  })

  it('does nothing when Customise is closed', async () => {
    const { container } = render(<Harness editing={false} />)
    await userEvent.click(container.querySelector('[data-card="cpu"]') as HTMLElement)
    expect(container.querySelector('[data-selected]')).toBeNull()
    expect(container.querySelector('[data-card="cpu"]')?.getAttribute('aria-current')).toBeNull()
  })

  it('marks the selected card for assistive technology', async () => {
    const { container } = render(<Harness />)
    await select('CPU')
    expect(container.querySelector('[data-card="cpu"]')?.getAttribute('aria-current')).toBe('true')
  })
})

describe('a selected card\'s settings', () => {
  // AC-13
  it('sets the width to 1, 2, 3 or full', async () => {
    const { container } = render(<Harness />)
    await select('Network')
    const card = () => container.querySelector('[data-card="network"]') as HTMLElement
    await userEvent.click(screen.getByRole('radio', { name: 'Network width: 1 column' }))
    expect(card().getAttribute('data-span')).toBe('1')
    await userEvent.click(screen.getByRole('radio', { name: 'Network width: 3 columns' }))
    expect(card().className).toContain('lg:col-span-3')
    await userEvent.click(screen.getByRole('radio', { name: 'Network width: Full width' }))
    expect(card().className).toContain('lg:col-span-4')
    expect(screen.getByRole('radio', { name: 'Network width: Full width' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Network width: 1 column' }).getAttribute('aria-checked')).toBe('false')
  })

  // AC-14
  it('hides and restores a detail inside that card only', async () => {
    const { container } = render(<Harness />)
    await select('CPU')
    expect(screen.getByLabelText('Per-core utilisation')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core bars in CPU' }))
    expect(screen.queryByLabelText('Per-core utilisation')).toBeNull()
    expect(container.querySelector('[data-card="cpu"] [data-part="chart"]')).toBeTruthy()
    expect(container.querySelector('[data-card="memory"] [data-part="breakdown"]')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core bars in CPU' }))
    expect(screen.getByLabelText('Per-core utilisation')).toBeTruthy()
  })

  it('can be shown, hidden and moved from the card view', async () => {
    const { container } = render(<Harness />)
    await select('GPU & power')
    await userEvent.click(screen.getByRole('button', { name: 'Move GPU & power earlier' }))
    expect(order(dash(container)).slice(0, 2)).toEqual(['gpu', 'cpu'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show GPU & power' }))
    expect(order(dash(container))).not.toContain('gpu')
  })
})

describe('the panel itself', () => {
  it('closes on Escape and with the close button, and takes focus when it opens', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Customise' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Close customise panel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('warns when the layout cannot be saved', () => {
    render(<Harness saved={false} />)
    expect(screen.getByRole('alert').textContent).toMatch(/would not let minidash save/)
  })
})
