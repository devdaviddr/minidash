import type { Snapshot } from '../contract/snapshot'
import { pct } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'
import { CoresReactor } from './CoresReactor'

const SERIES = [{ label: 'CPU', color: '--accent' }]
const cpu = (s: Snapshot) => s.collectors.cpu

/*
 * FR-28: on a wide card (from the @md container width, 28 rem) the total and the chart sit on the left and
 * the reactor on the right, as tall as the row. On a narrow card they stack and the reactor takes the spare
 * height. Without the chart there is nothing to sit beside, so the reactor stays under the total at full width.
 */
const ROW = 'flex flex-1 flex-col gap-4 @md:flex-row'
const STACK = 'flex flex-1 flex-col gap-4'
const REACTOR_BESIDE = 'relative min-h-40 flex-1 @md:w-2/5 @md:flex-none @md:min-h-0 @md:self-stretch'
const REACTOR_BELOW = 'relative min-h-40 flex-1 @xl:min-h-56 @3xl:min-h-72'

export function CpuCard({ history, hidden = NONE }: CardProps) {
  const latest = history.at(-1)
  const r = latest && cpu(latest)
  const d = r?.ok ? r.data : undefined
  const beside = !hidden.has('chart')
  return (
    <Card title="CPU" right={d && <span className="text-xs text-muted">{d.cores.length} cores</span>}>
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div data-cpu-layout className={beside ? ROW : STACK}>
          <div data-cpu-main className="flex min-w-0 flex-col gap-4 @md:flex-1">
            <div>
              <Stat value={d.total.toFixed(0)} unit="%" />
              <Part id="load" hidden={hidden}>
                <div className="mt-1 text-xs text-muted">
                  load {d.load.one.toFixed(2)} · {d.load.five.toFixed(2)} · {d.load.fifteen.toFixed(2)}
                </div>
              </Part>
            </div>
            <Part id="chart" hidden={hidden}>
              <Chart data={toSeries(history, (s) => cpu(s)?.data?.total ?? null)} series={SERIES} yMax={100} format={pct} />
            </Part>
          </div>
          <Part id="cores" hidden={hidden}>
            {/* The reactor scales to this box; the box gets its height from the row or from the card's spare height. */}
            <div data-cpu-reactor className={beside ? REACTOR_BESIDE : REACTOR_BELOW}>
              <CoresReactor cores={d.cores} />
            </div>
          </Part>
        </div>
      )}
    </Card>
  )
}
