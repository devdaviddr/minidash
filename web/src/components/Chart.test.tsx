// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Chart } from './Chart'

const made: { height: number; target: HTMLElement }[] = []
vi.mock('uplot', () => ({
  default: class {
    constructor(opts: { height: number }, _data: unknown, target: HTMLElement) {
      made.push({ height: opts.height, target })
    }
    setSize() {}
    setData() {}
    destroy() {}
  },
}))
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
vi.mock('../lib/theme', () => ({ useResolvedTheme: () => 'dark' }))

afterEach(() => {
  cleanup()
  made.length = 0
})

const data = [[1, 2], [3, 4]]
const series = [{ label: 'CPU', color: '--accent' }]

describe('Chart', () => {
  it('draws at the fixed height by default, straight into its host', () => {
    const { container } = render(<Chart data={data} series={series} />)
    expect(made[0].height).toBe(120)
    expect(made[0].target).toBe(container.firstElementChild)
  })

  it('with fill, grows with its parent: a flex-1 host whose height comes from the layout, the plot absolutely inside', () => {
    const { container } = render(<Chart data={data} series={series} fill />)
    const host = container.firstElementChild as HTMLElement
    expect(host.className.split(' ')).toEqual(expect.arrayContaining(['relative', 'flex-1']))
    expect(host.style.minHeight).toBe('120px')
    expect(made[0].target).toBe(host.firstElementChild)
    expect((host.firstElementChild as HTMLElement).className).toBe('absolute inset-0') // the canvas cannot push the host taller
    expect(made[0].height).toBe(120) // jsdom has no layout, so the floor applies
  })
})
