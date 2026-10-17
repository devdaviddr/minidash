import type { ReactNode } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { bytes, rate } from '../lib/format'

function Pill({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div data-part={id} className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-tight tracking-tight">{children}</div>
    </div>
  )
}

/** At-a-glance strip: the five numbers you check first. Shows a dash for any collector that is down. */
export function Summary({ snapshot, hidden = new Set<string>() }: { snapshot?: Snapshot; hidden?: ReadonlySet<string> }) {
  const c = snapshot?.collectors
  const cpu = c?.cpu?.ok ? c.cpu.data : undefined
  const mem = c?.memory?.ok ? c.memory.data : undefined
  const soc = c?.soc?.ok ? c.soc.data : undefined
  const net = c?.network?.ok ? c.network.data : undefined
  const pills: Array<[string, string, string]> = [
    ['cpu', 'CPU', cpu ? `${cpu.total.toFixed(0)}%` : '–'],
    ['gpu', 'GPU', soc ? `${soc.gpu.usage.toFixed(0)}%` : '–'],
    ['memory', 'Memory', mem ? bytes(mem.used) : '–'],
    ['network', 'Network', net ? `↓ ${rate(net.total.rxBps)}` : '–'],
    ['power', 'Power', soc ? `${soc.power.system.toFixed(1)} W` : '–'],
  ]
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3" aria-label="Summary">
      {pills.filter(([id]) => !hidden.has(id)).map(([id, label, value]) => (
        <Pill key={id} id={id} label={label}>
          {value}
        </Pill>
      ))}
    </div>
  )
}
