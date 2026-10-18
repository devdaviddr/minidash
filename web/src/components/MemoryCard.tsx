import type { Snapshot } from '../contract/snapshot'
import { bytes, pct } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'

const SERIES = [{ label: 'Used', color: '--accent2' }]
const mem = (s: Snapshot) => s.collectors.memory
const usedPct = (s: Snapshot) => {
  const d = mem(s)?.data
  return d && d.total ? (d.used / d.total) * 100 : null
}

export function MemoryCard({ history, hidden = NONE }: CardProps) {
  const r = history.at(-1) && mem(history.at(-1)!)
  const d = r?.ok ? r.data : undefined
  const parts = d
    ? [
        { label: 'Wired', v: d.wired, color: 'bg-accent' },
        { label: 'Active', v: d.active, color: 'bg-accent2' },
        { label: 'Compressed', v: d.compressed, color: 'bg-warn' },
        { label: 'Inactive', v: d.inactive, color: 'bg-line' },
      ]
    : []
  return (
    <Card title="Unified memory">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-1 @sm:flex-row @sm:items-end @sm:justify-between">
            <Stat value={bytes(d.used)} label={`of ${bytes(d.total, 0)} · ${pct((d.used / d.total) * 100)} used`} />
            <Part id="swap" hidden={hidden}>
              <div className="text-right text-xs text-muted">
                swap {bytes(d.swapUsed)} / {bytes(d.swapTotal, 0)}
              </div>
            </Part>
          </div>
          <Part id="chart" hidden={hidden}>
            <Chart data={toSeries(history, usedPct)} series={SERIES} yMax={100} format={pct} />
          </Part>
          <Part id="breakdown" hidden={hidden}>
          <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label="Memory breakdown">
              {parts.map((p) => (
                <div key={p.label} className={p.color} style={{ width: `${(p.v / d.total) * 100}%` }} title={`${p.label} ${bytes(p.v)}`} />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {parts.map((p) => (
                <li key={p.label} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${p.color}`} />
                  {p.label} {bytes(p.v)}
                </li>
              ))}
            </ul>
          </div>
          </Part>
        </div>
      )}
    </Card>
  )
}
