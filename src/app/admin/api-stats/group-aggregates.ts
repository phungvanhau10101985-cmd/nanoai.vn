import type { ApiFeatureGroupId } from './feature-groups'
import { resolveApiFeatureGroupId } from './feature-groups'
import { calcCostVndSplit } from './api-cost'

export type UsageAggRow = {
  calls: number
  promptTokens: number
  outputTokens: number
  totalTokens: number
  costVnd: number
  inputCostVnd: number
  outputCostVnd: number
  calls2K: number
  calls4K: number
  callsNoImage: number
}

function emptyAgg(): UsageAggRow {
  return {
    calls: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costVnd: 0,
    inputCostVnd: 0,
    outputCostVnd: 0,
    calls2K: 0,
    calls4K: 0,
    callsNoImage: 0,
  }
}

function addLog(
  agg: UsageAggRow,
  log: {
    prompt_token_count: number | null
    candidates_token_count: number | null
    total_token_count: number | null
    model: string
    image_size?: string | null
  },
  costSplit: { inputVnd: number; outputVnd: number; totalVnd: number }
) {
  agg.calls += 1
  agg.promptTokens += log.prompt_token_count || 0
  agg.outputTokens += log.candidates_token_count || 0
  agg.totalTokens += log.total_token_count || 0
  agg.costVnd += costSplit.totalVnd
  agg.inputCostVnd += costSplit.inputVnd
  agg.outputCostVnd += costSplit.outputVnd
  const imgSize = log.image_size
  if (imgSize === '2K') agg.calls2K += 1
  else if (imgSize === '4K') agg.calls4K += 1
  else agg.callsNoImage += 1
}

export type GroupRollup = {
  id: ApiFeatureGroupId
  totals: UsageAggRow
  byFeature: Record<string, UsageAggRow>
  byModel: Record<string, UsageAggRow>
  /** Trong nhóm: mỗi feature → từng model (lượt, token, chi phí). */
  byFeatureModels: Record<string, Record<string, UsageAggRow>>
}

type LogRow = {
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  total_token_count: number | null
  image_size?: string | null
}

function ensureNestedModelAgg(
  root: Record<string, Record<string, UsageAggRow>>,
  feature: string,
  model: string
): UsageAggRow {
  if (!root[feature]) root[feature] = {}
  if (!root[feature][model]) root[feature][model] = emptyAgg()
  return root[feature][model]
}

/** model → feature (đảo chiều so với siteByFeatureModels). */
function ensureModelFeatureAgg(
  root: Record<string, Record<string, UsageAggRow>>,
  model: string,
  feature: string
): UsageAggRow {
  if (!root[model]) root[model] = {}
  if (!root[model][feature]) root[model][feature] = emptyAgg()
  return root[model][feature]
}

/**
 * Gộp log: toàn site, theo nhóm, theo feature, theo model, và feature→model trong từng nhóm & toàn site.
 */
export function rollupApiUsageByFeatureGroup(
  logs: LogRow[],
  calcCostVnd: (
    promptTokens: number,
    outputTokens: number,
    model: string,
    imageSize?: string | null
  ) => number
): {
  groups: GroupRollup[]
  siteTotals: UsageAggRow
  siteByFeature: Record<string, UsageAggRow>
  siteByModel: Record<string, UsageAggRow>
  siteByFeatureModels: Record<string, Record<string, UsageAggRow>>
  /** Mỗi model → từng feature (lượt, chi phí) — đọc theo chiều “model rồi tới tính năng”. */
  siteByModelFeatures: Record<string, Record<string, UsageAggRow>>
  /** Số nhóm tính năng khác nhau mà mỗi model xuất hiện trong log. */
  siteModelDistinctGroupCount: Record<string, number>
} {
  const siteTotals = emptyAgg()
  const siteByFeature: Record<string, UsageAggRow> = {}
  const siteByModel: Record<string, UsageAggRow> = {}
  const siteByFeatureModels: Record<string, Record<string, UsageAggRow>> = {}
  const siteByModelFeatures: Record<string, Record<string, UsageAggRow>> = {}
  const siteModelGroupSets = new Map<string, Set<ApiFeatureGroupId>>()
  const groupMap = new Map<ApiFeatureGroupId, GroupRollup>()

  const ensureGroup = (id: ApiFeatureGroupId): GroupRollup => {
    let g = groupMap.get(id)
    if (!g) {
      g = { id, totals: emptyAgg(), byFeature: {}, byModel: {}, byFeatureModels: {} }
      groupMap.set(id, g)
    }
    return g
  }

  for (const log of logs) {
    const imgSize = (log as { image_size?: string | null }).image_size
    const costSplit = calcCostVndSplit(
      log.prompt_token_count || 0,
      log.candidates_token_count || 0,
      log.model,
      imgSize
    )
    // Vẫn cho phép caller override `calcCostVnd` (chữ ký cũ) — nếu khác kết quả nội bộ thì dùng caller cho `totalVnd`.
    const callerTotal = calcCostVnd(
      log.prompt_token_count || 0,
      log.candidates_token_count || 0,
      log.model,
      imgSize
    )
    if (callerTotal !== costSplit.totalVnd) {
      // Tỷ lệ điều chỉnh để giữ tổng trùng với caller (rất hiếm khác).
      const ratio = costSplit.totalVnd > 0 ? callerTotal / costSplit.totalVnd : 1
      costSplit.inputVnd = Math.round(costSplit.inputVnd * ratio)
      costSplit.outputVnd = callerTotal - costSplit.inputVnd
      costSplit.totalVnd = callerTotal
    }
    addLog(siteTotals, { ...log, image_size: imgSize }, costSplit)

    const fk = log.feature
    const mk = log.model

    if (!siteByFeature[fk]) siteByFeature[fk] = emptyAgg()
    addLog(siteByFeature[fk], { ...log, image_size: imgSize }, costSplit)

    if (!siteByModel[mk]) siteByModel[mk] = emptyAgg()
    addLog(siteByModel[mk], { ...log, image_size: imgSize }, costSplit)

    addLog(ensureNestedModelAgg(siteByFeatureModels, fk, mk), { ...log, image_size: imgSize }, costSplit)
    addLog(ensureModelFeatureAgg(siteByModelFeatures, mk, fk), { ...log, image_size: imgSize }, costSplit)

    const gid = resolveApiFeatureGroupId(log.feature)
    let gset = siteModelGroupSets.get(mk)
    if (!gset) {
      gset = new Set<ApiFeatureGroupId>()
      siteModelGroupSets.set(mk, gset)
    }
    gset.add(gid)
    const g = ensureGroup(gid)
    addLog(g.totals, { ...log, image_size: imgSize }, costSplit)

    if (!g.byFeature[fk]) g.byFeature[fk] = emptyAgg()
    addLog(g.byFeature[fk], { ...log, image_size: imgSize }, costSplit)

    if (!g.byModel[mk]) g.byModel[mk] = emptyAgg()
    addLog(g.byModel[mk], { ...log, image_size: imgSize }, costSplit)

    addLog(ensureNestedModelAgg(g.byFeatureModels, fk, mk), { ...log, image_size: imgSize }, costSplit)
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.totals.costVnd - a.totals.costVnd)

  const siteModelDistinctGroupCount: Record<string, number> = {}
  for (const [model, set] of siteModelGroupSets) {
    siteModelDistinctGroupCount[model] = set.size
  }

  return {
    groups,
    siteTotals,
    siteByFeature,
    siteByModel,
    siteByFeatureModels,
    siteByModelFeatures,
    siteModelDistinctGroupCount,
  }
}
