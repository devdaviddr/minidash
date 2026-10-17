import { useState } from 'react'
import { readTheme, setTheme, THEMES, type Theme } from '../lib/theme'

const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

/** Segmented System / Light / Dark control. */
export function ThemeSwitch() {
  const [theme, setLocal] = useState<Theme>(readTheme)
  const choose = (t: Theme) => {
    setTheme(t)
    setLocal(t)
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => choose(t)}
          className={`rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
            theme === t ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'
          }`}
        >
          {LABEL[t]}
        </button>
      ))}
    </div>
  )
}
