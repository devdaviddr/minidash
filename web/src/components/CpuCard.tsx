import type { Snapshot } from '../contract/snapshot'
import { pct } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'

const SERIES = [{ label: 'CPU', color: '--accent' }]
const cpu = (s: Snapshot) => s.collectors.cpu

export function CpuCard({ history, hidden = NONE }: CardProps) {
  const latest = history.at(-1)
  const r = latest && cpu(latest)
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="CPU">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <Stat value={d.total.toFixed(0)} unit="%" label={`${d.cores.length} cores`} />
            <Part id="load" hidden={hidden}>
              <div className="text-right text-xs text-muted">
                load {d.load.one.toFixed(2)} · {d.load.five.toFixed(2)} · {d.load.fifteen.toFixed(2)}
              </div>
            </Part>
          </div>
          <Part id="chart" hidden={hidden}>
            <Chart data={toSeries(history, (s) => cpu(s)?.data?.total ?? null)} series={SERIES} yMax={100} format={pct} />
          </Part>
          <Part id="cores" hidden={hidden}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2" aria-label="Per-core utilisation">
            {d.cores.map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-1" title={`Core ${i}: ${v.toFixed(0)}%`}>
                <div className="relative h-10 w-full overflow-hidden rounded-md bg-line @xl:h-14">
                  <div
                    className="absolute inset-x-0 bottom-0 bg-accent transition-[height] duration-700"
                    style={{ height: `${Math.min(v, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{i}</span>
              </div>
            ))}
          </div>
          </Part>
        </div>
      )}
    </Card>
  )
}
