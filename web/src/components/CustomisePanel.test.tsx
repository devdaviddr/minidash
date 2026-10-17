// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARDS } from '../layout/catalogue'
import { defaultLayout, layoutReducer } from '../layout/model'
import { fixture } from '../test/fixture'
import { CustomisePanel } from './CustomisePanel'
import { Dashboard } from './Dashboard'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(cleanup)

const history = [fixture()]
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-card]')].map((e) => e.getAttribute('data-card'))

/** The panel and the dashboard share one reducer, as in the app, so we can watch the page change. */
function Harness({ onClose = () => {}, saved = true }: { onClose?: () => void; saved?: boolean }) {
  const [layout, dispatch] = useReducer(layoutReducer, defaultLayout())
  return (
    <>
      <Dashboard history={history} layout={layout} wall={false} dispatch={dispatch} />
      <CustomisePanel layout={layout} dispatch={dispatch} onClose={onClose} saved={saved} />
    </>
  )
}
const dash = (c: HTMLElement) => c.querySelector('main') as HTMLElement

describe('CustomisePanel', () => {
  it('lists every card in order, with a visible checkbox, move buttons and a width control', () => {
    render(<Harness />)
    for (const c of CARDS) {
      expect(screen.getByRole('checkbox', { name: `Show ${c.title}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Move ${c.title} earlier` })).toBeTruthy()
      expect(screen.getByRole('radiogroup', { name: `${c.title} width` })).toBeTruthy()
    }
    expect(screen.getByRole('checkbox', { name: 'Show Summary strip' })).toBeTruthy()
  })

  // Accessibility NFR: every control has a name a screen reader can announce.
  it('gives every control an accessible name', () => {
    render(<Harness />)
    const panel = screen.getByRole('dialog', { name: 'Customise' })
    const controls = [...panel.querySelectorAll('button, input, [role="radio"]')]
    expect(controls.length).toBeGreaterThan(40)
    for (const el of controls) {
      const name = el.getAttribute('aria-label') || el.textContent?.trim() || (el.closest('label')?.textContent ?? '').trim()
      expect(name, el.outerHTML.slice(0, 80)).toBeTruthy()
    }
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

  // AC-12 (keyboard half)
  it('moves a card earlier and later with buttons, and disables them at the ends', async () => {
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

  // AC-13
  it('sets a card to 1, 2, 3 or full width', async () => {
    const { container } = render(<Harness />)
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
  it('hides and restores a part inside one card only', async () => {
    const { container } = render(<Harness />)
    expect(screen.getByLabelText('Per-core utilisation')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core bars in CPU' }))
    expect(screen.queryByLabelText('Per-core utilisation')).toBeNull()
    expect(container.querySelector('[data-card="cpu"] [data-part="chart"]')).toBeTruthy() // rest of the card is untouched
    expect(container.querySelector('[data-card="memory"] [data-part="breakdown"]')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core bars in CPU' }))
    expect(screen.getByLabelText('Per-core utilisation')).toBeTruthy()
  })

  it('hides a summary pill', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Power in the summary strip' }))
    expect(container.querySelector('main [data-part="power"]')).toBeNull()
    expect(container.querySelector('main [data-part="cpu"]')).toBeTruthy()
  })

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
