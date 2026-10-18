import { useMemo, useState } from 'react'
import { bytes } from '../lib/format'
import { descNullsLast } from '../lib/sort'
import { Card, Unavailable } from './Card'
import { NONE, Part, type CardProps } from '../layout/parts'

type Key = 'cpu' | 'gpu' | 'rss' | 'name' | 'pid'
const SHOWN = 15

/** Shown by the "note" part: how macOS attributes GPU time (FR-33). */
export const GPU_NOTE =
  'GPU time is credited to the process macOS names as the GPU client. System services such as runningboardd and WindowServer can carry GPU time on an app’s behalf.'

const COLUMNS: Array<{ key: Key; label: string; align: string; part?: string }> = [
  { key: 'name', label: 'Process', align: 'text-left' },
  { key: 'pid', label: 'PID', align: 'hidden text-right @md:table-cell' },
  { key: 'cpu', label: 'CPU', align: 'text-right' },
  { key: 'gpu', label: 'GPU', align: 'hidden text-right @2xs:table-cell', part: 'gpu' },
  { key: 'rss', label: 'Memory', align: 'text-right' },
]

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(1)}%`)

export function ProcessesCard({ history, hidden = NONE }: CardProps) {
  const [sort, setSort] = useState<Key>('cpu')
  const r = history.at(-1)?.collectors.processes
  const d = r?.ok ? r.data : undefined
  const showGPU = !hidden.has('gpu')
  const rows = useMemo(() => {
    if (!d) return []
    const list = [...d.list]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'gpu') list.sort((a, b) => descNullsLast(a.gpu, b.gpu))
    else list.sort((a, b) => b[sort] - a[sort])
    if (sort === 'pid') list.reverse()
    return list.slice(0, SHOWN)
  }, [d, sort])
  const columns = COLUMNS.filter((c) => !c.part || !hidden.has(c.part))

  return (
    <Card title="Processes" right={d && <span className="text-xs text-muted">{d.total} running</span>} >
      {!d ? (
        <Unavailable error={r?.error} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                {columns.map((c) => (
                  <th key={c.key} data-part={c.part} className={`pb-2 font-medium ${c.align}`} aria-sort={sort === c.key ? 'descending' : 'none'}>
                    <button className={`hover:text-fg ${sort === c.key ? 'text-fg' : ''}`} onClick={() => setSort(c.key)}>
                      {c.label}
                      {sort === c.key ? ' ↓' : ''}
                    </button>
                  </th>
                ))}
                {!hidden.has('user') && <th data-part="user" className="hidden pb-2 text-left font-medium @xl:table-cell">User</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pid} className="border-t border-line">
                  <td className="max-w-36 truncate py-1.5 pr-3 @md:max-w-64" title={p.name}>{p.name}</td>
                  <td className="hidden py-1.5 text-right text-muted @md:table-cell">{p.pid}</td>
                  <td className="py-1.5 text-right">{p.cpu.toFixed(1)}%</td>
                  {showGPU && <td data-part="gpu" className="hidden py-1.5 text-right @2xs:table-cell">{pct(p.gpu)}</td>}
                  <td className="py-1.5 text-right">{bytes(p.rss)}</td>
                  {!hidden.has('user') && <td data-part="user" className="hidden py-1.5 pl-3 text-muted @xl:table-cell">{p.user}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {showGPU && d.gpuError && (
            <p data-part="gpu" className="mt-2 text-xs text-muted">GPU unavailable: {d.gpuError}</p>
          )}
          <Part id="note" hidden={hidden}>
            <p className="mt-2 text-xs text-muted">{GPU_NOTE}</p>
          </Part>
        </div>
      )}
    </Card>
  )
}
