import type { ReactNode } from 'react'
import { Logo } from './Logo'

/** Brand on the left; controls and connection status on the right. */
export function Header({ children }: { children: ReactNode }) {
  return (
    <header className="mx-auto mb-5 flex max-w-7xl flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Logo />
        <h1 className="text-lg font-semibold tracking-tight">minidash</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  )
}

/** Quiet pill-shaped header button. */
export function HeaderButton({ id, pressed, onClick, children }: { id?: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`rounded-full border border-line px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
        pressed ? 'bg-surface text-fg' : 'bg-surface text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
