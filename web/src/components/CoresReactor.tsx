import { useId, useMemo } from 'react'
import { honeycomb } from '../lib/honeycomb'
import { CELL, clampPct, FILL_OPACITY, hexPoints, TIER_COLOR, tierOf } from '../lib/reactor'

/**
 * Per-core utilisation as a honeycomb of hexagons, like a reactor core. Each cell's fill rises from its base
 * with the load and shifts colour with it, and prints the rounded percentage. It scales to whatever space its
 * parent gives it (the parent must have a height).
 */
export function CoresReactor({ cores }: { cores: number[] }) {
  const uid = useId()
  const layout = useMemo(() => honeycomb(cores.length), [cores.length])
  if (layout.cells.length === 0) return null

  const desc = cores.map((v, i) => `Core ${i}: ${Math.round(clampPct(v))}%`).join(', ')

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Per-core utilisation"
      className="absolute inset-0 h-full w-full"
    >
      <desc>{desc}</desc>
      {layout.cells.map((cell) => {
        const pct = clampPct(cores[cell.index])
        const tier = tierOf(pct)
        const color = TIER_COLOR[tier]
        const clip = `${uid}-clip-${cell.index}`
        const outline = hexPoints(cell.cx, cell.cy, CELL)
        return (
          <g key={cell.index} data-core={cell.index} data-tier={tier}>
            <title>{`Core ${cell.index}: ${Math.round(pct)}%`}</title>
            <defs>
              <clipPath id={clip}>
                <polygon points={outline} />
              </clipPath>
            </defs>
            {/* the empty cell */}
            <polygon points={outline} fill="var(--bg)" stroke="var(--line)" strokeWidth={0.05} />
            {/* the level: a rect as tall as the cell, scaled from its base, clipped to the hexagon */}
            <rect
              data-level
              x={cell.cx - 1}
              y={cell.cy - CELL}
              width={2}
              height={CELL * 2}
              fill={color}
              fillOpacity={FILL_OPACITY}
              clipPath={`url(#${clip})`}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 100%',
                transform: `scaleY(${pct / 100})`,
                transition: 'transform 700ms ease',
              }}
            />
            {/* the edge brightens with load */}
            <polygon points={outline} fill="none" stroke={color} strokeWidth={0.07} strokeOpacity={0.25 + 0.75 * (pct / 100)} />
            <text x={cell.cx} y={cell.cy + 0.2} textAnchor="middle" fontSize={0.62} fontWeight={650} fill="var(--fg)" className="tabular-nums">
              {Math.round(pct)}
            </text>
            <text x={cell.cx} y={cell.cy - 0.5} textAnchor="middle" fontSize={0.3} fill="var(--fg)" className="hidden @xs:inline">
              {cell.index}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
