import type { ReactNode } from 'react'

interface Props {
  title: string
  right?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, right, children, className = '' }: Props) {
  return (
    <section className={`h-full rounded-2xl border border-line bg-surface p-4 shadow-sm ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

export function Unavailable({ error }: { error?: string }) {
  return <p className="text-sm text-muted">{error ? `Unavailable: ${error}` : 'No data yet'}</p>
}

/** Big number with a unit, used at the top of every card. */
export function Stat({ value, unit, label }: { value: string; unit?: string; label?: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold leading-none tracking-tight">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-muted">{unit}</span>}
      </div>
      {label && <div className="mt-1 text-xs text-muted">{label}</div>}
    </div>
  )
}
