import { useEffect, useState } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { pushHistory } from './history'
import { SnapshotStream, type StreamStatus } from './stream'

/** Subscribes to the agent's snapshot feed (with a 5 minute history); restarts when url or token change. */
export function useSnapshot(url: string, token: string) {
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const [history, setHistory] = useState<Snapshot[]>([])

  useEffect(() => {
    if (!token) return
    const stream = new SnapshotStream({ url, token, onStatus: setStatus, onSnapshot: (s) => setHistory((h) => pushHistory(h, s)) })
    stream.start()
    return () => stream.stop()
  }, [url, token])

  return { status, history }
}
