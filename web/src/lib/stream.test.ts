import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SnapshotStream, type StreamStatus } from './stream'

class FakeWS {
  static instances: FakeWS[] = []
  sent: string[] = []
  onopen?: () => void
  onmessage?: (e: { data: string }) => void
  onclose?: (e: { code: number }) => void
  onerror?: () => void
  url: string
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(d: string) {
    this.sent.push(d)
  }
  close(code = 1006) {
    this.onclose?.({ code })
  }
}

const snap = (seq: number) =>
  JSON.stringify({ schema: 1, seq, ts: '2026-01-01T00:00:00Z', intervalMs: 1000, collectors: {} })

function setup() {
  const statuses: StreamStatus[] = []
  const seqs: number[] = []
  const s = new SnapshotStream({
    url: 'ws://x/ws',
    token: 't',
    onStatus: (x) => statuses.push(x),
    onSnapshot: (x) => seqs.push(x.seq),
    WebSocketImpl: FakeWS as unknown as typeof WebSocket,
  })
  s.start()
  return { s, statuses, seqs, ws: () => FakeWS.instances.at(-1)! }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWS.instances = []
})
afterEach(() => vi.useRealTimers())

describe('SnapshotStream (AC-8)', () => {
  it('authenticates on open and goes live on the first snapshot', () => {
    const { ws, statuses, seqs } = setup()
    ws().onopen?.()
    expect(JSON.parse(ws().sent[0])).toEqual({ type: 'auth', token: 't' })
    ws().onmessage?.({ data: snap(1) })
    expect(statuses.at(-1)).toBe('live')
    expect(seqs).toEqual([1])
  })

  it('reports disconnected within 5 s when the feed stalls, then recovers without a reload', () => {
    const { ws, statuses } = setup()
    ws().onmessage?.({ data: snap(1) })
    vi.advanceTimersByTime(4999)
    expect(statuses).toContain('disconnected')
    expect(FakeWS.instances.length).toBe(2) // already retrying on a fresh socket
    ws().onmessage?.({ data: snap(2) })
    expect(statuses.at(-1)).toBe('live')
  })

  it('backs off exponentially up to a cap', () => {
    const { ws } = setup()
    for (const delay of [1000, 2000, 4000, 8000, 10000, 10000]) {
      const before = FakeWS.instances.length
      ws().close()
      vi.advanceTimersByTime(delay - 1)
      expect(FakeWS.instances.length).toBe(before)
      vi.advanceTimersByTime(1)
      expect(FakeWS.instances.length).toBe(before + 1)
    }
  })

  it('stops retrying and reports unauthorized on a policy-violation close', () => {
    const { ws, statuses } = setup()
    ws().close(1008)
    vi.advanceTimersByTime(60000)
    expect(statuses.at(-1)).toBe('unauthorized')
    expect(FakeWS.instances.length).toBe(1)
  })

  it('ignores malformed messages', () => {
    const { ws, seqs } = setup()
    ws().onmessage?.({ data: 'not json' })
    expect(seqs).toEqual([])
  })
})
