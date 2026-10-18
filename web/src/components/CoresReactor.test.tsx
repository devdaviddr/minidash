// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { honeycomb } from '../lib/honeycomb'
import { CoresReactor } from './CoresReactor'

afterEach(cleanup)

const cells = (c: HTMLElement) => [...c.querySelectorAll('[data-core]')]
const scaleOf = (cell: Element) => Number(/scaleY\(([\d.]+)\)/.exec((cell.querySelector('[data-level]') as SVGElement).style.transform)?.[1])
const text = (cell: Element) => [...cell.querySelectorAll('text')].map((t) => t.textContent)

// AC-25
describe('cells', () => {
  it('draws one cell per core, with its rounded percentage and number', () => {
    const { container } = render(<CoresReactor cores={[3.4, 49.5, 100]} />)
    expect(cells(container)).toHaveLength(3)
    expect(text(cells(container)[0])).toEqual(['3', '0']) // percent, then core number
    expect(text(cells(container)[1])).toEqual(['50', '1']) // 49.5 rounds up
    expect(text(cells(container)[2])).toEqual(['100', '2'])
  })

  it('raises the fill in proportion to the load, clamped to 0 to 100% (NaN counts as 0)', () => {
    const { container } = render(<CoresReactor cores={[0, 42, 100, 150, -5, NaN]} />)
    expect(cells(container).map(scaleOf)).toEqual([0, 0.42, 1, 1, 0, 0])
  })

  it('colours by tier, switching at exactly 60 and 85', () => {
    const { container } = render(<CoresReactor cores={[59.9, 60, 85, 85.1]} />)
    expect(cells(container).map((c) => c.getAttribute('data-tier'))).toEqual(['normal', 'warm', 'warm', 'hot'])
    const fill = (c: Element) => c.querySelector('[data-level]')?.getAttribute('fill')
    expect(cells(container).map(fill)).toEqual(['var(--accent)', 'var(--warn)', 'var(--warn)', 'var(--bad)'])
  })

  it('animates the fill with a short transition only', () => {
    const { container } = render(<CoresReactor cores={[50]} />)
    const style = (container.querySelector('[data-level]') as SVGElement).style
    expect(style.transition).toContain('transform')
    expect(style.transition).toContain('700ms')
  })

  it('shows the core number only from a medium card width (container variant)', () => {
    const { container } = render(<CoresReactor cores={[50]} />)
    const number = container.querySelectorAll('text')[1]
    expect(number.getAttribute('class')).toMatch(/hidden/)
    expect(number.getAttribute('class')).toContain('@xs:inline')
  })

  it('draws nothing for no cores', () => expect(render(<CoresReactor cores={[]} />).container.querySelector('svg')).toBeNull())
})

// AC-27
describe('accessibility', () => {
  it('is an image named "Per-core utilisation" with a description of every core', () => {
    render(<CoresReactor cores={[10, 20.4, 99.6]} />)
    const img = screen.getByRole('img', { name: 'Per-core utilisation' })
    expect(img.querySelector('desc')?.textContent).toBe('Core 0: 10%, Core 1: 20%, Core 2: 100%')
  })
  it('gives every cell a text alternative', () => {
    const { container } = render(<CoresReactor cores={[10, 20]} />)
    expect(cells(container).map((c) => c.querySelector('title')?.textContent)).toEqual(['Core 0: 10%', 'Core 1: 20%'])
  })
  it('uses no keyframe animation', () => {
    const src = readFileSync(join(import.meta.dirname, 'CoresReactor.tsx'), 'utf8')
    expect(src).not.toMatch(/@keyframes|animate-|animation:/)
  })
})

// AC-26 (structure): scales to the container, no clipping ids shared between cells or between instances
describe('layout', () => {
  it('uses the honeycomb size as its viewBox and fills its container', () => {
    const { container } = render(<CoresReactor cores={Array(10).fill(5)} />)
    const svg = container.querySelector('svg') as SVGElement
    const h = honeycomb(10)
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${h.width} ${h.height}`)
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(svg.getAttribute('class')).toContain('absolute inset-0 h-full w-full')
  })
  it('keeps clip ids unique across cells and across several reactors on a page', () => {
    const a = render(<CoresReactor cores={[1, 2, 3]} />)
    const b = render(<CoresReactor cores={[1, 2, 3]} />)
    const ids = [...document.querySelectorAll('clipPath')].map((c) => c.id)
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(6)
    a.unmount()
    b.unmount()
  })
  it('clips every level to its own cell from an untransformed parent, so the fill stays inside the hexagon', () => {
    const { container } = render(<CoresReactor cores={[1, 2]} />)
    const clips = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    const levels = [...container.querySelectorAll('[data-level]')] as SVGElement[]
    // a clip on the scaled rect would be scaled with it and let the fill leak outside the cell
    expect(levels.map((r) => r.getAttribute('clip-path'))).toEqual([null, null])
    const groups = levels.map((r) => r.parentElement as unknown as SVGElement)
    expect(groups.map((g) => g.getAttribute('clip-path'))).toEqual(clips.map((id) => `url(#${id})`))
    expect(groups.map((g) => g.getAttribute('transform') ?? g.style.transform)).toEqual(['', ''])
  })
})
