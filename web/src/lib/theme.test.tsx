// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { applyTheme, readTheme, resolvedTheme, setTheme, THEME_KEY, useResolvedTheme } from './theme'

function mockPrefersDark(dark: boolean) {
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  })) as unknown as typeof window.matchMedia
  return { flip: (v: boolean) => { dark = v; listeners.forEach((l) => l()) } }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  mockPrefersDark(false)
})
afterEach(cleanup)

describe('theme storage', () => {
  it('defaults to system', () => expect(readTheme()).toBe('system'))
  it('ignores junk and survives blocked storage', () => {
    localStorage.setItem(THEME_KEY, 'neon')
    expect(readTheme()).toBe('system')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readTheme()).toBe('system')
    vi.restoreAllMocks()
  })
  it('persists and applies light/dark; system clears both', () => {
    setTheme('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    setTheme('system')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
  it('still applies the theme when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => setTheme('light')).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    vi.restoreAllMocks()
  })
})

// AC-9
describe('resolved theme', () => {
  it('follows the OS under System and the attribute otherwise', () => {
    mockPrefersDark(true)
    expect(resolvedTheme()).toBe('dark')
    applyTheme('light')
    expect(resolvedTheme()).toBe('light')
  })
  it('re-renders subscribers on a manual switch and on an OS change', async () => {
    const os = mockPrefersDark(false)
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')
    await act(async () => setTheme('dark')) // attribute changes are observed on a microtask
    expect(result.current).toBe('dark')
    await act(async () => setTheme('system'))
    expect(result.current).toBe('light')
    await act(async () => os.flip(true))
    expect(result.current).toBe('dark')
  })
})

// AC-9: the saved choice is applied before the app script runs.
describe('no-flash init script', () => {
  const src = readFileSync(join(import.meta.dirname, '../../public/theme-init.js'), 'utf8')
  const run = () => new Function(src)()
  it('applies a saved dark choice', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    run()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
  it('does nothing for system, junk, or blocked storage', () => {
    run()
    localStorage.setItem(THEME_KEY, 'junk')
    run()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(run).not.toThrow()
    vi.restoreAllMocks()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
  it('is a same-origin script in <head>, before the app bundle (the CSP forbids inline scripts)', () => {
    const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')
    const init = html.indexOf('src="/theme-init.js"')
    expect(init).toBeGreaterThan(-1)
    expect(init).toBeLessThan(html.indexOf('src="/src/main.tsx"'))
    expect(html).not.toMatch(/<script>[^<]/) // no inline script bodies
  })
})

describe('ThemeSwitch', () => {
  it('offers System, Light and Dark, and applies the choice', async () => {
    render(<ThemeSwitch />)
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true')
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })
  it('starts from the saved choice', () => {
    localStorage.setItem(THEME_KEY, 'light')
    render(<ThemeSwitch />)
    expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
  })
})
