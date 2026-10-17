import { useMemo, useState } from 'react'
import type { Snapshot } from '../contract/snapshot'
import { bytes } from '../lib/format'
import { Card, Unavailable } from './Card'

type Key = 'cpu' | 'rss' | 'name' | 'pid'
const SHOWN = 15

const COLUMNS: Array<{ key: Key; label: string; align: string }> = [
  { key: 'name', label: 'Process', align: 'text-left' },
  { key: 'pid', label: 'PID', align: 'text-right' },
  { key: 'cpu', label: 'CPU', align: 'text-right' },
  { key: 'rss', label: 'Memory', align: 'text-right' },
]

export function ProcessesCard({ history }: { history: Snapshot[] }) {
  const [sort, setSort] = useState<Key>('cpu')
  const r = history.at(-1)?.collectors.processes
  const d = r?.ok ? r.data : undefined
  const rows = useMemo(() => {
    if (!d) return []
    const list = [...d.list]
    list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort] - a[sort]))
    if (sort === 'pid') list.reverse()
    return list.slice(0, SHOWN)
  }, [d, sort])

  return (
    <Card title="Processes" right={d && <span className="text-xs text-muted">{d.total} running</span>} className="col-span-full">
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`pb-2 font-medium ${c.align}`} aria-sort={sort === c.key ? 'descending' : 'none'}>
                    <button className={`hover:text-fg ${sort === c.key ? 'text-fg' : ''}`} onClick={() => setSort(c.key)}>
                      {c.label}
                      {sort === c.key ? ' ↓' : ''}
                    </button>
                  </th>
                ))}
                <th className="pb-2 text-left font-medium">User</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pid} className="border-t border-line">
                  <td className="max-w-64 truncate py-1.5 pr-3" title={p.name}>{p.name}</td>
                  <td className="py-1.5 text-right text-muted">{p.pid}</td>
                  <td className="py-1.5 text-right">{p.cpu.toFixed(1)}%</td>
                  <td className="py-1.5 text-right">{bytes(p.rss)}</td>
                  <td className="py-1.5 pl-3 text-muted">{p.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">GPU use per process is not exposed by macOS without root, so it is not shown.</p>
        </div>
      )}
    </Card>
  )
}
