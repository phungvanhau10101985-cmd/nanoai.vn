import {
  imageLocOpenaiImageModel,
  imageLocOpenaiTimeoutMs,
  languagePrompt,
  mimeForImageFilename,
  normalizeOpenaiImageQuality,
  normalizeOpenaiImageSize,
  sanitizeModelId,
} from './image-localization-config'
import { ImageLocalizationError } from './gemini-adapter'
import { billGptImageUsage, type GptImageUsageQuality } from '@/lib/pricing/gpt-image-usage'
import { trackApiUsage } from '@/lib/track-ai-usage'

/** GPT Image lỗi: job phải dừng, không xử lý sản phẩm phía sau. */
export class ImageLocalizationGptStopError extends ImageLocalizationError {
  constructor(message: string) {
    super(message)
    this.name = 'ImageLocalizationGptStopError'
  }
}

export function isImageLocalizationGptStopError(exc: unknown): boolean {
  return exc instanceof ImageLocalizationGptStopError || (exc instanceof Error && exc.name === 'ImageLocalizationGptStopError')
}

export function openaiApiAuth(model?: string | null) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  return {
    ready: key.length >= 10,
    key_configured: Boolean(key),
    model: sanitizeModelId(model, imageLocOpenaiImageModel()),
  }
}

export async function openaiProcessImage(opts: {
  imageBytes: Buffer
  filename: string
  language: string
  imageModel?: string | null
  imageQuality?: string | null
  imageSize?: string | null
  removeModel?: boolean
}): Promise<{ status: 'processed'; bytes: Buffer; message: string }> {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) throw new ImageLocalizationError('Thiếu OPENAI_API_KEY cho chế độ GPT Image.')
  const model = sanitizeModelId(opts.imageModel, imageLocOpenaiImageModel())
  const timeout = imageLocOpenaiTimeoutMs()
  const mime = mimeForImageFilename(opts.filename)
  let safeName = (opts.filename.split(/[/\\]/).pop() || 'product.jpg').trim()
  if (!safeName.includes('.')) safeName = `${safeName}.jpg`
  const prompt = languagePrompt(opts.language, { removeModel: opts.removeModel })
  const form = new FormData()
  form.set('model', model)
  form.set('prompt', prompt)
  form.set('n', '1')
  const blob = new Blob([new Uint8Array(opts.imageBytes)], { type: mime })
  form.set('image', blob, safeName)
  const isG2 = model.toLowerCase().includes('gpt-image-2')
  const size = normalizeOpenaiImageSize(opts.imageSize, model)
  if (isG2) form.set('size', size || 'auto')
  else if (size) form.set('size', size)
  const quality = normalizeOpenaiImageQuality(opts.imageQuality)
  if (quality) form.set('quality', quality)
  if (!isG2) form.set('input_fidelity', 'high')

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ac.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = (await res.text().catch(() => '')).slice(0, 800)
    try {
      const errObj = JSON.parse(detail) as { error?: { message?: string } }
      if (errObj?.error?.message) detail = String(errObj.error.message).slice(0, 800)
    } catch {
      /* keep */
    }
    throw new ImageLocalizationError(`OpenAI images/edits lỗi HTTP ${res.status}: ${detail}`)
  }
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>
    usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { text_tokens?: number; image_tokens?: number } }
  } | null
  const b64 = body?.data?.[0]?.b64_json
  if (!b64) throw new ImageLocalizationError('OpenAI không trả b64_json (kiểm tra model GPT Image).')
  const billedQuality = (
    quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto' ? quality : 'medium'
  ) as GptImageUsageQuality
  if (isG2) {
    const billed = billGptImageUsage({
      quality: billedQuality,
      size: size || 'auto',
      prompt,
      usage: body?.usage,
    })
    void trackApiUsage({
      model: billed.logModel,
      feature: 'image-localization',
      promptTokenCount: billed.promptTokenCount,
      candidatesTokenCount: billed.candidatesTokenCount,
      totalTokenCount: billed.totalTokenCount,
      imageSize: billed.logImageSize,
    })
  }
  try {
    return { status: 'processed', bytes: Buffer.from(b64, 'base64'), message: 'OpenAI GPT Image đã xử lý ảnh' }
  } catch (e) {
    throw new ImageLocalizationError(`Không decode base64 ảnh OpenAI: ${e instanceof Error ? e.message : String(e)}`)
  }
}
