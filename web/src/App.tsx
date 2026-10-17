import { useState } from 'react'
import { useSnapshot } from './lib/useSnapshot'
import type { StreamStatus } from './lib/stream'
import { CpuCard } from './components/CpuCard'
import { ContainersCard } from './components/ContainersCard'
import { DisksCard } from './components/DisksCard'
import { GpuCard } from './components/GpuCard'
import { MemoryCard } from './components/MemoryCard'
import { NetworkCard } from './components/NetworkCard'
import { ProcessesCard } from './components/ProcessesCard'
import { Summary } from './components/Summary'
import { TokenForm } from './components/TokenForm'
import { SharesCard } from './components/SharesCard'

const TOKEN_KEY = 'minidash.token'
const wallFromUrl = () => new URLSearchParams(location.search).has('wall')
const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? `ws://${location.hostname}:8787/ws`

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

const STATUS_STYLE: Record<StreamStatus, string> = {
  live: 'bg-emerald-500/15 text-emerald-300',
  connecting: 'bg-amber-500/15 text-amber-300',
  disconnected: 'bg-red-500/15 text-red-300',
  unauthorized: 'bg-red-500/15 text-red-300',
}

export default function App() {
  const [token, setToken] = useState(loadToken)
  const { status, history } = useSnapshot(AGENT_URL, token)
  const snapshot = history.at(-1)
  const [wall, setWall] = useState(wallFromUrl)
  const effective = token ? status : 'unauthorized'

  const save = (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* storage unavailable: token lives for this session only */
    }
    setToken(t)
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">minidash</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWall((w) => !w)}
            aria-pressed={wall}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:text-fg"
          >
            Wall display
          </button>
          <span role="status" className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[effective]}`}>
            {token ? status : 'token required'}
            {snapshot && status === 'live' ? ` · tick ${snapshot.seq}` : ''}
          </span>
        </div>
      </header>
      {effective === 'unauthorized' ? (
        <div className="mx-auto grid max-w-7xl place-items-center py-24">
          <TokenForm onSave={save} />
        </div>
      ) : (
        <main className={`mx-auto flex max-w-7xl flex-col gap-4 ${wall ? 'text-[1.15em]' : ''}`}>
          <Summary snapshot={snapshot} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <CpuCard history={history} />
            <GpuCard history={history} />
            <MemoryCard history={history} />
            <NetworkCard history={history} />
            <DisksCard history={history} />
            {!wall && <SharesCard history={history} />}
            <ContainersCard history={history} />
            {!wall && <ProcessesCard history={history} />}
          </div>
        </main>
      )}
    </div>
  )
}
