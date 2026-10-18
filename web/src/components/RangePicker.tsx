import { RANGE_OPTIONS } from '../lib/history'

interface Props {
  /** Currently selected range in seconds. */
  value: number
  /** The agent's retention window (max selectable). */
  agentWindow: number
  onChange: (seconds: number) => void
}

/** A select of retention ranges, clamped to what the agent actually keeps (FR-38). */
export function RangePicker({ value, agentWindow, onChange }: Props) {
  const options = RANGE_OPTIONS.filter((r) => r.seconds <= agentWindow || agentWindow <= 0)
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Range</span>
      <select
        aria-label="Chart time range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border px-2 py-1"
      >
        {options.map((r) => (
          <option key={r.seconds} value={r.seconds}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  )
}
