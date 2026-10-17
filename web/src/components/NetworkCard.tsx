import type { Snapshot } from '../contract/snapshot'
import { bytes, rate } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'

const SERIES = [
  { label: 'Down', color: '--ok' },
  { label: 'Up', color: '--accent' },
]
const net = (s: Snapshot) => s.collectors.network?.data

export function NetworkCard({ history, hidden = NONE }: CardProps) {
  const r = history.at(-1)?.collectors.network
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="Network">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat value={rate(d.total.rxBps)} label="↓ download" />
            <Stat value={rate(d.total.txBps)} label="↑ upload" />
          </div>
          <Part id="chart" hidden={hidden}>
            <Chart data={toSeries(history, (s) => net(s)?.total.rxBps ?? null, (s) => net(s)?.total.txBps ?? null)} series={SERIES} format={rate} height={100} />
          </Part>
          <Part id="interfaces" hidden={hidden}>
          <ul className="flex flex-col gap-2">
            {d.interfaces.map((i) => (
              <li key={i.name} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className="font-medium">
                  {i.name} <span className="text-xs font-normal text-muted">{i.ipv4.join(', ')}</span>
                </span>
                <span className="text-xs text-muted">
                  ↓ {rate(i.rxBps)} · ↑ {rate(i.txBps)}
                  <span className="hidden @xl:inline"> · {bytes(i.rxBytes)} in / {bytes(i.txBytes)} out</span>
                </span>
              </li>
            ))}
            {d.interfaces.length === 0 && <li className="text-sm text-muted">No active interfaces</li>}
          </ul>
          </Part>
        </div>
      )}
    </Card>
  )
}
