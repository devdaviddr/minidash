import { useState } from 'react'
import { useSnapshot } from './lib/useSnapshot'
import type { StreamStatus } from './lib/stream'
import { CpuCard } from './components/CpuCard'
import { DisksCard } from './components/DisksCard'
import { GpuCard } from './components/GpuCard'
import { MemoryCard } from './components/MemoryCard'
import { NetworkCard } from './components/NetworkCard'
import { ProcessesCard } from './components/ProcessesCard'

const TOKEN_KEY = 'minidash.token'
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

function TokenForm({ onSave }: { onSave: (t: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
      }}
    >
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Access token"
        className="rounded-md bg-neutral-900 px-3 py-2 ring-1 ring-neutral-700 focus:ring-neutral-400 outline-none"
      />
      <button className="rounded-md bg-neutral-100 px-3 py-2 text-neutral-900 font-medium">Connect</button>
    </form>
  )
}

export default function App() {
  const [token, setToken] = useState(loadToken)
  const { status, history } = useSnapshot(AGENT_URL, token)
  const snapshot = history.at(-1)
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
      <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">minidash</h1>
        <span role="status" className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[effective]}`}>
          {token ? status : 'token required'}
          {snapshot && status === 'live' ? ` · tick ${snapshot.seq}` : ''}
        </span>
      </header>
      {effective === 'unauthorized' ? (
        <div className="mx-auto grid max-w-7xl place-items-center py-24">
          <TokenForm onSave={save} />
        </div>
      ) : (
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-4">
          <CpuCard history={history} />
          <GpuCard history={history} />
          <MemoryCard history={history} />
          <DisksCard history={history} />
          <NetworkCard history={history} />
          <ProcessesCard history={history} />
        </main>
      )}
    </div>
  )
}
