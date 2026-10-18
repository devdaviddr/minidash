// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPANS } from '../layout/catalogue'
import { SPAN_CLASS } from '../layout/spans'
import { fixture } from '../test/fixture'
import { Card } from './Card'
import { ProcessesCard } from './ProcessesCard'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))
afterEach(cleanup)

const dir = import.meta.dirname
const src = (f: string) => readFileSync(join(dir, f), 'utf8')
const cardFiles = readdirSync(dir).filter((f) => /Card\.tsx$/.test(f) && f !== 'Card.tsx')

// Viewport variants (sm: md: lg: ...) but not container variants (@sm: @md: ...).
const VIEWPORT_VARIANT = /(?<![@\w-])(sm|md|lg|xl|2xl):/
const CONTAINER_VARIANT = /@(3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl):/

// AC-20: a card responds to the width it has, not to the screen it is on. The same screen hosts a
// 1-column card and a full-width card, so only the card's own width is the right measure.
describe('cards adapt to their own width (FR-20)', () => {
  it('finds the card components', () => expect(cardFiles.length).toBe(8))

  it('Card is a size container', () => {
    const { container } = render(<Card title="X">y</Card>)
    expect(container.querySelector('section')?.className).toContain('@container')
  })

  it.each(cardFiles)('%s uses no viewport breakpoints inside itself', (f) => {
    expect(src(f)).not.toMatch(VIEWPORT_VARIANT)
  })

  it.each(cardFiles)('%s rearranges or simplifies with container variants', (f) => {
    expect(src(f)).toMatch(CONTAINER_VARIANT)
  })

  it('the process table drops its PID and owner columns until the card is wide enough', () => {
    const { container } = render(<ProcessesCard history={[fixture()]} />)
    const pidHeader = [...container.querySelectorAll('th')].find((th) => th.textContent?.includes('PID'))
    expect(pidHeader?.className).toMatch(/hidden.*@md:table-cell/)
    const owner = container.querySelector('th[data-part="user"]')
    expect(owner?.className).toMatch(/hidden.*@xl:table-cell/)
    expect(container.querySelector('td[data-part="user"]')?.className).toMatch(/hidden.*@xl:table-cell/)
  })
})

// AC-21: viewport grid
describe('viewport grid (FR-21)', () => {
  it('is 1 column, then 2 from md, then 4 from lg', () => {
    expect(src('SortableGrid.tsx')).toMatch(/grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4/)
  })
  it('maps widths to column spans per viewport', () => {
    expect(SPAN_CLASS[1]).toBe('') // one cell at every size; at 2 columns that is half the row
    for (const s of SPANS.filter((x) => x > 1)) {
      expect(SPAN_CLASS[s], `width ${s}`).toContain('md:col-span-2') // the full row of the 2-column grid
      expect(SPAN_CLASS[s], `width ${s}`).toContain(`lg:col-span-${s}`) // exactly its width on 4 columns
    }
  })
  it('no grid item spans more than the 2-column grid at md', () => {
    for (const cls of Object.values(SPAN_CLASS)) {
      for (const m of cls.matchAll(/md:col-span-(\d)/g)) expect(Number(m[1])).toBeLessThanOrEqual(2)
    }
  })
})
