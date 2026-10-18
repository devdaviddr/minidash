// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixture } from '../test/fixture'
import { ContainersCard } from './ContainersCard'
import { CpuCard } from './CpuCard'
import { DisksCard } from './DisksCard'
import { GpuCard } from './GpuCard'
import { MemoryCard } from './MemoryCard'
import { NetworkCard } from './NetworkCard'
import { ProcessesCard } from './ProcessesCard'
import { SharesCard } from './SharesCard'
import { Summary } from './Summary'

// uPlot needs a real canvas; the chart wrapper is covered by the stream/history tests and visual review.
vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(cleanup)

const h = [fixture()]

describe('cards render a healthy snapshot', () => {
  it('cpu shows the total and a hexagon for every core', () => {
    render(<CpuCard history={h} />)
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByLabelText('Per-core utilisation').querySelectorAll('[data-core]').length).toBe(4)
  })
  it('gpu shows usage, power and fans', () => {
    render(<GpuCard history={h} />)
    expect(screen.getByText('900 MHz')).toBeTruthy()
    expect(screen.getByText('1200 rpm')).toBeTruthy()
  })
  it('memory shows used of total', () => {
    render(<MemoryCard history={h} />)
    expect(screen.getByText(/of 16 GB/)).toBeTruthy()
  })
  it('storage flags the external drive and warns when nearly full', () => {
    render(<DisksCard history={h} />)
    expect(screen.getByText('external')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Backup 95% full' })).toBeTruthy()
  })
  it('network lists active interfaces', () => {
    render(<NetworkCard history={h} />)
    expect(screen.getByText('en0')).toBeTruthy()
  })
  it('shares shows mounts, offers and clients', () => {
    render(<SharesCard history={h} />)
    expect(screen.getByText('Media')).toBeTruthy()
    expect(screen.getByText('Public')).toBeTruthy()
    expect(screen.getByText('carol')).toBeTruthy()
  })
})

// AC-28 (FR-28): the CPU card's header, its labels and how the chart and the reactor share the card.
describe('cpu card layout', () => {
  const box = (c: HTMLElement, name: string) => c.querySelector(`[data-cpu-${name}]`) as HTMLElement | null
  const classes = (el: HTMLElement | null) => (el?.className ?? '').split(/\s+/)

  it('shows the core count at the top right of the header and the load average under the total', () => {
    render(<CpuCard history={h} />)
    const header = screen.getByRole('heading', { name: 'CPU' }).parentElement as HTMLElement
    expect(header.tagName).toBe('HEADER')
    expect(header.lastElementChild?.textContent).toBe('4 cores') // the right slot, after the title
    const total = screen.getByText('42').parentElement as HTMLElement
    expect(total.parentElement?.textContent).toContain('load 1.50 · 1.20 · 1.00')
    expect(total.parentElement?.textContent).not.toContain('cores') // no longer the label under the total
  })

  it('keeps the core count in the header when the load average is hidden', () => {
    render(<CpuCard history={h} hidden={new Set(['load'])} />)
    expect(screen.queryByText(/^load /)).toBeNull()
    expect(screen.getByText('4 cores').closest('header')).toBeTruthy()
  })

  it('has no core count without CPU data', () => {
    render(<CpuCard history={[fixture({ cpu: { ok: false, error: 'boom' } })]} />)
    expect(screen.queryByText(/cores/)).toBeNull()
  })

  it('is a column by default and a row from the @md container width, with the reactor stretching to the row', () => {
    const { container } = render(<CpuCard history={h} />)
    const layout = box(container, 'layout')
    expect(classes(layout)).toEqual(expect.arrayContaining(['flex', 'flex-col', '@md:flex-row']))
    expect(classes(layout)).not.toContain('flex-row') // stacked unless the card is wide
    expect(classes(box(container, 'main'))).toEqual(expect.arrayContaining(['min-w-0', '@md:flex-1']))
    expect(classes(box(container, 'reactor'))).toEqual(expect.arrayContaining(['@md:w-2/5', '@md:self-stretch']))
    // chart on the left, reactor on the right
    const [left, right] = [...(layout?.children ?? [])]
    expect(left.querySelector('[data-testid="chart"]')).toBeTruthy()
    expect(right.querySelector('[aria-label="Per-core utilisation"]')).toBeTruthy()
  })

  it('stacked, the reactor takes the spare height (AC-26 as amended)', () => {
    const { container } = render(<CpuCard history={h} />)
    expect(classes(box(container, 'layout'))).toContain('flex-1')
    expect(classes(box(container, 'reactor'))).toEqual(expect.arrayContaining(['flex-1', 'min-h-40']))
    expect(classes(box(container, 'main'))).not.toContain('flex-1') // the left column does not compete for it
  })

  it('without the chart, the reactor is not put beside anything and takes the full width', () => {
    const { container } = render(<CpuCard history={h} hidden={new Set(['chart'])} />)
    expect(screen.getByLabelText('Per-core utilisation')).toBeTruthy()
    expect(box(container, 'layout')?.className).not.toMatch(/flex-row/)
    expect(box(container, 'reactor')?.className).not.toMatch(/w-2\/5/)
  })

  it('without the reactor, the total and the chart take the full width', () => {
    const { container } = render(<CpuCard history={h} hidden={new Set(['cores'])} />)
    expect(box(container, 'reactor')).toBeNull()
    expect(box(container, 'layout')?.children.length).toBe(1)
    expect(classes(box(container, 'main'))).toContain('@md:flex-1')
    expect(box(container, 'main')?.className).not.toMatch(/(^|[\s:])w-/) // no width cap
  })
})

// AC-6 (UI half): a stopped runtime is a calm state, an API failure is an error.
describe('containers card', () => {
  it('shows each runtime with its own state', () => {
    render(<ContainersCard history={h} />)
    expect(screen.getByText('running', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText('not running')).toBeTruthy()
    expect(screen.getByText('HTTP 500')).toBeTruthy()
    expect(screen.getByText('web')).toBeTruthy()
  })
})

// AC-5 (UI half): sorting by memory puts the biggest process first.
describe('processes table', () => {
  const firstRow = () => within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent
  it('sorts by CPU by default and by memory on click', async () => {
    render(<ProcessesCard history={h} />)
    expect(firstRow()).toBe('alpha')
    await userEvent.click(screen.getByRole('button', { name: /Memory/ }))
    expect(firstRow()).toBe('bravo')
  })
})

describe('degradation', () => {
  it('one failed collector does not blank the others', () => {
    const snap = fixture({ memory: { ok: false, error: 'boom' } })
    render(
      <>
        <MemoryCard history={[snap]} />
        <CpuCard history={[snap]} />
      </>,
    )
    expect(screen.getByText('Unavailable: boom')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })
  it('summary shows dashes for down collectors', () => {
    render(<Summary snapshot={fixture({ soc: { ok: false, error: 'x' } })} />)
    expect(screen.getAllByText('–').length).toBe(2) // GPU and Power
  })
  it('cards without data say so', () => {
    render(<CpuCard history={[]} />)
    expect(screen.getByText('No data yet')).toBeTruthy()
  })
})
