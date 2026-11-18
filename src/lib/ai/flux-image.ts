import sharp from 'sharp'
import { ImageEngineError, parseFluxImageQuality, type FluxImageQuality } from '@/lib/ai/image-engine'
import { publicFluxImageName } from '@/lib/ai/nanoai-image-names'
import { closestFluxAspectRatio, type FluxPixelSize } from '@/lib/ai/flux-image-size'

export const FLUX_IMAGE_MODEL = 'flux-3-image'
const FLUX_ENDPOINT = `https://api.bfl.ai/v1/${FLUX_IMAGE_MODEL}`
const POLL_INTERVAL_MS = 1_500
const TIMEOUT_MS = 5 * 60 * 1000
const MAX_REFERENCE_SIDE = 2048

export type FluxImageBytes = {
  bytes: Buffer
  mimeType?: string
}

export type FluxImageCallResult = {
  buffer: Buffer
  cost: number | null
  id: string
  width: number
  height: number
  usage: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
    logModel: 'NanoAI F1.5K' | 'NanoAI F2K' | 'NanoAI F4K'
    logImageSize: 'F1.5K' | 'F2K' | 'F4K'
  }
}

function bflKey(): string {
  const key = (process.env.BFL_API_KEY || '').trim()
  if (key.length < 10) throw new ImageEngineError('Thiếu BFL_API_KEY cho FLUX 3.')
  return key
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function assertBflPollUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ImageEngineError('FLUX 3 trả về đường dẫn theo dõi không hợp lệ.')
  }
  const host = url.hostname.toLowerCase()
  const allowed = host === 'bfl.ai' || host.endsWith('.bfl.ai') || host === 'bfl.ml' || host.endsWith('.bfl.ml')
  if (url.protocol !== 'https:' || !allowed) {
    throw new ImageEngineError('FLUX 3 trả về đường dẫn theo dõi không hợp lệ.')
  }
  return url.toString()
}

function fluxError(status: number, body: string): ImageEngineError {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 300)
  if (status === 402) return new ImageEngineError('Hết credit FLUX 3. Báo admin nạp thêm.')
  if (status === 422) return new ImageEngineError(`FLUX 3 từ chối tham số${detail ? `: ${detail}` : '.'}`)
  if (status === 429) return new ImageEngineError('FLUX 3 đang bận. Thử lại sau ít phút.')
  return new ImageEngineError(`FLUX 3 lỗi HTTP ${status}${detail ? `: ${detail}` : '.'}`)
}

function moderationError(status: string): ImageEngineError {
  if (status === 'Request Moderated' || status === 'Content Moderated') {
    return new ImageEngineError('FLUX 3 chặn nội dung này. Đổi mô tả rồi tạo lại.')
  }
  return new ImageEngineError(`FLUX 3 không tạo được ảnh (${status}).`)
}

async function readJson(res: Response): Promise<{ status: number; body: string; json: Record<string, unknown> | null }> {
  const body = await res.text()
  try {
    return { status: res.status, body, json: JSON.parse(body) as Record<string, unknown> }
  } catch {
    return { status: res.status, body, json: null }
  }
}

async function referenceBase64(image: FluxImageBytes): Promise<string> {
  const input = sharp(image.bytes, { failOn: 'none' }).rotate()
  const meta = await input.metadata()
  const long = Math.max(meta.width || 0, meta.height || 0)
  const resized =
    long > MAX_REFERENCE_SIDE
      ? input.resize({
          width: meta.width && meta.width >= (meta.height || 0) ? MAX_REFERENCE_SIDE : undefined,
          height: meta.height && meta.height > (meta.width || 0) ? MAX_REFERENCE_SIDE : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : input
  const png = await resized.png().toBuffer()
  return png.toString('base64')
}

function promptWithImages(prompt: string, count: number): string {
  const text = prompt.trim()
  if (count <= 0) return text
  const names = Array.from({ length: count }, (_, index) => `Image ${index + 1}`).join(', ')
  return `${text}\n\nReference images are attached in this order: ${names}.`
}

function estimatedBflCredits(quality: FluxImageQuality): number {
  if (quality === '4K') return 60.7
  if (quality === '1.5K') return 7
  return 10
}

function fluxResolution(quality: FluxImageQuality): '1.5k' | '2k' | '4k' {
  if (quality === '4K') return '4k'
  if (quality === '1.5K') return '1.5k'
  return '2k'
}

function fluxLogSize(quality: FluxImageQuality): 'F1.5K' | 'F2K' | 'F4K' {
  if (quality === '4K') return 'F4K'
  if (quality === '1.5K') return 'F1.5K'
  return 'F2K'
}

/**
 * Gửi FLUX 3, hỏi kết quả, tải ảnh về ngay.
 * Có width/height thì bỏ resolution và aspect_ratio.
 * Không có kích thước riêng thì resolution là 1.5k, 2k hoặc 4k.
 */
export async function generateFluxImage(opts: {
  prompt: string
  quality: FluxImageQuality
  aspectRatio?: string | null
  size?: FluxPixelSize | null
  images?: FluxImageBytes[]
  pollIntervalMs?: number
}): Promise<FluxImageCallResult> {
  const key = bflKey()
  const prompt = String(opts.prompt || '').trim()
  if (!prompt) throw new ImageEngineError('Thiếu mô tả ảnh.')
  const images = (opts.images || []).filter((image) => image.bytes?.length).slice(0, 10)
  const quality = parseFluxImageQuality(opts.quality)
  const payload: Record<string, unknown> = {
    prompt: promptWithImages(prompt, images.length),
    grounding: false,
  }
  if (opts.size && opts.size.width > 0 && opts.size.height > 0) {
    payload.width = opts.size.width
    payload.height = opts.size.height
  } else {
    payload.resolution = fluxResolution(quality)
    payload.aspect_ratio = closestFluxAspectRatio(opts.aspectRatio)
  }
  if (images.length) {
    payload.images = await Promise.all(images.map((image) => referenceBase64(image)))
  }

  const headers = { 'x-key': key, 'Content-Type': 'application/json' }
  let submit: { status: number; body: string; json: Record<string, unknown> | null } | null = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(FLUX_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    submit = await readJson(res)
    if (submit.status !== 429) break
    if (attempt === 3) throw fluxError(429, submit.body)
    await sleep((opts.pollIntervalMs ?? POLL_INTERVAL_MS) * (attempt + 1) || 1)
  }
  if (!submit || !submit.json || submit.status < 200 || submit.status >= 300) {
    throw fluxError(submit?.status || 0, submit?.body || '')
  }
  const pollingUrl = assertBflPollUrl(String(submit.json.polling_url || ''))
  const id = String(submit.json.id || '')
  let cost = typeof submit.json.cost === 'number' ? submit.json.cost : null
  const deadline = Date.now() + TIMEOUT_MS
  let sample = ''
  while (Date.now() <= deadline) {
    await sleep(opts.pollIntervalMs ?? POLL_INTERVAL_MS)
    const res = await fetch(pollingUrl, { headers: { 'x-key': key, Accept: 'application/json' }, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      throw new ImageEngineError('FLUX 3 chuyển hướng theo dõi ra ngoài.')
    }
    const polled = await readJson(res)
    if (polled.status === 429) continue
    if (polled.status < 200 || polled.status >= 300 || !polled.json) throw fluxError(polled.status, polled.body)
    const status = String(polled.json.status || '')
    if (typeof polled.json.cost === 'number') cost = polled.json.cost
    if (status === 'Pending' || status === 'Reasoning' || status === 'Generating') continue
    if (status !== 'Ready') throw moderationError(status || 'Error')
    const result = polled.json.result
    sample =
      result && typeof result === 'object' && 'sample' in result ? String((result as { sample?: unknown }).sample || '') : ''
    break
  }
  if (!sample) throw new ImageEngineError('Tạo ảnh quá thời gian chờ.')
  let sampleUrl: URL
  try {
    sampleUrl = new URL(sample)
  } catch {
    throw new ImageEngineError('FLUX 3 không trả về file ảnh.')
  }
  if (sampleUrl.protocol !== 'https:') throw new ImageEngineError('FLUX 3 không trả về file ảnh.')
  const imageRes = await fetch(sampleUrl, { redirect: 'follow' })
  if (!imageRes.ok) throw new ImageEngineError(`Không tải được ảnh FLUX 3 (HTTP ${imageRes.status}).`)
  const buffer = Buffer.from(await imageRes.arrayBuffer())
  if (!buffer.length) throw new ImageEngineError('FLUX 3 trả về ảnh rỗng.')
  const billed = cost ?? estimatedBflCredits(quality)
  const width = opts.size?.width ?? 0
  const height = opts.size?.height ?? 0
  console.info(
    JSON.stringify({
      event: 'flux-3-image',
      id,
      cost,
      width: width || null,
      height: height || null,
      model: publicFluxImageName(quality),
      references: images.length,
    }),
  )
  const candidatesTokenCount = Math.max(1, Math.round(billed * 1000))
  return {
    buffer,
    cost,
    id,
    width,
    height,
    usage: {
      promptTokenCount: 0,
      candidatesTokenCount,
      totalTokenCount: candidatesTokenCount,
      logModel: publicFluxImageName(quality),
      logImageSize: fluxLogSize(quality),
    },
  }
}
