import { useState } from 'react'
import { useSnapshot } from './lib/useSnapshot'
import { CustomisePanel } from './components/CustomisePanel'
import { Header, HeaderButton } from './components/Header'
import { StatusPill } from './components/StatusPill'
import { ThemeSwitch } from './components/ThemeSwitch'
import { Dashboard } from './components/Dashboard'
import { useLayout } from './layout/useLayout'
import { TokenForm } from './components/TokenForm'

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

export default function App() {
  const [token, setToken] = useState(loadToken)
  const { status, history } = useSnapshot(AGENT_URL, token)
  const snapshot = history.at(-1)
  const [wall, setWall] = useState(wallFromUrl)
  const { layout, dispatch, saved } = useLayout()
  const [customising, setCustomising] = useState(false)
  const effective = token ? status : 'unauthorized'

  const closeCustomise = () => {
    setCustomising(false)
    document.getElementById('customise-button')?.focus() // return focus to where the viewer came from
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
    <div className={`min-h-screen p-4 sm:p-6 ${customising ? 'lg:pr-[25rem]' : ''}`}>
      <Header>
        <ThemeSwitch />
        <HeaderButton id="customise-button" pressed={customising} onClick={() => setCustomising((c) => !c)}>
          Customise
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
        <Dashboard history={history} layout={layout} wall={wall} editing={customising} dispatch={dispatch} />
      )}
      {customising && effective !== 'unauthorized' && <CustomisePanel layout={layout} dispatch={dispatch} saved={saved} onClose={closeCustomise} />}
    </div>
  )
}
