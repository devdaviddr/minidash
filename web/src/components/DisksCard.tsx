import type { Snapshot } from '../contract/snapshot'
import { bytes, rate } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Unavailable } from './Card'
import { Chart } from './Chart'

const SERIES = [
  { label: 'Read', color: '--accent' },
  { label: 'Write', color: '--warn' },
]
const disks = (s: Snapshot) => s.collectors.disks?.data
const sum = (s: Snapshot, key: 'readBps' | 'writeBps') => disks(s)?.devices.reduce((a, d) => a + d[key], 0) ?? null

export function DisksCard({ history }: { history: Snapshot[] }) {
  const r = history.at(-1)?.collectors.disks
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="Storage" className="lg:col-span-2">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <Chart data={toSeries(history, (s) => sum(s, 'readBps'), (s) => sum(s, 'writeBps'))} series={SERIES} format={rate} height={100} />
          <ul className="flex flex-col gap-3">
            {d.volumes.map((v) => {
              const io = d.devices.find((x) => x.name === v.device)
              const used = v.total ? (v.used / v.total) * 100 : 0
              return (
                <li key={v.mount}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {v.name}
                      {v.external && <span className="rounded bg-line px-1.5 py-0.5 text-[10px] uppercase text-muted">external</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {bytes(v.used)} / {bytes(v.total, 0)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${v.name} ${used.toFixed(0)}% full`}>
                    <div className={used > 90 ? 'h-full bg-bad' : used > 75 ? 'h-full bg-warn' : 'h-full bg-accent'} style={{ width: `${used}%` }} />
                  </div>
                  {io && (
                    <div className="mt-1 text-xs text-muted">
                      ↓ {rate(io.readBps)} · ↑ {rate(io.writeBps)} <span className="opacity-60">({io.name})</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}
