// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TokenForm } from './TokenForm'

afterEach(cleanup)

describe('TokenForm', () => {
  it('submits the trimmed token', async () => {
    const onSave = vi.fn()
    render(<TokenForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Access token'), '  abc123  {Enter}')
    expect(onSave).toHaveBeenCalledWith('abc123')
  })
  it('ignores an empty submit', async () => {
    const onSave = vi.fn()
    render(<TokenForm onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(onSave).not.toHaveBeenCalled()
  })
  // Regression: hard-coded dark colours made the field black-on-black in the light theme.
  it('is styled with theme tokens, never fixed palette colours', () => {
    render(<TokenForm onSave={() => {}} />)
    const cls = screen.getByLabelText('Access token').className + screen.getByRole('button').className
    expect(cls).not.toMatch(/neutral-|zinc-|gray-|slate-|black|bg-white/)
    expect(cls).toMatch(/bg-surface/)
    expect(cls).toMatch(/text-fg/)
  })
})
