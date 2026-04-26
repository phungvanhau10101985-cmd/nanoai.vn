'use client'

import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ApiUsageChartPayload } from './build-api-usage-chart-data'
import { API_USAGE_CHART_OTHER_KEY } from './build-api-usage-chart-data'

const MODEL_LINE_COLORS = [
  '#2563eb',
  '#06b6d4',
  '#db2777',
  '#7c3aed',
  '#ea580c',
  '#16a34a',
  '#ca8a04',
  '#64748b',
]

export type ApiUsageChartsCopy = {
  sectionTitle: string
  subtitle: string
  requestsAndInputTitle: string
  tokenStackTitle: string
  inputTokensByModelTitle: string
  requestsByModelTitle: string
  costStackTitle: string
  costByModelTitle: string
  legendRequests: string
  legendInputTokens: string
  legendInputStack: string
  legendOutputStack: string
  legendInputCostStack: string
  legendOutputCostStack: string
  legendOtherModels: string
  noDataMessage: string
  noteDataScope: string
}

type Props = {
  payload: ApiUsageChartPayload
  modelLabels: Record<string, string>
  copy: ApiUsageChartsCopy
  hasAnyLog: boolean
}

function formatTick(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

function formatVndTick(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr₫`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k₫`
  return `${n}₫`
}

function tooltipFormatPair(value: unknown, name: unknown): [string, string] {
  const raw = value
  const n = typeof raw === 'number' ? raw : Number(raw)
  const formatted = Number.isFinite(n) ? n.toLocaleString() : String(raw ?? '')
  return [formatted, String(name ?? '')]
}

function tooltipFormatVnd(value: unknown, name: unknown): [string, string] {
  const raw = value
  const n = typeof raw === 'number' ? raw : Number(raw)
  const formatted = Number.isFinite(n) ? `${n.toLocaleString('vi-VN')}₫` : String(raw ?? '')
  return [formatted, String(name ?? '')]
}

export function ApiUsageCharts({ payload, modelLabels, copy, hasAnyLog }: Props) {
  const { daily, modelKeys, tokensByModelRows, requestsByModelRows, costByModelRows, showOtherSeries } = payload
  const seriesKeys = [...modelKeys, ...(showOtherSeries ? [API_USAGE_CHART_OTHER_KEY] : [])]

  const legendName = (key: string) =>
    key === API_USAGE_CHART_OTHER_KEY ? copy.legendOtherModels : modelLabels[key] ?? key

  if (!hasAnyLog || daily.length === 0) {
    return (
      <CardShell title={copy.sectionTitle} subtitle={copy.subtitle}>
        <p className="text-sm text-muted-foreground py-8 text-center">{copy.noteDataScope}</p>
      </CardShell>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{copy.sectionTitle}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{copy.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-3xl">{copy.noteDataScope}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={copy.requestsAndInputTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                yAxisId="left"
                tickFormatter={formatTick}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatTick}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatPair} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="requests" name={copy.legendRequests} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="inputTokens"
                name={copy.legendInputTokens}
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={copy.tokenStackTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={formatTick} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatPair} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inputTokens" stackId="tok" name={copy.legendInputStack} fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar
                dataKey="outputTokens"
                stackId="tok"
                name={copy.legendOutputStack}
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={copy.inputTokensByModelTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tokensByModelRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={formatTick} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatPair} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={legendName(key)}
                  stroke={MODEL_LINE_COLORS[i % MODEL_LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={copy.requestsByModelTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={requestsByModelRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={formatTick} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatPair} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={legendName(key)}
                  stroke={MODEL_LINE_COLORS[i % MODEL_LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={copy.costStackTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={formatVndTick} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatVnd} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="inputCostVnd"
                stackId="cost"
                name={copy.legendInputCostStack}
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="outputCostVnd"
                stackId="cost"
                name={copy.legendOutputCostStack}
                fill="#dc2626"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={copy.costByModelTitle}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={costByModelRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={formatVndTick} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={tooltipFormatVnd} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={legendName(key)}
                  stroke={MODEL_LINE_COLORS[i % MODEL_LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      {children}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 pt-5">
      <h4 className="text-sm font-medium mb-3 px-1">{title}</h4>
      {children}
    </div>
  )
}
