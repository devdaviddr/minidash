// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProcessesData } from '../contract/snapshot'
import { fixture } from '../test/fixture'
import { ProcessesCard } from './ProcessesCard'

afterEach(cleanup)

const proc = (pid: number, name: string, cpu: number, gpu?: number | null) => ({
  pid, name, user: 'u', cpu, rss: pid * 1024 ** 2, threads: 1, ...(gpu === undefined ? {} : { gpu }),
})

const withData = (data: ProcessesData) => [fixture({ processes: { ok: true, data } })]

// One with a value, a null, a missing field (an older agent) and a 0.
const mixed = withData({
  total: 4,
  list: [proc(1, 'alpha', 80, null), proc(2, 'bravo', 10, 42.25), proc(3, 'charlie', 5), proc(4, 'delta', 1, 0)],
})

const gpuCells = (c: HTMLElement) => [...c.querySelectorAll('td[data-part="gpu"]')].map((td) => td.textContent)
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)

describe('GPU column (FR-32)', () => {
  it('renders x.x% and "–" for null and missing values (AC-32)', () => {
    const { container } = render(<ProcessesCard history={mixed} />)
    expect(gpuCells(container)).toEqual(['–', '42.3%', '–', '0.0%'])
  })

  it('sorts highest first with nulls and missing values last, and marks the column (AC-32)', async () => {
    render(<ProcessesCard history={mixed} />)
    await userEvent.click(screen.getByRole('button', { name: /GPU/ }))
    expect(names().slice(0, 2)).toEqual(['bravo', 'delta'])
    expect(names().slice(2).sort()).toEqual(['alpha', 'charlie'])
    const header = screen.getByRole('button', { name: /GPU/ }).closest('th')
    expect(header?.getAttribute('aria-sort')).toBe('descending')
  })

  it('sits between CPU and Memory and uses the @2xs container variant (AC-32)', () => {
    const { container } = render(<ProcessesCard history={mixed} />)
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent?.replace(' ↓', ''))
    expect(headers.indexOf('GPU')).toBe(headers.indexOf('CPU') + 1)
    expect(headers.indexOf('Memory')).toBe(headers.indexOf('GPU') + 1)
    expect(container.querySelector('th[data-part="gpu"]')?.className).toMatch(/hidden.*@2xs:table-cell/)
    for (const td of container.querySelectorAll('td[data-part="gpu"]')) expect(td.className).toMatch(/hidden.*@2xs:table-cell/)
  })

  it('hiding the GPU column removes it and leaves the other columns (AC-32)', () => {
    const { container } = render(<ProcessesCard history={mixed} hidden={new Set(['gpu'])} />)
    expect(container.querySelector('[data-part="gpu"]')).toBeNull()
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent?.replace(' ↓', ''))
    expect(headers).toEqual(['Process', 'PID', 'CPU', 'Memory', 'User'])
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['alpha', '1', '80.0%', '1.0 MB', 'u'])
  })
})

describe('GPU source failure (FR-31)', () => {
  const failed = withData({ total: 2, list: [proc(1, 'alpha', 80, null), proc(2, 'bravo', 10, null)], gpuError: 'ioreg timed out' })

  it('shows every row with "–" and names the reason (AC-31)', () => {
    const { container } = render(<ProcessesCard history={failed} />)
    expect(names()).toEqual(['alpha', 'bravo'])
    expect(gpuCells(container)).toEqual(['–', '–'])
    expect(screen.getByText('GPU unavailable: ioreg timed out')).toBeTruthy()
  })

  it('hides the reason with the column', () => {
    render(<ProcessesCard history={failed} hidden={new Set(['gpu'])} />)
    expect(screen.queryByText(/GPU unavailable/)).toBeNull()
  })

  it('shows no reason line when the read worked', () => {
    render(<ProcessesCard history={mixed} />)
    expect(screen.queryByText(/GPU unavailable/)).toBeNull()
  })
})

describe('attribution note (FR-33)', () => {
  it('says GPU time goes to the process macOS names and system services can carry it (AC-33)', () => {
    const { container } = render(<ProcessesCard history={mixed} />)
    const note = container.querySelector('[data-part="note"]')?.textContent ?? ''
    expect(note).toMatch(/credited to the process macOS names/)
    expect(note).toMatch(/runningboardd/)
    expect(note).toMatch(/WindowServer/)
    expect(note).not.toMatch(/not shown yet/)
  })
})
