// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useReducer } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultLayout, layoutReducer, parseLayoutFile, serializeLayout, type Layout } from '../layout/model'
import { fixture } from '../test/fixture'
import { Dashboard } from './Dashboard'
import { EXPORT_FILENAME, LayoutFileControls } from './LayoutFileControls'

vi.mock('./Chart', () => ({ Chart: () => <div data-testid="chart" /> }))

let exported: { name: string; text: string } | undefined
beforeEach(() => {
  exported = undefined
  let blob: Blob | undefined
  URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:fake'))
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    void blob!.text().then((text) => (exported = { name: this.download, text }))
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const history = [fixture()]
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-card]')].map((e) => e.getAttribute('data-card'))

const customised = (): Layout => {
  let l = layoutReducer(defaultLayout(), { type: 'step', id: 'gpu', delta: -1 })
  l = layoutReducer(l, { type: 'setVisible', id: 'network', visible: false })
  l = layoutReducer(l, { type: 'setSpan', id: 'cpu', span: 4 })
  return layoutReducer(l, { type: 'togglePart', id: 'cpu', part: 'cores' })
}

let current: Layout
function Harness({ start = defaultLayout() }: { start?: Layout }) {
  const [layout, dispatch] = useReducer(layoutReducer, start)
  useEffect(() => {
    current = layout // observed by assertions; set after render, not during it
  })
  return (
    <>
      <Dashboard history={history} layout={layout} wall={false} dispatch={dispatch} />
      <LayoutFileControls layout={layout} dispatch={dispatch} />
    </>
  )
}
const file = (text: string, name = 'layout.json') => new File([text], name, { type: 'application/json' })
// dnd-kit has its own role="status" live region, so scope our message lookups to this section.
const controls = () => within(screen.getByRole('region', { name: 'Save and share' }))
const upload = (f: File) => userEvent.upload(screen.getByLabelText('Import layout file'), f)

// AC-15
describe('export', () => {
  it('downloads the current layout as readable JSON under a fixed name', async () => {
    render(<Harness start={customised()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export layout' }))
    await waitFor(() => expect(exported).toBeTruthy())
    expect(exported!.name).toBe(EXPORT_FILENAME)
    expect(exported!.text).toBe(serializeLayout(customised()))
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})

describe('import', () => {
  it('applies a valid file', async () => {
    const { container } = render(<Harness />)
    await upload(file(serializeLayout(customised())))
    await waitFor(() => expect(current).toEqual(customised()))
    expect(order(container.querySelector('main') as HTMLElement).slice(0, 2)).toEqual(['gpu', 'cpu'])
    expect(order(container)).not.toContain('network')
    expect(controls().getByRole('status').textContent).toContain('Layout imported')
  })

  it('an exported file imports to an identical layout (round trip)', async () => {
    const first = render(<Harness start={customised()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export layout' }))
    await waitFor(() => expect(exported).toBeTruthy())
    const text = exported!.text
    first.unmount()
    render(<Harness />)
    await upload(file(text))
    await waitFor(() => expect(current).toEqual(customised()))
  })

  it('refuses a file that is not a layout, explains why, and changes nothing', async () => {
    render(<Harness start={customised()} />)
    for (const bad of ['not json at all', '{"hello":1}', JSON.stringify({ ...defaultLayout(), version: 3 })]) {
      await upload(file(bad))
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      expect(screen.getByRole('alert').textContent).toContain('Your layout was not changed')
      expect(current).toEqual(customised())
    }
  })

  it('adds a card missing from the file with its defaults, and says so', async () => {
    const l = defaultLayout()
    render(<Harness start={customised()} />)
    await upload(file(JSON.stringify({ ...l, cards: l.cards.filter((c) => c.id !== 'containers') })))
    await waitFor(() => expect(controls().getByRole('status').textContent).toContain('added the new card containers'))
    expect(current.cards.at(-1)).toEqual({ id: 'containers', visible: true, span: 4, hidden: [] })
  })

  it('lets you choose the same file twice', async () => {
    render(<Harness />)
    const f = file(serializeLayout(customised()))
    await upload(f)
    await waitFor(() => expect(current).toEqual(customised()))
    expect((screen.getByLabelText('Import layout file') as HTMLInputElement).value).toBe('')
  })
})

describe('reset', () => {
  it('asks first, then restores the default layout', async () => {
    const { container } = render(<Harness start={customised()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    expect(current).toEqual(customised()) // not yet
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reset' }))
    expect(current).toEqual(defaultLayout())
    expect(order(container.querySelector('main') as HTMLElement)).toContain('network')
  })
  it('cancel keeps the layout', async () => {
    render(<Harness start={customised()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(current).toEqual(customised())
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeTruthy()
  })
})

describe('sanity', () => {
  it('the helper used by the round trip agrees with the model', () => expect(parseLayoutFile(serializeLayout(customised())).ok).toBe(true))
})
