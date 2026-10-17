import type { StreamStatus } from '../lib/stream'

const DOT: Record<StreamStatus, string> = {
  live: 'bg-ok',
  connecting: 'bg-warn',
  disconnected: 'bg-bad',
  unauthorized: 'bg-bad',
}
const TINT: Record<StreamStatus, string> = {
  live: 'bg-ok/10',
  connecting: 'bg-warn/10',
  disconnected: 'bg-bad/10',
  unauthorized: 'bg-bad/10',
}

/** Connection state. Text stays in the normal foreground colour so contrast holds in both themes;
 * colour is carried by the dot and the tint, and the state is also spelled out in words. */
export function StatusPill({ status, hasToken, tick }: { status: StreamStatus; hasToken: boolean; tick?: number }) {
  const state: StreamStatus = hasToken ? status : 'unauthorized'
  const label = hasToken ? status : 'token required'
  return (
    <span role="status" className={`inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-fg ${TINT[state]}`}>
      <span className={`size-2 rounded-full ${DOT[state]} ${state === 'live' ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true" />
      {label}
      {tick !== undefined && state === 'live' ? <span className="text-muted">tick {tick}</span> : null}
    </span>
  )
}
