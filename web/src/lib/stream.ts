import type { Snapshot } from '../contract/snapshot'

export type StreamStatus = 'connecting' | 'live' | 'disconnected' | 'unauthorized'

export interface StreamOptions {
  url: string
  token: string
  onStatus: (s: StreamStatus) => void
  onSnapshot: (s: Snapshot) => void
  /** Injectable for tests. */
  WebSocketImpl?: typeof WebSocket
}

const POLICY_VIOLATION = 1008
const MIN_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 10000
/** Spec AC-8: show "disconnected" within 5 s of the feed stopping. */
const MAX_STALL_MS = 4500
const DEFAULT_INTERVAL_MS = 1000

/** Reconnecting snapshot stream: authenticates, detects a stalled feed, retries with backoff. */
export class SnapshotStream {
  private ws?: WebSocket
  private stallTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private backoff = MIN_BACKOFF_MS
  private stopped = false
  private readonly opts: StreamOptions

  constructor(opts: StreamOptions) {
    this.opts = opts
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.stallTimer)
    clearTimeout(this.retryTimer)
    this.ws?.close()
  }

  private connect(): void {
    const Impl = this.opts.WebSocketImpl ?? WebSocket
    this.opts.onStatus('connecting')
    const ws = new Impl(this.opts.url)
    this.ws = ws
    this.armStall(DEFAULT_INTERVAL_MS)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.opts.token }))
    ws.onmessage = (ev) => {
      let snap: Snapshot
      try {
        snap = JSON.parse(String(ev.data)) as Snapshot
      } catch {
        return
      }
      this.backoff = MIN_BACKOFF_MS
      this.opts.onStatus('live')
      this.opts.onSnapshot(snap)
      this.armStall(snap.intervalMs)
    }
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      clearTimeout(this.stallTimer)
      if (ev.code === POLICY_VIOLATION) {
        this.stopped = true
        this.opts.onStatus('unauthorized')
        return
      }
      this.opts.onStatus('disconnected')
      this.scheduleRetry()
    }
    ws.onerror = () => ws.close()
  }

  /** If no snapshot arrives within a few intervals, treat the feed as dead and reconnect. */
  private armStall(intervalMs: number): void {
    clearTimeout(this.stallTimer)
    this.stallTimer = setTimeout(() => {
      this.opts.onStatus('disconnected')
      this.ws?.close()
    }, Math.min(intervalMs * 3, MAX_STALL_MS))
  }

  private scheduleRetry(): void {
    if (this.stopped) return
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => this.connect(), this.backoff)
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
  }
}
