/** Chọn Gemini hoặc GPT Image 2 cho một lần tạo ảnh. Không gọi mạng. */

export type ImageEngine = 'gemini' | 'gpt'
export type GeminiImageQuality = '2K' | '4K'
export type GptImageQuality = 'low' | 'medium' | 'high'

export const GPT_IMAGE_MODEL = 'gpt-image-2'

export const GPT_IMAGE_CREDITS: Record<GptImageQuality, number> = {
  low: 0.5,
  medium: 1,
  high: 2,
}

export class ImageEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageEngineError'
  }
}

export function parseImageEngine(raw: unknown): ImageEngine {
  return String(raw ?? '').trim().toLowerCase() === 'gpt' ? 'gpt' : 'gemini'
}

export function parseGeminiImageQuality(raw: unknown): GeminiImageQuality {
  return String(raw ?? '').trim().toUpperCase() === '4K' ? '4K' : '2K'
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

/**
 * Credit sẽ trừ.
 * Gemini: `geminiCost` là giá một ảnh của tool (2K hoặc 4K), nhân `outputCount`.
 * Thiếu engine thì coi là Gemini.
 * GPT: 0,5 / 1 / 2 mỗi ảnh ra, không nhân theo giá Gemini.
 */
export function imageEngineCredit(input: {
  engine?: string | null
  gptQuality?: string | null
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
  return roundCredit(input.geminiCost * count)
}

export type ImageEngineSelection = {
  engine: ImageEngine
  geminiQuality: GeminiImageQuality
  gptQuality: GptImageQuality | null
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
  const geminiQuality = parseGeminiImageQuality(formData.get('imageQuality'))
  const gptQuality = parseGptImageQuality(formData.get('gptQuality'))
  if (engine === 'gpt' && !gptQuality) {
    return {
      engine,
      geminiQuality,
      gptQuality: null,
      cost: 0,
      error: 'Chọn chất lượng GPT: low, medium hoặc high.',
    }
  }
  try {
    const cost = imageEngineCredit({
      engine,
      gptQuality,
      geminiCost: geminiUnitCost,
      outputCount,
    })
    return { engine, geminiQuality, gptQuality, cost }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { engine, geminiQuality, gptQuality, cost: 0, error: message }
  }
}

const GPT_PORTRAIT = new Set(['2:3', '3:4', '4:5', '9:16'])
const GPT_LANDSCAPE = new Set(['3:2', '4:3', '5:4', '16:9', '21:9'])

/** Size GPT Image 2. Không dùng 2K/4K của Gemini. */
export function gptImageSizeForAspect(aspectRatio?: string | null, hasInputImage = false): string {
  const aspect = String(aspectRatio || '').trim()
  if (!aspect) return hasInputImage ? 'auto' : '1024x1024'
  if (aspect === '1:1') return '1024x1024'
  if (GPT_PORTRAIT.has(aspect)) return '1024x1536'
  if (GPT_LANDSCAPE.has(aspect)) return '1536x1024'
  return hasInputImage ? 'auto' : '1024x1024'
}
