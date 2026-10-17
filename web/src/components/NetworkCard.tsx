import type { Snapshot } from '../contract/snapshot'
import { bytes, rate } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'

const SERIES = [
  { label: 'Down', color: '--ok' },
  { label: 'Up', color: '--accent' },
]
const net = (s: Snapshot) => s.collectors.network?.data

export function NetworkCard({ history }: { history: Snapshot[] }) {
  const r = history.at(-1)?.collectors.network
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="Network" className="lg:col-span-2">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-8">
            <Stat value={rate(d.total.rxBps)} label="↓ download" />
            <Stat value={rate(d.total.txBps)} label="↑ upload" />
          </div>
          <Chart data={toSeries(history, (s) => net(s)?.total.rxBps ?? null, (s) => net(s)?.total.txBps ?? null)} series={SERIES} format={rate} height={100} />
          <ul className="flex flex-col gap-2">
            {d.interfaces.map((i) => (
              <li key={i.name} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className="font-medium">
                  {i.name} <span className="text-xs font-normal text-muted">{i.ipv4.join(', ')}</span>
                </span>
                <span className="text-xs text-muted">
                  ↓ {rate(i.rxBps)} · ↑ {rate(i.txBps)} · {bytes(i.rxBytes)} in / {bytes(i.txBytes)} out
                </span>
              </li>
            ))}
            {d.interfaces.length === 0 && <li className="text-sm text-muted">No active interfaces</li>}
          </ul>
        </div>
      )}
    </Card>
  )
}
