import { useState } from 'react'

/** Asks for the agent's access token. Uses theme tokens so it is readable in light and dark. */
export function TokenForm({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="flex w-full max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const t = value.trim()
        if (t) onSave(t)
      }}
    >
      <input
        type="password"
        autoFocus
        autoComplete="off"
        aria-label="Access token"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Access token"
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-fg placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 outline-none"
      >
        Connect
      </button>
    </form>
  )
}
