import type { ReactNode } from 'react'
import { bytes } from '../lib/format'
import { Card, Unavailable } from './Card'
import { NONE, Part, type CardProps } from '../layout/parts'

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="flex flex-col gap-2">{children}</ul>}
    </div>
  )
}

export function SharesCard({ history, hidden = NONE }: CardProps) {
  const r = history.at(-1)?.collectors.shares
  const d = r?.ok ? r.data : undefined
  return (
    <Card title="Shares & accounts">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="flex flex-col gap-5">
          <Part id="mounts" hidden={hidden}>
          <Section title="Mounted on this Mac" empty="No network shares mounted">
            {d.mounts.map((m) => (
              <li key={m.mount} className="rounded-lg bg-bg px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium" title={m.mount}>
                    <span className="mr-2 rounded bg-line px-1.5 py-0.5 text-[10px] uppercase text-muted">{m.protocol}</span>
                    {m.share}
                  </span>
                  <span className={`flex items-center gap-1.5 text-xs ${m.reachable ? 'text-muted' : 'text-bad'}`}>
                    <span className={`size-2 rounded-full ${m.reachable ? 'bg-ok' : 'bg-bad'}`} />
                    {m.reachable ? `${bytes(m.used)} / ${bytes(m.total, 0)}` : 'unreachable'}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">
                  {m.server} → {m.mount}
                  {m.account && <> · account {m.account}</>}
                  {m.mountedBy && <> · mounted by {m.mountedBy}</>}
                </div>
              </li>
            ))}
          </Section>
          </Part>
          <Part id="offered" hidden={hidden}>
          <Section title="Shared by this Mac" empty="Nothing shared">
            {d.sharing.map((s) => (
              <li key={s.name} className="flex justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs uppercase text-muted">{s.protocols.join(', ')}</span>
              </li>
            ))}
          </Section>
          </Part>
          <Part id="clients" hidden={hidden}>
          <Section title="Connected clients" empty="No clients connected">
            {d.sessions.map((s, i) => (
              <li key={`${s.remote}-${i}`} className="flex justify-between text-sm">
                <span className="font-medium">{s.account || 'unknown account'}</span>
                <span className="text-xs text-muted">
                  {s.protocol.toUpperCase()} · {s.remote}
                </span>
              </li>
            ))}
          </Section>
          </Part>
        </div>
      )}
    </Card>
  )
}
