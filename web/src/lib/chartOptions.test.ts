import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AXIS_FONT, AXIS_FONT_PX, CHART_PADDING } from './chartOptions'

describe('chart padding', () => {
  it('leaves room for half a label above the top gridline and below the bottom one', () => {
    const [top, , bottom] = CHART_PADDING
    expect(top).toBeGreaterThanOrEqual(AXIS_FONT_PX / 2)
    expect(bottom).toBeGreaterThanOrEqual(AXIS_FONT_PX / 2) // the 0% label was cut in half here
  })
  it('grows with the font, so a bigger label cannot reintroduce the clipping', () => {
    expect(CHART_PADDING[2]).toBe(Math.ceil(AXIS_FONT_PX / 2) + 3)
  })
  it('uses the same font size it was computed for', () => expect(AXIS_FONT).toContain(`${AXIS_FONT_PX}px`))
})

// The chart must actually use them (uPlot needs a real canvas, so check the wiring in the source).
describe('Chart wiring', () => {
  const src = readFileSync(join(import.meta.dirname, '../components/Chart.tsx'), 'utf8')
  it('applies the shared padding and font', () => {
    expect(src).toContain('padding: CHART_PADDING')
    expect(src).toContain('font: AXIS_FONT')
  })
  it('no longer hard-codes zero bottom padding', () => expect(src).not.toMatch(/padding:\s*\[\s*\d+,\s*0,\s*0,\s*0\s*\]/))
})
