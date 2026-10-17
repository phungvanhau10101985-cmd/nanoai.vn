'use client'

import { useId, useMemo } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { homeworkPlotFromStatement, type HomeworkPlot, type HomeworkPlotPoint } from '@/lib/homework-help/homework-plot'
import { StudyFormulaText } from '@/components/student-study/study-formula-text'

const STROKE = [
  'stroke-blue-700 dark:stroke-blue-300',
  'stroke-red-600 dark:stroke-red-300',
  'stroke-emerald-700 dark:stroke-emerald-300',
]
const SWATCH = [
  'border-blue-700 dark:border-blue-300',
  'border-red-600 dark:border-red-300',
  'border-emerald-700 dark:border-emerald-300',
]

function niceStep(span: number): number {
  const rough = span / 6
  if (!(rough > 0)) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const scaled = rough / pow
  const nice = scaled <= 1.5 ? 1 : scaled <= 3 ? 2 : scaled <= 7 ? 5 : 10
  return nice * pow
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min)
  const start = Math.ceil((min + step * 1e-6) / step) * step
  const out: number[] = []
  for (let value = start; value <= max + step * 1e-6 && out.length < 12; value += step) {
    const snapped = Math.abs(value) < step * 1e-6 ? 0 : Math.round(value * 1e6) / 1e6
    if (snapped < min || snapped > max) continue
    out.push(snapped)
  }
  return out
}

function formatTick(value: number, locale: WebLocale): string {
  const rounded = Math.abs(value) < 1e-8 ? 0 : Math.round(value * 1000) / 1000
  const text = String(rounded)
  return locale === 'vi' ? text.replace('.', ',') : text
}

function pathOf(points: HomeworkPlotPoint[], mapX: (x: number) => number, mapY: (y: number) => number): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${mapX(point.x).toFixed(1)} ${mapY(point.y).toFixed(1)}`)
    .join(' ')
}

function PlotFrame({ plot, title, locale }: { plot: HomeworkPlot; title: string; locale: WebLocale }) {
  const markerId = useId().replace(/:/g, '')
  const padL = 42
  const padR = 16
  const padT = 16
  const padB = 32
  const innerW = 304
  const innerH = 196
  const spanX = plot.xMax - plot.xMin
  const spanY = plot.yMax - plot.yMin
  const unit = plot.equalScale ? Math.min(innerW / spanX, innerH / spanY) : 0
  const usedW = plot.equalScale ? spanX * unit : innerW
  const usedH = plot.equalScale ? spanY * unit : innerH
  const ox = padL + (innerW - usedW) / 2
  const oy = padT + (innerH - usedH) / 2
  const mapX = (x: number) => ox + ((x - plot.xMin) / spanX) * usedW
  const mapY = (y: number) => oy + ((plot.yMax - y) / spanY) * usedH
  const xTicks = ticks(plot.xMin, plot.xMax)
  const yTicks = ticks(plot.yMin, plot.yMax).filter((tick) => Math.abs(tick) > 1e-8)
  const zeroX = plot.xMin <= 0 && plot.xMax >= 0
  const zeroY = plot.yMin <= 0 && plot.yMax >= 0
  const axisX = zeroX ? mapX(0) : ox
  const axisY = zeroY ? mapY(0) : oy + usedH
  const labelClass = 'fill-foreground stroke-background text-[10px] [paint-order:stroke] [stroke-width:3px]'

  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-lg border bg-background px-1 py-1">
        <svg viewBox={`0 0 ${padL + innerW + padR} ${padT + innerH + padB}`} className="h-auto w-full text-foreground" role="img">
          <title>{title}</title>
          <defs>
            <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" className="fill-foreground" />
            </marker>
          </defs>
          {xTicks.map((tick) => (
            <line
              key={`gx-${tick}`}
              x1={mapX(tick)}
              y1={oy}
              x2={mapX(tick)}
              y2={oy + usedH}
              className="stroke-current opacity-15"
            />
          ))}
          {yTicks.map((tick) => (
            <line
              key={`gy-${tick}`}
              x1={ox}
              y1={mapY(tick)}
              x2={ox + usedW}
              y2={mapY(tick)}
              className="stroke-current opacity-15"
            />
          ))}
          <line
            x1={ox}
            y1={axisY}
            x2={ox + usedW}
            y2={axisY}
            className="stroke-current"
            strokeWidth="1.25"
            markerEnd={zeroY ? `url(#${markerId})` : undefined}
          />
          <line
            x1={axisX}
            y1={oy + usedH}
            x2={axisX}
            y2={oy}
            className="stroke-current"
            strokeWidth="1.25"
            markerEnd={zeroX ? `url(#${markerId})` : undefined}
          />
          {plot.series.map((series, index) => (
            <g key={series.label} className={STROKE[index] ?? STROKE[0]} fill="none" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              {series.circle ? (
                <circle cx={mapX(series.circle.h)} cy={mapY(series.circle.k)} r={(usedW / spanX) * series.circle.r} />
              ) : null}
              {series.segments.map((segment, segmentIndex) => (
                <path key={segmentIndex} d={pathOf(segment, mapX, mapY)} />
              ))}
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={`lx-${tick}`} x={mapX(tick)} y={Math.min(axisY + 14, oy + usedH + 18)} textAnchor="middle" className={labelClass}>
              {formatTick(tick, locale)}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text key={`ly-${tick}`} x={axisX - 6} y={mapY(tick) + 3} textAnchor="end" className={labelClass}>
              {formatTick(tick, locale)}
            </text>
          ))}
          <text x={ox + usedW - 2} y={Math.max(oy + 11, axisY - 8)} textAnchor="end" className={labelClass}>
            {plot.xAxis}
          </text>
          <text x={Math.min(axisX + 8, ox + usedW - 12)} y={oy + 11} className={labelClass}>
            {plot.yAxis}
          </text>
        </svg>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {plot.series.map((series, index) => (
          <li key={series.label} className="flex items-center gap-2 text-sm leading-6">
            <span className={`inline-block w-6 border-t-2 ${SWATCH[index] ?? SWATCH[0]}`} aria-hidden />
            <StudyFormulaText text={series.label} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomeworkPlotFigure({
  statement,
  title,
  locale,
}: {
  statement: string
  title: string
  locale: WebLocale
}) {
  const plot = useMemo(() => homeworkPlotFromStatement(statement), [statement])
  if (!plot) return null
  return <PlotFrame plot={plot} title={title} locale={locale} />
}
