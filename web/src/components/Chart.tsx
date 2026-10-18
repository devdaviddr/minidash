import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { AXIS_FONT, CHART_PADDING } from '../lib/chartOptions'
import { useResolvedTheme } from '../lib/theme'

export interface ChartSeries {
  label: string
  /** CSS variable name, e.g. "--accent". */
  color: string
}

interface Props {
  /** [x seconds, ...y series] */
  data: number[][]
  series: ChartSeries[]
  height?: number
  /** Grow to the height the parent gives it (a flex child), never below `height`. */
  fill?: boolean
  /** Fixed y range; omit to auto-scale from 0. */
  yMax?: number
  format?: (v: number) => string
}

/** Vertical fade from the line colour to transparent. uPlot calls this with the live canvas. */
const gradient = (color: string) => (u: uPlot) => {
  const g = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height)
  g.addColorStop(0, color + '55')
  g.addColorStop(1, color + '00')
  return g
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Streaming area chart on uPlot. Re-themes itself when the OS colour scheme changes. */
export function Chart({ data, series, height = 120, yMax, format, fill = false }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)
  const latest = useRef(data)
  latest.current = data
  const theme = useResolvedTheme() // rebuild when the theme changes so canvas colours follow it

  useEffect(() => {
    const el = host.current
    if (!el) return
    // With fill, the plot is absolutely positioned inside the host, so the host's height comes from the layout, not the canvas.
    const h = () => (fill ? Math.max(el.clientHeight, height) : height)
    const build = () => {
      plot.current?.destroy()
      const grid = css('--line')
      const muted = css('--muted')
      plot.current = new uPlot(
        {
          width: el.clientWidth,
          height: h(),
          legend: { show: false },
          cursor: { show: false },
          padding: CHART_PADDING,
          scales: { x: { time: true }, y: { range: (_u, _min, max) => [0, yMax ?? Math.max(max * 1.15, 1)] } },
          axes: [
            { show: false },
            {
              size: 44,
              stroke: muted,
              grid: { stroke: grid, width: 1 },
              ticks: { show: false },
              font: AXIS_FONT,
              values: (_u, vals) => vals.map((v) => (format ? format(v) : String(v))),
            },
          ],
          series: [
            {},
            ...series.map((s) => {
              const c = css(s.color)
              return { label: s.label, stroke: c, width: 2, fill: gradient(c), points: { show: false } }
            }),
          ],
        },
        latest.current as uPlot.AlignedData,
        fill ? (el.firstElementChild as HTMLElement) : el,
      )
    }
    build()
    const ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height: h() }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      plot.current?.destroy()
      plot.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, fill, yMax, theme, series.map((s) => s.color).join()])

  useEffect(() => {
    plot.current?.setData(data as uPlot.AlignedData)
  }, [data])

  if (!fill) return <div ref={host} className="w-full" />
  return (
    <div ref={host} data-chart-fill className="relative w-full flex-1" style={{ minHeight: height }}>
      <div className="absolute inset-0" />
    </div>
  )
}
