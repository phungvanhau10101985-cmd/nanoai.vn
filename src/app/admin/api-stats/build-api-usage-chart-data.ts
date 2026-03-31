import type { ApiUsageLogRow } from './fetch-api-usage-logs-range'

export const API_USAGE_CHART_OTHER_KEY = '__other__' as const

export type ApiUsageDailyChartRow = {
  dateLabel: string
  dateKey: string
  requests: number
  inputTokens: number
  outputTokens: number
}

export type ApiUsageModelSeriesRow = Record<string, string | number>

export type ApiUsageChartPayload = {
  daily: ApiUsageDailyChartRow[]
  /** Model id (không gồm OTHER) — top theo số lượt gọi */
  modelKeys: string[]
  tokensByModelRows: ApiUsageModelSeriesRow[]
  requestsByModelRows: ApiUsageModelSeriesRow[]
  showOtherSeries: boolean
}

function formatChartDayLabel(dateKey: string, localeTag: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateKey
  return d.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })
}

export function enumerateDaysInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = []
  const start = new Date(`${fromYmd}T12:00:00`)
  const end = new Date(`${toYmd}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
  }
  return out
}

type PerModelDayCell = { requests: number; inputTokens: number }

export function buildApiUsageChartData(
  logs: ApiUsageLogRow[],
  fromYmd: string,
  toYmd: string,
  localeTag: string,
  topModels = 8
): ApiUsageChartPayload {
  const days = enumerateDaysInclusive(fromYmd, toYmd)
  const dailyAgg = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>()
  for (const d of days) {
    dailyAgg.set(d, { requests: 0, inputTokens: 0, outputTokens: 0 })
  }

  const modelTotals = new Map<string, number>()
  for (const log of logs) {
    modelTotals.set(log.model, (modelTotals.get(log.model) ?? 0) + 1)
  }
  const sortedModels = [...modelTotals.entries()].sort((a, b) => b[1] - a[1])
  const topKeys = sortedModels.slice(0, topModels).map(([k]) => k)
  const topSet = new Set(topKeys)

  const perModelByDay = new Map<string, Map<string, PerModelDayCell>>()
  for (const d of days) {
    const inner = new Map<string, PerModelDayCell>()
    for (const k of topKeys) {
      inner.set(k, { requests: 0, inputTokens: 0 })
    }
    inner.set(API_USAGE_CHART_OTHER_KEY, { requests: 0, inputTokens: 0 })
    perModelByDay.set(d, inner)
  }

  let otherAny = false
  for (const log of logs) {
    const day = String(log.created_at).slice(0, 10)
    const bucket = dailyAgg.get(day)
    if (!bucket) continue
    bucket.requests += 1
    bucket.inputTokens += log.prompt_token_count || 0
    bucket.outputTokens += log.candidates_token_count || 0

    const mk = topSet.has(log.model) ? log.model : API_USAGE_CHART_OTHER_KEY
    if (mk === API_USAGE_CHART_OTHER_KEY) otherAny = true
    const cell = perModelByDay.get(day)?.get(mk)
    if (cell) {
      cell.requests += 1
      cell.inputTokens += log.prompt_token_count || 0
    }
  }

  const daily: ApiUsageDailyChartRow[] = days.map((dateKey) => {
    const b = dailyAgg.get(dateKey) ?? { requests: 0, inputTokens: 0, outputTokens: 0 }
    return {
      dateKey,
      dateLabel: formatChartDayLabel(dateKey, localeTag),
      requests: b.requests,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
    }
  })

  const buildSeriesRows = (field: keyof PerModelDayCell): ApiUsageModelSeriesRow[] =>
    days.map((dateKey) => {
      const row: ApiUsageModelSeriesRow = {
        dateKey,
        dateLabel: formatChartDayLabel(dateKey, localeTag),
      }
      const inner = perModelByDay.get(dateKey)
      for (const k of topKeys) {
        row[k] = inner?.get(k)?.[field] ?? 0
      }
      row[API_USAGE_CHART_OTHER_KEY] = inner?.get(API_USAGE_CHART_OTHER_KEY)?.[field] ?? 0
      return row
    })

  const tokensByModelRows = buildSeriesRows('inputTokens')
  const requestsByModelRows = buildSeriesRows('requests')

  const showOtherSeries =
    otherAny && tokensByModelRows.some((r) => Number(r[API_USAGE_CHART_OTHER_KEY]) > 0)

  return {
    daily,
    modelKeys: topKeys,
    tokensByModelRows,
    requestsByModelRows,
    showOtherSeries,
  }
}
