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
  it('cpu shows total and per-core bars', () => {
    render(<CpuCard history={h} />)
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByLabelText('Per-core utilisation').children.length).toBe(4)
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
