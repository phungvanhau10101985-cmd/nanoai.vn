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
import { billGptImageUsage, type GptImageUsageQuality, type OpenAiImageUsage } from '@/lib/pricing/gpt-image-usage'
import { trackApiUsage } from '@/lib/track-ai-usage'

const OPENAI_IMAGE_ATTEMPTS = 2
const OPENAI_IMAGE_RETRY_DELAY_MS = 400

/** Giải base64 theo khối 1MB để không giữ một chuỗi UTF-16 bằng cả file ảnh. */
function decodeBase64Ascii(ascii: Buffer): Buffer {
  const chunkSize = 1024 * 1024
  if (ascii.length <= chunkSize) return Buffer.from(ascii.toString('latin1'), 'base64')
  const parts: Buffer[] = []
  for (let offset = 0; offset < ascii.length; offset += chunkSize) {
    const end = Math.min(ascii.length, offset + chunkSize)
    parts.push(Buffer.from(ascii.subarray(offset, end).toString('latin1'), 'base64'))
  }
  return Buffer.concat(parts)
}

function sliceJsonStringField(raw: Buffer, field: string): { value: Buffer | null; broken: boolean } {
  const marker = Buffer.from(`"${field}"`)
  const idx = raw.indexOf(marker)
  if (idx < 0) return { value: null, broken: false }
  let cursor = idx + marker.length
  while (
    cursor < raw.length &&
    (raw[cursor] === 0x20 || raw[cursor] === 0x09 || raw[cursor] === 0x0a || raw[cursor] === 0x0d || raw[cursor] === 0x3a)
  ) {
    cursor += 1
  }
  if (raw[cursor] !== 0x22) return { value: null, broken: false }
  const start = cursor + 1
  const end = raw.indexOf(0x22, start)
  if (end < 0) return { value: null, broken: true }
  return { value: raw.subarray(start, end), broken: false }
}

function readUsageObject(raw: Buffer): OpenAiImageUsage | null {
  const marker = Buffer.from('"usage"')
  const idx = raw.lastIndexOf(marker)
  if (idx < 0) return null
  const slice = raw.subarray(idx, Math.min(raw.length, idx + 2000)).toString('utf8')
  const start = slice.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < slice.length; i += 1) {
    const ch = slice[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(slice.slice(start, i + 1)) as OpenAiImageUsage
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function explainMissingImage(raw: Buffer, broken: boolean): string {
  if (broken) return `b64_json bị cắt (body ${raw.length} bytes)`
  if (raw.length === 0) return 'body rỗng'
  if (raw.length <= 8000) {
    try {
      const obj = JSON.parse(raw.toString('utf8')) as { error?: { message?: string } }
      const message = obj?.error?.message
      if (message) return String(message).slice(0, 400)
    } catch {
      /* giữ phần đầu body */
    }
  }
  const head = raw.subarray(0, 300).toString('utf8').replace(/\s+/g, ' ').trim()
  return head ? head.slice(0, 300) : `body ${raw.length} bytes`
}

function isRetryableOpenAiImageError(message: string): boolean {
  if (/HTTP 400|HTTP 401|HTTP 403|HTTP 404/.test(message)) return false
  if (/quá thời gian chờ/.test(message)) return false
  if (/moderation|safety system|content policy/i.test(message)) return false
  return /không trả b64_json|HTTP 408|HTTP 409|HTTP 429|HTTP 5\d\d|lỗi mạng/i.test(message)
}

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
  const isG2 = model.toLowerCase().includes('gpt-image-2')
  const size = normalizeOpenaiImageSize(opts.imageSize, model)
  const quality = normalizeOpenaiImageQuality(opts.imageQuality)
  const buildForm = () => {
    const form = new FormData()
    form.set('model', model)
    form.set('prompt', prompt)
    form.set('n', '1')
    form.set('image', new Blob([new Uint8Array(opts.imageBytes)], { type: mime }), safeName)
    if (isG2) form.set('size', size || 'auto')
    else if (size) form.set('size', size)
    if (quality) form.set('quality', quality)
    if (!isG2) form.set('input_fidelity', 'high')
    return form
  }

  const billedQuality = (
    quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto' ? quality : 'medium'
  ) as GptImageUsageQuality

  const once = async (): Promise<{ status: 'processed'; bytes: Buffer; message: string }> => {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeout)
    let res: Response
    try {
      res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: buildForm(),
        signal: ac.signal,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (/abort/i.test(message)) throw new ImageLocalizationError('OpenAI images/edits quá thời gian chờ.')
      throw new ImageLocalizationError(`OpenAI images/edits lỗi mạng: ${message}`)
    } finally {
      clearTimeout(timer)
    }
    // Không res.json(): chuỗi base64 ~1.5MB bị nhân đôi trong heap worker 1GB, parse ném lỗi rồi bị nuốt thành «không trả b64_json».
    const raw = Buffer.from(await res.arrayBuffer())
    if (!res.ok) {
      throw new ImageLocalizationError(`OpenAI images/edits lỗi HTTP ${res.status}: ${explainMissingImage(raw, false).slice(0, 800)}`)
    }
    const sliced = sliceJsonStringField(raw, 'b64_json')
    if (!sliced.value || sliced.value.length === 0) {
      throw new ImageLocalizationError(`OpenAI không trả b64_json: ${explainMissingImage(raw, sliced.broken)}`)
    }
    const bytes = decodeBase64Ascii(sliced.value)
    if (isG2) {
      const billed = billGptImageUsage({
        quality: billedQuality,
        size: size || 'auto',
        prompt,
        usage: readUsageObject(raw),
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
    return { status: 'processed', bytes, message: 'OpenAI GPT Image đã xử lý ảnh' }
  }

  let last: ImageLocalizationError | null = null
  for (let attempt = 1; attempt <= OPENAI_IMAGE_ATTEMPTS; attempt += 1) {
    try {
      return await once()
    } catch (e) {
      const error = e instanceof ImageLocalizationError ? e : new ImageLocalizationError(e instanceof Error ? e.message : String(e))
      last = error
      const retry = attempt < OPENAI_IMAGE_ATTEMPTS && isRetryableOpenAiImageError(error.message)
      console.warn(`[image-localization] GPT Image lần ${attempt}: ${error.message.slice(0, 400)}`)
      if (!retry) throw error
      await new Promise((resolve) => setTimeout(resolve, OPENAI_IMAGE_RETRY_DELAY_MS))
    }
  }
  throw last ?? new ImageLocalizationError('OpenAI không trả b64_json: không rõ phản hồi')
}
