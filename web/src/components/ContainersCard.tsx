import { bytes, rate } from '../lib/format'
import { Card, Unavailable } from './Card'
import { NONE, type CardProps } from '../layout/parts'

const STATUS_DOT: Record<string, string> = {
  running: 'bg-ok',
  'not-running': 'bg-muted/50',
  error: 'bg-bad',
}
const STATUS_LABEL: Record<string, string> = { running: 'running', 'not-running': 'not running', error: 'error' }

export function ContainersCard({ history, hidden = NONE }: CardProps) {
  const r = history.at(-1)?.collectors.containers
  const d = r?.ok ? r.data : undefined
  const total = d?.runtimes.reduce((n, rt) => n + rt.containers.length, 0) ?? 0
  // 'stopped' is a part the viewer can hide: runtimes that are not running (a normal state, not an error).
  const runtimes = d?.runtimes.filter((rt) => !(hidden.has('stopped') && rt.status === 'not-running')) ?? []
  return (
    <Card title="Containers" right={d && <span className="text-xs text-muted">{total} running</span>} >
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {runtimes.map((rt) => (
            <div key={rt.name} data-part={rt.status === 'not-running' ? 'stopped' : undefined} className="rounded-xl bg-bg p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{rt.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className={`size-2 rounded-full ${STATUS_DOT[rt.status]}`} />
                  {STATUS_LABEL[rt.status]}
                </span>
              </div>
              {rt.status === 'error' && <p className="text-xs text-bad">{rt.error}</p>}
              {rt.status === 'running' && rt.containers.length === 0 && <p className="text-xs text-muted">No containers running</p>}
              <ul className="flex flex-col gap-2">
                {rt.containers.map((c) => (
                  <li key={c.id} className="rounded-lg bg-surface px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium" title={c.name}>{c.name}</span>
                      <span className="text-xs text-muted">{c.cpu.toFixed(1)}% cpu</span>
                    </div>
                    <div className="truncate text-xs text-muted" title={c.image}>{c.image}</div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>
                        {bytes(c.memUsed)}
                        {c.memLimit > 0 && ` / ${bytes(c.memLimit, 0)}`}
                      </span>
                      <span>↓ {rate(c.rxBps)} ↑ {rate(c.txBps)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
