import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'minidash.theme'
export const THEMES: Theme[] = ['system', 'light', 'dark']

const isTheme = (v: unknown): v is Theme => v === 'system' || v === 'light' || v === 'dark'

/** The saved choice, or "system" when nothing valid is stored or storage is blocked. */
export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return isTheme(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Sets or clears the data-theme attribute. "system" removes it so CSS follows the OS. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** Persists and applies a choice. Storage failures are ignored: the choice still applies this session. */
export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* storage unavailable */
  }
  applyTheme(theme)
}

/** The theme actually in effect: the attribute if set, otherwise the OS preference. */
export function resolvedTheme(root: HTMLElement = document.documentElement): ResolvedTheme {
  const attr = root.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    mq.removeEventListener('change', cb)
    obs.disconnect()
  }
}

/** Re-renders when the effective theme changes (manual switch or OS change). Used by charts. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, () => resolvedTheme(), () => 'light')
}
