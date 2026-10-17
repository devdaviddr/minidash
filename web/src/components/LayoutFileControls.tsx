import { useRef, useState, type Dispatch } from 'react'
import { parseLayoutFile, serializeLayout, type Layout, type LayoutAction } from '../layout/model'

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
const button = `rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:border-accent ${focusRing}`

export const EXPORT_FILENAME = 'minidash-layout.json'

/** Saves text as a file through a temporary link. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type Message = { kind: 'ok' | 'error'; text: string }

interface Props {
  layout: Layout
  dispatch: Dispatch<LayoutAction>
}

/** Reset, export and import. Import is validated first and never changes the layout if the file is refused. */
export function LayoutFileControls({ layout, dispatch }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const onImport = async (file: File | undefined) => {
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setMessage({ kind: 'error', text: 'That file could not be read.' })
      return
    }
    const result = parseLayoutFile(text)
    if (!result.ok) {
      setMessage({ kind: 'error', text: `${result.error} Your layout was not changed.` })
      return
    }
    dispatch({ type: 'replace', layout: result.layout })
    setMessage({ kind: 'ok', text: result.notes.length ? `Layout imported. Adjusted: ${result.notes.join('; ')}.` : 'Layout imported.' })
  }

  return (
    <section aria-labelledby="layout-file-heading" className="flex flex-col gap-3">
      <h3 id="layout-file-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Save and share
      </h3>
      <p className="text-xs text-muted">Your layout is saved in this browser. Export it to use the same layout on another device.</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          onClick={() => {
            download(EXPORT_FILENAME, serializeLayout(layout))
            setMessage({ kind: 'ok', text: `Exported ${EXPORT_FILENAME}.` })
          }}
        >
          Export layout
        </button>
        <button type="button" className={button} onClick={() => fileInput.current?.click()}>
          Import layout…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import layout file"
          tabIndex={-1}
          onChange={async (e) => {
            await onImport(e.target.files?.[0])
            e.target.value = '' // so choosing the same file again still fires
          }}
        />
      </div>

      {confirmReset ? (
        <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
          <span className="text-xs">Reset everything to the default layout?</span>
          <button
            type="button"
            className={`${button} border-bad text-bad`}
            onClick={() => {
              dispatch({ type: 'reset' })
              setConfirmReset(false)
              setMessage({ kind: 'ok', text: 'Layout reset to the default.' })
            }}
          >
            Yes, reset
          </button>
          <button type="button" className={button} onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className={button} onClick={() => setConfirmReset(true)}>
            Reset to default
          </button>
        </div>
      )}

      <div aria-live="polite" className="min-h-4">
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${message.kind === 'error' ? 'text-bad' : 'text-muted'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
