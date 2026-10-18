// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARDS, type CardId } from '../layout/catalogue'
import { defaultLayout, layoutReducer } from '../layout/model'
import { fixture } from '../test/fixture'
import { SettingsPanel } from './SettingsPanel'
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
      <SettingsPanel layout={layout} dispatch={dispatch} onClose={onClose} selectedId={selected} onSelect={setSelected} saved={saved} range={300} agentWindow={2419200} onRangeChange={() => {}} token="t" agentHttp="http://x" />
      <output data-testid="layout-json">{JSON.stringify(layout)}</output>
    </>
  )
}
const panel = () => within(screen.getByRole('dialog', { name: 'Settings' }))
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
    named(screen.getByRole('dialog', { name: 'Settings' }), 30) // overview: rows, checkboxes, file controls
    await select('CPU')
    named(screen.getByRole('dialog', { name: 'Settings' }), 8) // card view: width, details, show, move
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
    const panel = within(screen.getByRole('dialog', { name: 'Settings' }))
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

  it('does nothing when Settings is closed', async () => {
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
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core reactor in CPU' }))
    expect(screen.queryByLabelText('Per-core utilisation')).toBeNull()
    expect(container.querySelector('[data-card="cpu"] [data-part="chart"]')).toBeTruthy()
    expect(container.querySelector('[data-card="memory"] [data-part="breakdown"]')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Per-core reactor in CPU' }))
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
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Settings' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Close settings panel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('warns when the layout cannot be saved', () => {
    render(<Harness saved={false} />)
    expect(screen.getByRole('alert').textContent).toMatch(/would not let minidash save/)
  })
})

describe('retention', () => {
  /** Panel alone, with a caller-supplied range and agent window. */
  const bare = (range: number, agentWindow: number, onRangeChange: (s: number) => void = () => {}) =>
    render(
      <SettingsPanel
        layout={defaultLayout()}
        dispatch={() => {}}
        onClose={() => {}}
        selectedId={null}
        onSelect={() => {}}
        saved
        range={range}
        agentWindow={agentWindow}
        onRangeChange={onRangeChange}
        token="t"
        agentHttp="http://x"
      />
    )

  it('offers a range picker clamped to the agent window', () => {
    bare(300, 2419200)
    const range = screen.getByRole('combobox', { name: 'Chart time range' })
    const opts = [...range.querySelectorAll('option')].map((o) => o.textContent)
    expect(opts).toContain('5 min')
    expect(opts).toContain('28 days')
  })

  it('hides ranges the agent does not keep', () => {
    bare(300, 3600)
    const range = screen.getByRole('combobox', { name: 'Chart time range' })
    const opts = [...range.querySelectorAll('option')].map((o) => o.textContent)
    expect(opts).toContain('1 h')
    expect(opts).not.toContain('7 days')
  })

  it('changes the range when the picker is used', async () => {
    let range = 300
    bare(300, 2419200, (s) => {
      range = s
    })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chart time range' }), '3600')
    expect(range).toBe(3600)
  })

  it('shows stored data when View stored data is clicked', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        points: [
          { ts: '2026-10-18T05:00:00.000Z', collectors: { cpu: { ok: true, data: { total: 12.5, cores: [1, 2], load: { one: 1, five: 2, fifteen: 3 } } } } },
        ],
      }),
    } as Response)
    bare(3600, 2419200)
    await userEvent.click(screen.getByRole('button', { name: 'View stored data' }))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText(/stored points for this range/)).toBeTruthy()
    fetch.mockRestore()
  })

  it('reports a failure to load stored data', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
    bare(3600, 2419200)
    await userEvent.click(screen.getByRole('button', { name: 'View stored data' }))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.getByRole('alert').textContent).toMatch(/Could not load stored history/)
    fetch.mockRestore()
  })
})
