import { useEffect, useState } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { SnapshotStream, type StreamStatus } from './stream'

/** Subscribes to the agent's snapshot feed; restarts when url or token change. */
export function useSnapshot(url: string, token: string) {
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!token) return
    const stream = new SnapshotStream({ url, token, onStatus: setStatus, onSnapshot: setSnapshot })
    stream.start()
    return () => stream.stop()
  }, [url, token])

  return { status, snapshot }
}
