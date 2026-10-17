import type { ReactNode } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { bytes, rate } from '../lib/format'

function Pill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-tight tracking-tight">{children}</div>
    </div>
  )
}

/** At-a-glance strip: the five numbers you check first. Shows a dash for any collector that is down. */
export function Summary({ snapshot }: { snapshot?: Snapshot }) {
  const c = snapshot?.collectors
  const cpu = c?.cpu?.ok ? c.cpu.data : undefined
  const mem = c?.memory?.ok ? c.memory.data : undefined
  const soc = c?.soc?.ok ? c.soc.data : undefined
  const net = c?.network?.ok ? c.network.data : undefined
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Summary">
      <Pill label="CPU">{cpu ? `${cpu.total.toFixed(0)}%` : '–'}</Pill>
      <Pill label="GPU">{soc ? `${soc.gpu.usage.toFixed(0)}%` : '–'}</Pill>
      <Pill label="Memory">{mem ? bytes(mem.used) : '–'}</Pill>
      <Pill label="Network">{net ? `↓ ${rate(net.total.rxBps)}` : '–'}</Pill>
      <Pill label="Power">{soc ? `${soc.power.system.toFixed(1)} W` : '–'}</Pill>
    </div>
  )
}
