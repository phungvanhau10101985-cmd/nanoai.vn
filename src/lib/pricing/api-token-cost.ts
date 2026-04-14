/** Chi phí API — bảng giá tham khảo (USD / 1M token). Dùng admin + ước tính chi phí token shop (Messaging AI). */

export const IMAGE_TOKENS = { '1K': 1120, '2K': 1120, '4K': 2000 } as const

export const API_COST_PER_1M: Record<string, { input: number; output: number; outputImage?: number }> = {
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'gpt-5': { input: 2.5, output: 10 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gemini-3-pro-image-preview': { input: 2, output: 12, outputImage: 120 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3-pro-preview': { input: 2, output: 12 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-preview-09-2025': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash-image': { input: 0.3, output: 30 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  /** Text embedding — chủ yếu input; output ≈ 0 trong công thức. */
  'gemini-embedding-2-preview': { input: 0.15, output: 0 },
}

export const USD_TO_VND = 25_000

/** Tỷ giá USD→VND cho ước tính chi phí token (shop). Ghi đè bằng env `PARTNER_AI_TOKEN_COST_USD_TO_VND`. */
export function getPartnerAiTokenCostUsdToVnd(): number {
  const raw = process.env.PARTNER_AI_TOKEN_COST_USD_TO_VND?.trim()
  if (!raw) return USD_TO_VND
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : USD_TO_VND
}

export function calcCostVnd(
  promptTokens: number,
  outputTokens: number,
  model: string,
  imageSize?: string | null,
  usdToVnd: number = USD_TO_VND
): number {
  const rates = API_COST_PER_1M[model] ?? API_COST_PER_1M['gemini-3-flash-preview']
  const isImage = imageSize === '1K' || imageSize === '2K' || imageSize === '4K'
  const outputRate = rates.outputImage && isImage ? rates.outputImage : rates.output
  const effectiveOutputTokens =
    isImage && rates.outputImage && imageSize && imageSize in IMAGE_TOKENS
      ? IMAGE_TOKENS[imageSize as keyof typeof IMAGE_TOKENS]
      : outputTokens
  const usd = (promptTokens / 1_000_000) * rates.input + (effectiveOutputTokens / 1_000_000) * outputRate
  return Math.round(usd * usdToVnd)
}

export type PartnerAiTokenUsageStatRowForCost = {
  model: string
  sum_prompt_tokens: number
  sum_completion_tokens: number
}

export function partnerAiAggregatedModelRowsEstimatedCostVnd<T extends PartnerAiTokenUsageStatRowForCost>(
  rows: T[],
  usdToVnd = getPartnerAiTokenCostUsdToVnd()
): { totalVnd: number; rows: Array<T & { estimated_cost_vnd: number }> } {
  const out = rows.map((r) => ({
    ...r,
    estimated_cost_vnd: calcCostVnd(r.sum_prompt_tokens, r.sum_completion_tokens, r.model, null, usdToVnd),
  }))
  const totalVnd = out.reduce((s, x) => s + x.estimated_cost_vnd, 0)
  return { totalVnd, rows: out }
}

export function partnerAiTokenDetailRowEstimatedCostVnd(
  row: {
    model: string
    prompt_tokens: number | null
    completion_tokens: number | null
    total_tokens: number | null
  },
  usdToVnd = getPartnerAiTokenCostUsdToVnd()
): number {
  let p = Math.max(0, row.prompt_tokens ?? 0)
  let c = Math.max(0, row.completion_tokens ?? 0)
  if (p === 0 && c === 0 && row.total_tokens != null && row.total_tokens > 0) {
    const t = row.total_tokens
    p = Math.floor(t / 2)
    c = t - p
  }
  return calcCostVnd(p, c, row.model, null, usdToVnd)
}
