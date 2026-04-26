/**
 * Chi phí ước tính (USD / 1 triệu token) — căn bảng giá Gemini Developer API (tham khảo Google, cập nhật ~2026-04).
 * DeepSeek-V3.2 (deepseek-chat / deepseek-reasoner): theo docs — input cache miss 0,28; output 0,42 (input cache hit 0,028 — log hiện không tách nên ước tính dùng cache miss).
 * OpenAI: tham khảo. Một số model Gemini có giá khác theo prompt >200k token / lần gọi — chỉ áp khi tính theo **từng lần gọi** (chi tiết).
 */

export type ModelUsdRates = {
  input: number
  output: number
  /** USD / 1M token cho đầu ra ảnh (khi dùng outputImage + imageSize). */
  outputImage?: number
  /** Prompt > 200.000 token trong một request (chỉ dùng khi pricingTier = auto). */
  inputLong?: number
  outputLong?: number
}

/**
 * Token đầu ra ảnh tương đương (mỗi ảnh; tham khảo tài liệu Google 2026-04).
 *
 * Số liệu này khớp với Gemini 3 Pro Image (1K-2K = 1120, 4K = 2000).
 * Lưu ý: Gemini 3.1 Flash Image / 2.5 Flash Image dùng số token khác (ví dụ
 * 3.1 Flash Image: 0.5K=747, 1K=1120, 2K=1680, 4K=2520) — nếu chuyển sang dùng
 * các model đó cần thêm bảng riêng theo `model + size`. Hiện codebase chỉ dùng
 * `gemini-3-pro-image-preview` nên giữ nguyên bảng này.
 */
export const IMAGE_TOKENS = { '1K': 1120, '2K': 1120, '4K': 2000 } as const

/**
 * Bảng giá USD / 1M token (đầu vào / đầu ra văn bản), trừ khi có outputImage.
 * Gemini 3.1 / 3 / 2.5: theo mục “Bậc có tính phí” trên trang giá Developer API.
 * DeepSeek: Models & Pricing — cùng bảng giá cho chat và reasoner (V3.2).
 */
export const API_COST_PER_1M: Record<string, ModelUsdRates> = {
  /** Input: cache miss. Output: 0,42 USD/1M (cache hit input 0,028 — không dùng khi chưa có số liệu cache). */
  'deepseek-reasoner': { input: 0.28, output: 0.42 },
  'deepseek-chat': { input: 0.28, output: 0.42 },
  'gpt-5': { input: 2.5, output: 10 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  /**
   * GPT-4o-mini-tts (Audio API): input văn bản $0.60/1M, output (audio) $12/1M.
   * Trong codebase dùng làm fallback khi Gemini 2.5 Flash TTS lỗi (đắt hơn ~17x output).
   */
  'gpt-4o-mini-tts': { input: 0.6, output: 12 },

  /** Gemini 3.1 Pro Preview — bậc theo prompt 200k token. */
  'gemini-3.1-pro-preview': { input: 2, output: 12, inputLong: 4, outputLong: 18 },
  'gemini-3.1-pro-preview-customtools': { input: 2, output: 12, inputLong: 4, outputLong: 18 },

  /** Gemini 3 Pro Image — Nano Banana / inbox ảnh; đầu ra ảnh: 120 USD / 1M token ảnh. */
  'gemini-3-pro-image-preview': { input: 2, output: 12, outputImage: 120, inputLong: 4, outputLong: 18 },

  /** Gemini 3 Flash Preview. */
  'gemini-3-flash-preview': { input: 0.5, output: 3 },

  /** Gemini 3 Pro (text) — cùng hàng với 3 Flash trên một số bảng; giữ tier 200k nếu có. */
  'gemini-3-pro-preview': { input: 2, output: 12, inputLong: 4, outputLong: 18 },

  /** Gemini 3.1 Flash-Lite Preview. */
  'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.5 },

  /** Gemini 3.1 Flash Image — đầu ra ảnh 60 USD / 1M token ảnh (footenote độ phân giải). */
  'gemini-3.1-flash-image-preview': { input: 0.5, output: 3, outputImage: 60 },

  /** Gemini 2.5 Pro — tier 200k. */
  'gemini-2.5-pro': { input: 1.25, output: 10, inputLong: 2.5, outputLong: 15 },

  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-preview-09-2025': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  /** Đầu ra ảnh: 30 USD / 1M token (≈0,039 USD/ảnh 1024). */
  'gemini-2.5-flash-image': { input: 0.3, output: 2.5, outputImage: 30 },

  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },

  /** Gemini Embedding — văn bản; chỉ dùng nhánh input. */
  'gemini-embedding-001': { input: 0.15, output: 0 },
  /** Gemini Embedding 2 Preview — giá nhập văn bản (bậc trả phí). */
  'gemini-embedding-2-preview': { input: 0.2, output: 0 },
  /** Gemini Embedding 2 (stable) — đa phương thức, chỉ tính nhập văn bản ở đây. */
  'gemini-embedding-2': { input: 0.2, output: 0 },

  /** Gemini 2.5 Flash Preview TTS — input $0.5, output (audio) $10/1M token. */
  'gemini-2.5-flash-preview-tts': { input: 0.5, output: 10 },
  /** Gemini 2.5 Pro Preview TTS — input $1, output (audio) $20/1M token. */
  'gemini-2.5-pro-preview-tts': { input: 1, output: 20 },
  /** Gemini 3.1 Flash TTS Preview — input $1, output (audio) $10/1M token. */
  'gemini-3.1-flash-tts-preview': { input: 1, output: 10 },

  /** Gemini 2.5 Flash Native Audio Preview — input $0.5 text / $3 audio; output $2 text / $12 audio. */
  'gemini-2.5-flash-native-audio-preview-12-2025': { input: 3, output: 12 },

  /** Gemini 2.5 Computer Use Preview — tier 200k. */
  'gemini-2.5-computer-use-preview-10-2025': { input: 1.25, output: 10, inputLong: 2.5, outputLong: 15 },

  /** Gemini Robotics-ER 1.5 / 1.6 Preview — input/output ($0.30/$2.50 và $1/$5). */
  'gemini-robotics-er-1.5-preview': { input: 0.3, output: 2.5 },
  'gemini-robotics-er-1.6-preview': { input: 1, output: 5 },

  /** Gemini 3.1 Flash-Live Preview — input $0.75 text / $3 audio / $1 video; output $4.5 text / $12 audio. */
  'gemini-3.1-flash-live-preview': { input: 3, output: 12 },

  /**
   * Veo / Imagen / Lyria không dùng đơn vị token — log placeholder 1 token/lượt.
   * Đặt `input: 0, output: 0` để chi phí không bị tính qua token; chi phí thực
   * cần báo cáo riêng (per-second / per-image / per-song) nếu cần.
   */
  'veo-3.1-generate-preview': { input: 0, output: 0 },
  'veo-3.1-fast-generate-preview': { input: 0, output: 0 },
  'veo-3.1-lite-generate-preview': { input: 0, output: 0 },
  'veo-3.0-generate-001': { input: 0, output: 0 },
  'veo-3.0-fast-generate-001': { input: 0, output: 0 },
  'veo-2.0-generate-001': { input: 0, output: 0 },
  'imagen-4.0-generate-001': { input: 0, output: 0 },
  'imagen-4.0-fast-generate-001': { input: 0, output: 0 },
  'imagen-4.0-ultra-generate-001': { input: 0, output: 0 },
  'lyria-3-clip-preview': { input: 0, output: 0 },
  'lyria-3-pro-preview': { input: 0, output: 0 },
}

export const USD_TO_VND = 25_000

const DEFAULT_FALLBACK_MODEL = 'gemini-3-flash-preview'

export function getPartnerAiTokenCostUsdToVnd(): number {
  const raw = process.env.PARTNER_AI_TOKEN_COST_USD_TO_VND?.trim()
  if (!raw) return USD_TO_VND
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : USD_TO_VND
}

export type CalcCostVndOptions = {
  usdToVnd?: number
  /**
   * `per_call` (mặc định): prompt > 200k → bậc giá cao (nếu model có inputLong).
   * `aggregate_short`: luôn dùng bậc thấp — dùng khi cộng nhiều lần gọi (một dòng thống kê), vì tổng prompt không phải một request.
   */
  pricingMode?: 'per_call' | 'aggregate_short'
}

function resolveInputOutputRates(
  rates: ModelUsdRates,
  promptTokens: number,
  pricingMode: 'per_call' | 'aggregate_short'
): { inputRate: number; outputRate: number } {
  const useLong =
    pricingMode === 'per_call' &&
    promptTokens > 200_000 &&
    rates.inputLong != null &&
    rates.outputLong != null
  return {
    inputRate: useLong ? rates.inputLong! : rates.input,
    outputRate: useLong ? rates.outputLong! : rates.output,
  }
}

export type CalcCostVndSplit = {
  /** ₫ phần input (prompt tokens × giá input). */
  inputVnd: number
  /** ₫ phần output (output tokens × giá output, có tính outputImage cho ảnh). */
  outputVnd: number
  /** ₫ tổng = inputVnd + outputVnd (đã làm tròn từ tổng USD, **không** cộng từ hai số đã làm tròn). */
  totalVnd: number
}

/**
 * Như `calcCostVnd`, nhưng trả thêm phần input/output tách rời (₫) — dùng cho thẻ tổng quan.
 * `totalVnd` được làm tròn từ tổng USD (giống `calcCostVnd`); `inputVnd` và `outputVnd`
 * cũng được làm tròn riêng nên có thể chênh `totalVnd` ±1₫ do làm tròn — không đáng kể.
 */
export function calcCostVndSplit(
  promptTokens: number,
  outputTokens: number,
  model: string,
  imageSize?: string | null,
  usdToVndOrFirstOpt?: number | CalcCostVndOptions,
  maybeOptions?: CalcCostVndOptions
): CalcCostVndSplit {
  let usdToVnd = USD_TO_VND
  let options: CalcCostVndOptions = {}
  if (typeof usdToVndOrFirstOpt === 'number' || usdToVndOrFirstOpt === undefined) {
    usdToVnd = typeof usdToVndOrFirstOpt === 'number' ? usdToVndOrFirstOpt : USD_TO_VND
    options = maybeOptions ?? {}
  } else {
    options = usdToVndOrFirstOpt
    usdToVnd = options.usdToVnd ?? USD_TO_VND
  }

  const rates = API_COST_PER_1M[model] ?? API_COST_PER_1M[DEFAULT_FALLBACK_MODEL]
  const pricingMode = options.pricingMode ?? 'per_call'
  const { inputRate, outputRate } = resolveInputOutputRates(rates, promptTokens, pricingMode)

  const isImageSizeTier = imageSize === '1K' || imageSize === '2K' || imageSize === '4K'
  const imageUsdPerM = rates.outputImage

  let outRate: number
  let effectiveOutputTokens: number
  if (imageUsdPerM != null && isImageSizeTier && imageSize != null && imageSize in IMAGE_TOKENS) {
    outRate = imageUsdPerM
    effectiveOutputTokens = IMAGE_TOKENS[imageSize as keyof typeof IMAGE_TOKENS]
  } else if (imageUsdPerM != null) {
    outRate = imageUsdPerM
    effectiveOutputTokens = outputTokens
  } else {
    outRate = outputRate
    effectiveOutputTokens = outputTokens
  }

  const inputUsd = (promptTokens / 1_000_000) * inputRate
  const outputUsd = (effectiveOutputTokens / 1_000_000) * outRate
  return {
    inputVnd: Math.round(inputUsd * usdToVnd),
    outputVnd: Math.round(outputUsd * usdToVnd),
    totalVnd: Math.round((inputUsd + outputUsd) * usdToVnd),
  }
}

export function calcCostVnd(
  promptTokens: number,
  outputTokens: number,
  model: string,
  imageSize?: string | null,
  usdToVndOrFirstOpt?: number | CalcCostVndOptions,
  maybeOptions?: CalcCostVndOptions
): number {
  return calcCostVndSplit(
    promptTokens,
    outputTokens,
    model,
    imageSize,
    usdToVndOrFirstOpt,
    maybeOptions
  ).totalVnd
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
    estimated_cost_vnd: calcCostVnd(r.sum_prompt_tokens, r.sum_completion_tokens, r.model, null, {
      usdToVnd,
      pricingMode: 'aggregate_short',
    }),
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
  return calcCostVnd(p, c, row.model, null, { usdToVnd, pricingMode: 'per_call' })
}

/** Thứ Hai UTC của tuần chứa `dayUtc` (YYYY-MM-DD). */
export function utcMondayOfDayUtc(dayUtc: string): string {
  const d = new Date(dayUtc.trim().slice(0, 10) + 'T12:00:00.000Z')
  if (Number.isNaN(d.getTime())) return dayUtc.slice(0, 10)
  const dow = d.getUTCDay()
  const mondayOffset = (dow + 6) % 7
  d.setUTCDate(d.getUTCDate() - mondayOffset)
  return d.toISOString().slice(0, 10)
}

export type PartnerAiCostDailyVndRow = {
  day_utc: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
  estimated_cost_vnd: number
}

export type PartnerAiCostWeekVndRow = {
  week_start_utc: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
  estimated_cost_vnd: number
}

export type PartnerAiCostMonthVndRow = {
  month_utc: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
  estimated_cost_vnd: number
}

export type PartnerAiCostByKindRow = {
  usage_kind: string | null
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
  estimated_cost_vnd: number
}

export type PartnerAiCostKindModelRow = {
  usage_kind: string | null
  provider: string
  model: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
  estimated_cost_vnd: number
}

export type PartnerAiUsageCostBreakdown = {
  byKind: PartnerAiCostByKindRow[]
  byKindAndModel: PartnerAiCostKindModelRow[]
  daily: PartnerAiCostDailyVndRow[]
  weekly: PartnerAiCostWeekVndRow[]
  monthly: PartnerAiCostMonthVndRow[]
  /** Tổng VNĐ kỳ (trùng công thức cộng theo model). */
  periodTotalEstimatedVnd: number
}

function rowCostAggregateShort(
  sumPrompt: number,
  sumCompletion: number,
  model: string,
  usdToVnd: number
): number {
  return calcCostVnd(sumPrompt, sumCompletion, model, null, { usdToVnd, pricingMode: 'aggregate_short' })
}

/**
 * Chi phí ước tính (₫) theo ngày / tuần / tháng (UTC) và theo hạng mục — từ bảng gom model.
 */
export function buildPartnerAiUsageCostBreakdown(
  dailyModelRows: Array<{
    day_utc: string
    provider: string
    model: string
    call_count: number
    sum_prompt_tokens: number
    sum_completion_tokens: number
    sum_total_tokens: number
  }>,
  kindModelRows: Array<{
    usage_kind: string | null
    provider: string
    model: string
    call_count: number
    sum_prompt_tokens: number
    sum_completion_tokens: number
    sum_total_tokens: number
  }>,
  usdToVnd = getPartnerAiTokenCostUsdToVnd()
): PartnerAiUsageCostBreakdown {
  const byKindAndModel: PartnerAiCostKindModelRow[] = kindModelRows.map((r) => {
    const estimated_cost_vnd = rowCostAggregateShort(
      r.sum_prompt_tokens,
      r.sum_completion_tokens,
      r.model,
      usdToVnd
    )
    return {
      usage_kind: r.usage_kind,
      provider: r.provider,
      model: r.model,
      call_count: r.call_count,
      sum_prompt_tokens: r.sum_prompt_tokens,
      sum_completion_tokens: r.sum_completion_tokens,
      sum_total_tokens: r.sum_total_tokens,
      estimated_cost_vnd,
    }
  })

  const kindAgg = new Map<
    string | null,
    { call_count: number; pt: number; ct: number; tt: number; vnd: number }
  >()
  for (const r of byKindAndModel) {
    const k = r.usage_kind
    const cur = kindAgg.get(k) ?? { call_count: 0, pt: 0, ct: 0, tt: 0, vnd: 0 }
    cur.call_count += r.call_count
    cur.pt += r.sum_prompt_tokens
    cur.ct += r.sum_completion_tokens
    cur.tt += r.sum_total_tokens
    cur.vnd += r.estimated_cost_vnd
    kindAgg.set(k, cur)
  }
  const byKind: PartnerAiCostByKindRow[] = [...kindAgg.entries()]
    .map(([usage_kind, x]) => ({
      usage_kind,
      call_count: x.call_count,
      sum_prompt_tokens: x.pt,
      sum_completion_tokens: x.ct,
      sum_total_tokens: x.tt,
      estimated_cost_vnd: x.vnd,
    }))
    .sort((a, b) => b.estimated_cost_vnd - a.estimated_cost_vnd)

  const dayMap = new Map<
    string,
    { call_count: number; pt: number; ct: number; tt: number; vnd: number }
  >()
  let periodTotalEstimatedVnd = 0
  for (const r of dailyModelRows) {
    const vnd = rowCostAggregateShort(r.sum_prompt_tokens, r.sum_completion_tokens, r.model, usdToVnd)
    periodTotalEstimatedVnd += vnd
    const cur = dayMap.get(r.day_utc) ?? { call_count: 0, pt: 0, ct: 0, tt: 0, vnd: 0 }
    cur.call_count += r.call_count
    cur.pt += r.sum_prompt_tokens
    cur.ct += r.sum_completion_tokens
    cur.tt += r.sum_total_tokens
    cur.vnd += vnd
    dayMap.set(r.day_utc, cur)
  }

  const daily: PartnerAiCostDailyVndRow[] = [...dayMap.entries()]
    .map(([day_utc, x]) => ({
      day_utc,
      call_count: x.call_count,
      sum_prompt_tokens: x.pt,
      sum_completion_tokens: x.ct,
      sum_total_tokens: x.tt,
      estimated_cost_vnd: x.vnd,
    }))
    .sort((a, b) => (a.day_utc < b.day_utc ? 1 : a.day_utc > b.day_utc ? -1 : 0))

  const weekMap = new Map<
    string,
    { call_count: number; pt: number; ct: number; tt: number; vnd: number }
  >()
  for (const d of daily) {
    const wk = utcMondayOfDayUtc(d.day_utc)
    const cur = weekMap.get(wk) ?? { call_count: 0, pt: 0, ct: 0, tt: 0, vnd: 0 }
    cur.call_count += d.call_count
    cur.pt += d.sum_prompt_tokens
    cur.ct += d.sum_completion_tokens
    cur.tt += d.sum_total_tokens
    cur.vnd += d.estimated_cost_vnd
    weekMap.set(wk, cur)
  }
  const weekly: PartnerAiCostWeekVndRow[] = [...weekMap.entries()]
    .map(([week_start_utc, x]) => ({
      week_start_utc,
      call_count: x.call_count,
      sum_prompt_tokens: x.pt,
      sum_completion_tokens: x.ct,
      sum_total_tokens: x.tt,
      estimated_cost_vnd: x.vnd,
    }))
    .sort((a, b) => (a.week_start_utc < b.week_start_utc ? 1 : a.week_start_utc > b.week_start_utc ? -1 : 0))

  const monthMap = new Map<
    string,
    { call_count: number; pt: number; ct: number; tt: number; vnd: number }
  >()
  for (const d of daily) {
    const mk = d.day_utc.slice(0, 7)
    const cur = monthMap.get(mk) ?? { call_count: 0, pt: 0, ct: 0, tt: 0, vnd: 0 }
    cur.call_count += d.call_count
    cur.pt += d.sum_prompt_tokens
    cur.ct += d.sum_completion_tokens
    cur.tt += d.sum_total_tokens
    cur.vnd += d.estimated_cost_vnd
    monthMap.set(mk, cur)
  }
  const monthly: PartnerAiCostMonthVndRow[] = [...monthMap.entries()]
    .map(([month_utc, x]) => ({
      month_utc,
      call_count: x.call_count,
      sum_prompt_tokens: x.pt,
      sum_completion_tokens: x.ct,
      sum_total_tokens: x.tt,
      estimated_cost_vnd: x.vnd,
    }))
    .sort((a, b) => (a.month_utc < b.month_utc ? 1 : a.month_utc > b.month_utc ? -1 : 0))

  return {
    byKind,
    byKindAndModel,
    daily,
    weekly,
    monthly,
    periodTotalEstimatedVnd,
  }
}
