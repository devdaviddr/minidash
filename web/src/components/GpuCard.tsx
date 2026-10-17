import type { Snapshot } from '../contract/snapshot'
import { pct } from '../lib/format'
import { toSeries } from '../lib/history'
import { Card, Stat, Unavailable } from './Card'
import { Chart } from './Chart'
import { NONE, Part, type CardProps } from '../layout/parts'

const SERIES = [{ label: 'GPU', color: '--ok' }]
const soc = (s: Snapshot) => s.collectors.soc

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

export function GpuCard({ history, hidden = NONE }: CardProps) {
  const r = history.at(-1) && soc(history.at(-1)!)
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="GPU & power">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <Stat value={d.gpu.usage.toFixed(0)} unit="%" label={`${d.gpu.freqMhz.toFixed(0)} MHz`} />
            <Stat value={d.power.system.toFixed(1)} unit="W" label="system power" />
          </div>
          <Part id="chart" hidden={hidden}>
            <Chart data={toSeries(history, (s) => soc(s)?.data?.gpu.usage ?? null)} series={SERIES} yMax={100} format={pct} />
          </Part>
          <div className="grid grid-cols-1 gap-2 @2xs:grid-cols-2 @3xl:grid-cols-4">
            <Part id="clusters" hidden={hidden}>
              {d.clusters.map((c) => (
                <Metric key={c.label} label={`${c.label} cluster`} value={`${c.usage.toFixed(0)}% · ${c.freqMhz.toFixed(0)} MHz`} />
              ))}
            </Part>
            <Part id="temps" hidden={hidden}>
              <Metric label="CPU temp" value={`${d.tempC.cpu.toFixed(0)} °C`} />
              <Metric label="GPU temp" value={`${d.tempC.gpu.toFixed(0)} °C`} />
            </Part>
            <Metric label="CPU / GPU / ANE" value={`${d.power.cpu.toFixed(1)} / ${d.power.gpu.toFixed(1)} / ${d.power.ane.toFixed(1)} W`} />
            <Part id="fans" hidden={hidden}>
              {d.fans.map((f) => (
                <Metric key={f.name} label={f.name} value={`${f.rpm.toFixed(0)} rpm`} />
              ))}
            </Part>
          </div>
        </div>
      )}
    </Card>
  )
}
