/** Chọn Gemini, GPT Image 2 hoặc FLUX 3 cho một lần tạo ảnh. Không gọi mạng. */

export type ImageEngine = 'gemini' | 'gpt' | 'flux'
export type GeminiImageQuality = '2K' | '4K'
export type FluxImageQuality = '1.5K' | '2K' | '4K'
export type GptImageQuality = 'low' | 'medium' | 'high'

export const GPT_IMAGE_MODEL = 'gpt-image-2'

export const GPT_IMAGE_CREDITS: Record<GptImageQuality, number> = {
  low: 0.5,
  medium: 1,
  high: 2,
}

/**
 * FLUX 3, khách thấy NanoAI F1.5K / F2K / F4K. 1 credit = 6.000đ.
 * Phí API: F1.5K ~2 MP = $0,07 (~1.800đ), F2K ~4 MP = $0,10 (~2.600đ), F4K ~16,8 MP = $0,607 (~15.800đ).
 * Giá trừ credit: F1.5K = 1 (6.000đ), F2K = 1,5 (9.000đ), F4K = 6 (36.000đ).
 */
export const FLUX_IMAGE_CREDITS: Record<FluxImageQuality, number> = {
  '1.5K': 1,
  '2K': 1.5,
  '4K': 6,
}

export class ImageEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageEngineError'
  }
}

export function parseImageEngine(raw: unknown): ImageEngine {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'gpt') return 'gpt'
  if (value === 'flux') return 'flux'
  return 'gemini'
}

export function imageEngineNeedsGemini(engine: ImageEngine): boolean {
  return engine === 'gemini'
}

export function parseGeminiImageQuality(raw: unknown): GeminiImageQuality {
  return String(raw ?? '').trim().toUpperCase() === '4K' ? '4K' : '2K'
}

/** FLUX: 4K, 1.5K (kể cả 1,5K). 1K và giá trị lạ vẫn tính 2K. */
export function parseFluxImageQuality(raw: unknown): FluxImageQuality {
  const value = String(raw ?? '').trim().toUpperCase().replace(',', '.')
  if (value === '4K') return '4K'
  if (value === '1.5K') return '1.5K'
  return '2K'
}

/** Hub studio: chỉ đẩy 4K và 1.5K. Thiếu hoặc 2K để pipeline mặc định 2K. */
export function requestedStudioImageSize(raw: unknown): '1.5K' | '4K' | undefined {
  const value = String(raw ?? '').trim().toUpperCase().replace(',', '.')
  if (value === '4K') return '4K'
  if (value === '1.5K') return '1.5K'
  return undefined
}

/** Thiết kế hộp không dùng NanoAI 2L. GPT thấp nhất là medium. Gemini không có 1.5K. FLUX giữ 1.5K. */
export function boxDesignImageTier(input: {
  gptQuality?: string | null
  imageQuality?: string | null
}): { gptQuality: string | null | undefined; imageQuality: FluxImageQuality } {
  const gpt = String(input.gptQuality ?? '').trim().toLowerCase()
  return {
    gptQuality: gpt === 'low' ? 'medium' : input.gptQuality,
    imageQuality: parseFluxImageQuality(input.imageQuality),
  }
}

/** `low` giữ nguyên. Giá trị lạ trả null để server từ chối, không nâng chất lượng. */
export function parseGptImageQuality(raw: unknown): GptImageQuality | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'low' || s === 'medium' || s === 'high') return s
  return null
}

function roundCredit(value: number): number {
  return Math.round(value * 10) / 10
}

/** Giá NanoAI 4K của một tool = gấp đôi giá NanoAI 2K của tool đó. */
export function geminiQualityCredit(cost2k: number, quality: unknown): number {
  return parseGeminiImageQuality(quality) === '4K' ? roundCredit(cost2k * 2) : cost2k
}

/**
 * Credit sẽ trừ.
 * Gemini: `geminiCost` là giá một ảnh của tool (2K hoặc 4K), nhân `outputCount`.
 * Thiếu engine thì coi là Gemini.
 * GPT: 0,5 / 1 / 2 mỗi ảnh ra, không nhân theo giá Gemini.
 */
export function imageEngineCredit(input: {
  engine?: string | null
  gptQuality?: string | null
  /** FLUX dùng 1.5K, 2K hoặc 4K. Thiếu thì FLUX tính 2K. */
  imageQuality?: string | null
  geminiCost: number
  outputCount?: number
}): number {
  const count = input.outputCount == null ? 1 : Math.max(0, Math.floor(input.outputCount))
  const engine = parseImageEngine(input.engine)
  if (engine === 'gpt') {
    const quality = parseGptImageQuality(input.gptQuality)
    if (!quality) throw new ImageEngineError('GPT_QUALITY_INVALID')
    return roundCredit(GPT_IMAGE_CREDITS[quality] * count)
  }
  if (engine === 'flux') {
    const quality = parseFluxImageQuality(input.imageQuality)
    return roundCredit(FLUX_IMAGE_CREDITS[quality] * count)
  }
  return roundCredit(input.geminiCost * count)
}

export type ImageEngineSelection = {
  engine: ImageEngine
  geminiQuality: FluxImageQuality
  gptQuality: GptImageQuality | null
  fluxQuality: FluxImageQuality | null
  cost: number
  error?: string
}

/** Đọc form. GPT thiếu hoặc sai quality thì `error`, không fallback Gemini. */
export function imageChargeFromForm(
  formData: { get(name: string): unknown },
  geminiUnitCost: number,
  outputCount = 1,
): ImageEngineSelection {
  const engine = parseImageEngine(formData.get('imageEngine'))
  const rawQuality = formData.get('imageQuality')
  const parsedGemini = parseGeminiImageQuality(rawQuality)
  const parsedFlux = parseFluxImageQuality(rawQuality)
  const geminiQuality: FluxImageQuality = engine === 'flux' ? parsedFlux : parsedGemini
  const gptQuality = parseGptImageQuality(formData.get('gptQuality'))
  const fluxQuality: FluxImageQuality | null = engine === 'flux' ? parsedFlux : null
  if (engine === 'gpt' && !gptQuality) {
    return {
      engine,
      geminiQuality,
      gptQuality: null,
      fluxQuality: null,
      cost: 0,
      error: 'Chọn NanoAI 2L, NanoAI 2M hoặc NanoAI 2H.',
    }
  }
  try {
    const cost = imageEngineCredit({
      engine,
      gptQuality,
      imageQuality: geminiQuality,
      geminiCost: geminiUnitCost,
      outputCount,
    })
    return { engine, geminiQuality, gptQuality, fluxQuality, cost }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { engine, geminiQuality, gptQuality, fluxQuality, cost: 0, error: message }
  }
}

const GPT_PORTRAIT = new Set(['2:3', '3:4', '4:5', '9:16', '9:21'])
const GPT_LANDSCAPE = new Set(['3:2', '4:3', '5:4', '16:9', '21:9'])

/**
 * Size GPT Image 2 thực sự trả về: 1024×1024, 1024×1536 (2:3), 1536×1024 (3:2).
 * Không gửi size tùy mm — API sẽ làm tròn và ảnh bị kéo.
 */
export function gptImageSizeForAspect(aspectRatio?: string | null, hasInputImage = false): string {
  const aspect = String(aspectRatio || '').trim()
  if (!aspect) return hasInputImage ? 'auto' : '1024x1024'
  if (aspect === '1:1') return '1024x1024'
  if (GPT_PORTRAIT.has(aspect)) return '1024x1536'
  if (GPT_LANDSCAPE.has(aspect)) return '1536x1024'
  return hasInputImage ? 'auto' : '1024x1024'
}
