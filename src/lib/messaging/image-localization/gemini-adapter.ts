import {
  imageLocGeminiApiTimeoutMs,
  imageLocGeminiImageModel,
  languagePrompt,
  mimeForImageFilename,
  normalizeGeminiImageSize,
  sanitizeModelId,
} from './image-localization-config'

const GEMINI_GENERATE_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class ImageLocalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageLocalizationError'
  }
}

export class ImageLocalizationFatalDependencyError extends ImageLocalizationError {
  constructor(message: string) {
    super(message)
    this.name = 'ImageLocalizationFatalDependencyError'
  }
}

const FATAL_MARKERS = [
  'IMAGE_LOCALIZATION_FATAL_DEPENDENCY',
  'FatalDependencyError',
  'insufficient balance',
  'payment required',
  'resource_exhausted',
  'resource exhausted',
  'quota exceeded',
  'billing not enabled',
  'billing_disabled',
  'deepseek_missing_key',
]

export function isImageLocalizationFatalDependencyError(exc: unknown): boolean {
  const msg = exc instanceof Error ? `${exc.name}: ${exc.message}` : String(exc || '')
  const lower = msg.toLowerCase()
  return FATAL_MARKERS.some((m) => lower.includes(m.toLowerCase()))
}

export function raiseIfFatalDependency(exc: unknown): void {
  if (isImageLocalizationFatalDependencyError(exc)) {
    throw new ImageLocalizationFatalDependencyError(exc instanceof Error ? exc.message : String(exc))
  }
}

function extractFirstImageBytes(data: Record<string, unknown>): Buffer | null {
  const cands = Array.isArray(data.candidates) ? data.candidates : []
  if (!cands.length) return null
  const first = cands[0] as Record<string, unknown>
  const content = (first.content || {}) as Record<string, unknown>
  const parts = Array.isArray(content.parts) ? content.parts : []
  for (const raw of parts) {
    if (!raw || typeof raw !== 'object') continue
    const part = raw as Record<string, unknown>
    const inline = (part.inlineData || part.inline_data || {}) as Record<string, unknown>
    const b64 = typeof inline.data === 'string' ? inline.data : ''
    if (b64) {
      try {
        return Buffer.from(b64, 'base64')
      } catch {
        /* ignore */
      }
    }
  }
  return null
}

export function geminiApiAuth(model?: string | null) {
  const key = (process.env.GEMINI_API_KEY || '').trim()
  return {
    ready: key.length >= 10,
    key_configured: Boolean(key),
    model: sanitizeModelId(model, imageLocGeminiImageModel()),
  }
}

export async function geminiProcessImage(opts: {
  imageBytes: Buffer
  filename: string
  language: string
  imageModel?: string | null
  imageSize?: string | null
}): Promise<{ status: 'processed'; bytes: Buffer; message: string }> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (apiKey.length < 10) throw new ImageLocalizationError('Thiếu GEMINI_API_KEY cho chế độ Gemini API.')
  const model = sanitizeModelId(opts.imageModel, imageLocGeminiImageModel())
  const timeout = imageLocGeminiApiTimeoutMs()
  const url = `${GEMINI_GENERATE_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const prompt = languagePrompt(opts.language)
  const mime = mimeForImageFilename(opts.filename)
  const size = normalizeGeminiImageSize(opts.imageSize) || undefined
  const genCfg: Record<string, unknown> = { responseModalities: ['TEXT', 'IMAGE'] }
  if (size) genCfg.imageConfig = { imageSize: size }
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: opts.imageBytes.toString('base64') } },
        ],
      },
    ],
    generationConfig: genCfg,
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ImageLocalizationError(`Gemini API ảnh lỗi HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) throw new ImageLocalizationError('Gemini API trả JSON không đọc được')
  const fb = (body.promptFeedback || body.prompt_feedback || {}) as Record<string, unknown>
  const br = fb.blockReason || fb.block_reason
  if (br) throw new ImageLocalizationError(`Gemini API từ chối prompt: ${String(br)}`)
  const out = extractFirstImageBytes(body)
  if (!out) {
    throw new ImageLocalizationError(
      'Gemini API không trả ảnh (kiểm tra model sinh ảnh, ví dụ gemini-3-pro-image-preview).'
    )
  }
  return { status: 'processed', bytes: out, message: 'Gemini API (Nano Banana) đã xử lý ảnh' }
}
