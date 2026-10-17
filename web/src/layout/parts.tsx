import type { ReactNode } from 'react'
import type { Snapshot } from '../contract/snapshot'

/** Part ids the viewer has hidden for one card. */
export type Hidden = ReadonlySet<string>
export const NONE: Hidden = new Set()

export interface CardProps {
  history: Snapshot[]
  hidden?: Hidden
}

/**
 * A hideable piece of a card. It renders nothing when hidden; otherwise it tags its content with
 * data-part (used by tests to prove the catalogue and the components agree) and uses
 * `display: contents` so it never changes the surrounding flex or grid layout.
 */
export function Part({ id, hidden, children }: { id: string; hidden: Hidden; children: ReactNode }) {
  if (hidden.has(id)) return null
  return (
    <div data-part={id} className="contents">
      {children}
    </div>
  )
}
