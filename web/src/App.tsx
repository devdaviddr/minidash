import { useState, useEffect } from 'react'
import { agentUrl, agentHttpBase } from './lib/agentUrl'
import { useSnapshot } from './lib/useSnapshot'
import { clampRange, fetchHistory } from './lib/history'
import type { Snapshot } from './contract/snapshot'
import { SettingsPanel } from './components/SettingsPanel'
import { Header, HeaderButton } from './components/Header'
import { StatusPill } from './components/StatusPill'
import { ThemeSwitch } from './components/ThemeSwitch'
import { Dashboard } from './components/Dashboard'
import { useLayout } from './layout/useLayout'
import type { CardId } from './layout/catalogue'
import { TokenForm } from './components/TokenForm'

const TOKEN_KEY = 'minidash.token'
const wallFromUrl = () => new URLSearchParams(location.search).has('wall')
const AGENT_URL = agentUrl(location, import.meta.env.VITE_AGENT_URL)
const AGENT_HTTP = agentHttpBase(location, import.meta.env.VITE_AGENT_URL)
// The agent's retention window is not yet known to the UI; assume the max until /history reports it.
const DEFAULT_AGENT_WINDOW = 2419200

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function App() {
  const [token, setToken] = useState(loadToken)
  const { status, history } = useSnapshot(AGENT_URL, token)
  const snapshot = history.at(-1)
  const [wall, setWall] = useState(wallFromUrl)
  const { layout, dispatch, saved } = useLayout()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selected, setSelected] = useState<CardId | null>(null) // transient: never saved, never changes the layout
  const [range, setRange] = useState(300) // selected chart range in seconds (FR-38)
  const [historyData, setHistoryData] = useState<Snapshot[]>([])
  const effective = token ? status : 'unauthorized'

  // When the viewer picks a range longer than the live 5-minute buffer, load stored history.
  useEffect(() => {
    if (!token) return
    const window = clampRange(range, DEFAULT_AGENT_WINDOW)
    if (window <= 300) return // live stream covers short ranges; no fetch needed
    fetchHistory(AGENT_HTTP, token, window)
      .then(setHistoryData)
      .catch(() => setHistoryData([]))
  }, [token, range])

  // Charts use stored history for long ranges, otherwise the live stream.
  const chartHistory = range > 300 && historyData.length > 0 ? historyData : history

  const closeSettings = () => {
    setSettingsOpen(false)
    setSelected(null)
    document.getElementById('settings-button')?.focus() // return focus to where the viewer came from
  }

  const save = (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* storage unavailable: token lives for this session only */
    }
    setToken(t)
  }

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${settingsOpen ? 'lg:pr-[25rem]' : ''}`}>
      <Header>
        <ThemeSwitch />
        <HeaderButton id="settings-button" pressed={settingsOpen} onClick={() => (settingsOpen ? closeSettings() : setSettingsOpen(true))}>
          Settings
        </HeaderButton>
        <HeaderButton pressed={wall} onClick={() => setWall((w) => !w)}>
          Wall display
        </HeaderButton>
        <StatusPill status={status} hasToken={!!token} tick={snapshot?.seq} />
      </Header>
      {effective === 'unauthorized' ? (
        <div className="mx-auto grid max-w-7xl place-items-center py-24">
          <TokenForm onSave={save} />
        </div>
      ) : (
        <Dashboard history={chartHistory} layout={layout} wall={wall} editing={settingsOpen} selectedId={selected} onSelect={setSelected} dispatch={dispatch} />
      )}
      {settingsOpen && effective !== 'unauthorized' && (
        <SettingsPanel
          layout={layout}
          dispatch={dispatch}
          saved={saved}
          selectedId={selected}
          onSelect={setSelected}
          onClose={closeSettings}
          range={range}
          agentWindow={DEFAULT_AGENT_WINDOW}
          onRangeChange={setRange}
          token={token}
          agentHttp={AGENT_HTTP}
        />
      )}
    </div>
  )
}
