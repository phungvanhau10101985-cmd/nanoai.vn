/** Chi phí API — theo bảng giá Google Gemini (ước tính). Tỷ giá USD→VND dùng cho admin. */
export const IMAGE_TOKENS = { '1K': 1120, '2K': 1120, '4K': 2000 } as const

export const API_COST_PER_1M: Record<string, { input: number; output: number; outputImage?: number }> = {
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
}

export const USD_TO_VND = 25_000

export function calcCostVnd(
  promptTokens: number,
  outputTokens: number,
  model: string,
  imageSize?: string | null
): number {
  const rates = API_COST_PER_1M[model] ?? API_COST_PER_1M['gemini-3-flash-preview']
  const isImage = imageSize === '1K' || imageSize === '2K' || imageSize === '4K'
  const outputRate = rates.outputImage && isImage ? rates.outputImage : rates.output
  const effectiveOutputTokens =
    isImage && rates.outputImage && imageSize && imageSize in IMAGE_TOKENS
      ? IMAGE_TOKENS[imageSize as keyof typeof IMAGE_TOKENS]
      : outputTokens
  const usd = (promptTokens / 1_000_000) * rates.input + (effectiveOutputTokens / 1_000_000) * outputRate
  return Math.round(usd * USD_TO_VND)
}
