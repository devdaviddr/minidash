import type { Snapshot } from '../contract/snapshot'
import { pct } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'
import { CoresReactor } from './CoresReactor'

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
        <div className="flex flex-1 flex-col gap-4">
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
            {/* The reactor scales to this box and takes any height the card has to spare (the card stretches to match a taller neighbour). */}
            <div className="relative min-h-40 flex-1 @xl:min-h-56 @3xl:min-h-72">
              <CoresReactor cores={d.cores} />
            </div>
          </Part>
        </div>
      )}
    </Card>
  )
}
