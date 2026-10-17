/** The minidash mark: a gradient tile with a pulse line. Same artwork as docs/images/banner.svg. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 76 76" role="img" aria-label="minidash" className="shrink-0">
      <defs>
        <linearGradient id="minidash-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--accent2)' }} />
        </linearGradient>
      </defs>
      <rect width="76" height="76" rx="20" fill="url(#minidash-mark)" />
      <polyline
        points="14,52 30,52 38,26 50,62 60,36 68,36"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
