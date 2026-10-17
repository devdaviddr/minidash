import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
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
  /** Fixed y range; omit to auto-scale from 0. */
  yMax?: number
  format?: (v: number) => string
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Streaming area chart on uPlot. Re-themes itself when the OS colour scheme changes. */
export function Chart({ data, series, height = 120, yMax, format }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)
  const latest = useRef(data)
  latest.current = data
  const theme = useResolvedTheme() // rebuild when the theme changes so canvas colours follow it

  useEffect(() => {
    const el = host.current
    if (!el) return
    const build = () => {
      plot.current?.destroy()
      const grid = css('--line')
      const muted = css('--muted')
      plot.current = new uPlot(
        {
          width: el.clientWidth,
          height,
          legend: { show: false },
          cursor: { show: false },
          padding: [6, 0, 0, 0],
          scales: { x: { time: true }, y: { range: (_u, _min, max) => [0, yMax ?? Math.max(max * 1.15, 1)] } },
          axes: [
            { show: false },
            {
              size: 44,
              stroke: muted,
              grid: { stroke: grid, width: 1 },
              ticks: { show: false },
              font: '11px ui-sans-serif, system-ui',
              values: (_u, vals) => vals.map((v) => (format ? format(v) : String(v))),
            },
          ],
          series: [
            {},
            ...series.map((s) => {
              const c = css(s.color)
              return { label: s.label, stroke: c, width: 2, fill: c + '26', points: { show: false } }
            }),
          ],
        },
        latest.current as uPlot.AlignedData,
        el,
      )
    }
    build()
    const ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      plot.current?.destroy()
      plot.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, yMax, theme, series.map((s) => s.color).join()])

  useEffect(() => {
    plot.current?.setData(data as uPlot.AlignedData)
  }, [data])

  return <div ref={host} className="w-full" />
}
