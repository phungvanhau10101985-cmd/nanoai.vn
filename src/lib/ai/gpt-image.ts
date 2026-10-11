import {
  GPT_IMAGE_MODEL,
  gptImageSizeForAspect,
  ImageEngineError,
  type GptImageQuality,
  type ImageEngine,
} from '@/lib/ai/image-engine'
import { billGptImageUsage, type GptImageLoggedUsage, type OpenAiImageUsage } from '@/lib/pricing/gpt-image-usage'

export type GptImageInput = {
  bytes: Buffer
  mimeType?: string
  filename?: string
}

const GPT_IMAGE_TIMEOUT_MS = 300_000

function openaiKey(): string {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) {
    throw new ImageEngineError('Thiếu OPENAI_API_KEY cho GPT Image.')
  }
  return key
}

function mimeToExt(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

async function readImageBuffer(res: Response): Promise<{ buffer: Buffer; usage: OpenAiImageUsage | null }> {
  if (!res.ok) {
    let detail = (await res.text().catch(() => '')).slice(0, 800)
    try {
      const errObj = JSON.parse(detail) as { error?: { message?: string } }
      if (errObj?.error?.message) detail = String(errObj.error.message).slice(0, 800)
    } catch {
      /* keep raw */
    }
    throw new ImageEngineError(`OpenAI image lỗi HTTP ${res.status}: ${detail}`)
  }
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>
    usage?: OpenAiImageUsage
  } | null
  const b64 = body?.data?.[0]?.b64_json
  if (!b64) throw new ImageEngineError('OpenAI không trả b64_json.')
  return { buffer: Buffer.from(b64, 'base64'), usage: body?.usage ?? null }
}

export type GptImageCallResult = {
  buffer: Buffer
  usage: GptImageLoggedUsage
}

/**
 * Không ảnh vào: `/v1/images/generations`. Có ảnh: `/v1/images/edits`.
 * `gpt-image-2` không nhận `input_fidelity`.
 */
export async function generateGptImage(opts: {
  prompt: string
  quality: GptImageQuality
  aspectRatio?: string | null
  images?: GptImageInput[]
}): Promise<GptImageCallResult> {
  const key = openaiKey()
  const images = (opts.images || []).filter((img) => img.bytes?.length)
  const size = gptImageSizeForAspect(opts.aspectRatio, images.length > 0)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), GPT_IMAGE_TIMEOUT_MS)
  try {
    if (images.length === 0) {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GPT_IMAGE_MODEL,
          prompt: opts.prompt,
          n: 1,
          size,
          quality: opts.quality,
        }),
        signal: ac.signal,
      })
      const read = await readImageBuffer(res)
      return {
        buffer: read.buffer,
        usage: billGptImageUsage({
          quality: opts.quality,
          size,
          prompt: opts.prompt,
          usage: read.usage,
        }),
      }
    }
    const form = new FormData()
    form.set('model', GPT_IMAGE_MODEL)
    form.set('prompt', opts.prompt)
    form.set('n', '1')
    form.set('size', size)
    form.set('quality', opts.quality)
    images.forEach((img, index) => {
      const mime = img.mimeType || 'image/png'
      const filename = img.filename || `input-${index + 1}.${mimeToExt(mime)}`
      form.append('image', new Blob([new Uint8Array(img.bytes)], { type: mime }), filename)
    })
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ac.signal,
    })
    const read = await readImageBuffer(res)
    return {
      buffer: read.buffer,
      usage: billGptImageUsage({
        quality: opts.quality,
        size,
        prompt: opts.prompt,
        usage: read.usage,
      }),
    }
  } catch (e) {
    if (e instanceof ImageEngineError) throw e
    const message = e instanceof Error ? e.message : String(e)
    if (/abort/i.test(message)) throw new ImageEngineError('GPT Image quá thời gian chờ.')
    throw new ImageEngineError(`GPT Image thất bại: ${message}`)
  } finally {
    clearTimeout(timer)
  }
}

type GeminiShaped = {
  response: {
    usageMetadata: GptImageLoggedUsage
    candidates: Array<{ content: { parts: Array<{ inlineData: { data: string; mimeType: string } }> } }>
  }
}

function splitGeminiParts(parts: unknown[]): { prompt: string; images: GptImageInput[] } {
  const texts: string[] = []
  const images: GptImageInput[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part)
      continue
    }
    if (!part || typeof part !== 'object') continue
    if ('text' in part && typeof (part as { text?: unknown }).text === 'string') {
      texts.push((part as { text: string }).text)
    }
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData
    if (inline?.data) {
      images.push({
        bytes: Buffer.from(inline.data, 'base64'),
        mimeType: inline.mimeType || 'image/png',
      })
    }
  }
  return { prompt: texts.join('\n\n'), images }
}

function geminiShapeFromBuffer(buffer: Buffer, usage: GptImageLoggedUsage): GeminiShaped {
  return {
    response: {
      usageMetadata: usage,
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: buffer.toString('base64'), mimeType: 'image/png' } }],
          },
        },
      ],
    },
  }
}

/** GPT trả cùng dạng `generateContent` để action cũ đọc `inlineData`. Gemini gọi callback nguyên. */
export async function runImageContent<T>(opts: {
  engine: ImageEngine
  gptQuality: GptImageQuality | null
  aspectRatio?: string | null
  parts: unknown[]
  gemini: () => Promise<T>
}): Promise<T> {
  if (opts.engine !== 'gpt') return opts.gemini()
  if (!opts.gptQuality) throw new ImageEngineError('Chọn chất lượng GPT: low, medium hoặc high.')
  const { prompt, images } = splitGeminiParts(opts.parts)
  if (!prompt.trim()) throw new ImageEngineError('Thiếu prompt GPT Image.')
  const generated = await generateGptImage({
    prompt,
    quality: opts.gptQuality,
    aspectRatio: opts.aspectRatio,
    images,
  })
  return geminiShapeFromBuffer(generated.buffer, generated.usage) as T
}

/** GPT gọi OpenAI. Gemini chạy `gemini` và không đụng prompt hay model cũ. */
export async function produceImageBytes(opts: {
  engine: ImageEngine
  gptQuality: GptImageQuality | null
  prompt: string
  aspectRatio?: string | null
  images?: GptImageInput[]
  gemini: () => Promise<Buffer>
}): Promise<Buffer> {
  if (opts.engine !== 'gpt') return opts.gemini()
  if (!opts.gptQuality) throw new ImageEngineError('Chọn chất lượng GPT: low, medium hoặc high.')
  const generated = await generateGptImage({
    prompt: opts.prompt,
    quality: opts.gptQuality,
    aspectRatio: opts.aspectRatio,
    images: opts.images,
  })
  return generated.buffer
}
