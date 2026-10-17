// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusPill } from './StatusPill'

afterEach(cleanup)

describe('StatusPill', () => {
  it('spells the state out in words and shows the tick only when live', () => {
    const { rerender } = render(<StatusPill status="live" hasToken tick={42} />)
    expect(screen.getByRole('status').textContent).toContain('live')
    expect(screen.getByRole('status').textContent).toContain('tick 42')
    rerender(<StatusPill status="disconnected" hasToken tick={42} />)
    expect(screen.getByRole('status').textContent).toContain('disconnected')
    expect(screen.getByRole('status').textContent).not.toContain('tick')
  })
  it('asks for a token when there is none, whatever the stream says', () => {
    render(<StatusPill status="connecting" hasToken={false} />)
    expect(screen.getByRole('status').textContent).toContain('token required')
  })
  it('keeps text in the foreground colour for contrast; colour is the dot and tint', () => {
    render(<StatusPill status="live" hasToken />)
    const pill = screen.getByRole('status')
    expect(pill.className).toContain('text-fg')
    expect(pill.querySelector('[aria-hidden="true"]')?.className).toContain('bg-ok')
  })
})
