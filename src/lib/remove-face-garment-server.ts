/**
 * Xóa mặt người mẫu khỏi ảnh sản phẩm - dùng Google Cloud Vision API.
 */

import sharp from 'sharp'
import { getVisionAccessToken, hasVisionConfig } from './vision-api'
import { trackApiUsage } from '@/lib/track-ai-usage'

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'
const VISION_BATCH_LIMIT = 16

/** Vision API hỗ trợ: JPEG, PNG, GIF, BMP, WEBP. AVIF không hỗ trợ → chuyển sang PNG */
const VISION_SUPPORTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp'])

async function ensureVisionCompatibleBuffer(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const fmt = (meta.format ?? '').toLowerCase()
  if (VISION_SUPPORTED_FORMATS.has(fmt)) return buffer
  return sharp(buffer).png().toBuffer()
}

/** Định dạng FaceAnnotation từ Vision API */
interface FaceAnnotation {
  boundingPoly?: { vertices?: Array<{ x?: number; y?: number }> }
  fdBoundingPoly?: { vertices?: Array<{ x?: number; y?: number }> }
  landmarks?: Array<{ type: string; position: { x: number; y: number; z?: number } }>
}

interface VisionResponse {
  responses?: Array<{
    faceAnnotations?: FaceAnnotation[]
    error?: { message: string }
  }>
}

/**
 * Gọi Vision API một lần cho tất cả ảnh (batch).
 * Trả về mảng faces tương ứng từng ảnh: responses[i] = faces của ảnh thứ i.
 * Chỉ service account (OAuth2).
 */
async function detectFacesBatch(imageBuffers: Buffer[], userId?: string | null): Promise<FaceAnnotation[][]> {
  if (!hasVisionConfig()) {
    throw new Error('Chưa cấu hình Vision API. Thêm VISION_CREDENTIALS_PATH hoặc GOOGLE_APPLICATION_CREDENTIALS vào .env.local')
  }

  const totalBytes = imageBuffers.reduce((s, b) => s + b.length, 0)
  console.log('[Vision] Goi API batch |', imageBuffers.length, 'anh | tong', totalBytes, 'bytes')

  const token = await getVisionAccessToken()
  const requests = imageBuffers.map((buf) => ({
    image: { content: buf.toString('base64').replace(/\s/g, '') },
    features: [{ type: 'FACE_DETECTION' as const, maxResults: 10 }],
  }))

  const res = await fetch(VISION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Vision] API HTTP', res.status, '|', errText.slice(0, 300))
    if (res.status === 403 && (errText.includes('has not been used') || errText.includes('disabled'))) {
      throw new Error('Cloud Vision API chưa bật. Bật tại: https://console.cloud.google.com/apis/library/vision.googleapis.com?project=thu-do-online')
    }
    throw new Error(`Vision API lỗi (HTTP ${res.status}): ${errText.slice(0, 200)}`)
  }

  let data: VisionResponse
  try {
    data = (await res.json()) as VisionResponse
  } catch {
    throw new Error('Vision API: Không parse được response')
  }

  const responses = data.responses ?? []
  const results: FaceAnnotation[][] = []

  for (let i = 0; i < imageBuffers.length; i++) {
    const r = responses[i]
    if (r?.error) {
      const msg = r.error.message || JSON.stringify(r.error)
      console.error('[Vision] API error anh', i + 1, ':', msg)
      throw new Error(`Vision API lỗi (ảnh ${i + 1}): ${msg}`)
    }
    results.push(r?.faceAnnotations ?? [])
  }

  const withFaces = results.filter((f) => f.length > 0).length
  console.log('[Vision] API OK |', results.length, 'anh |', withFaces, 'anh co mat')
  return results
}

/** Gọi batch cho nhiều ảnh, tự chia chunk nếu > 16 ảnh (giới hạn Vision API). */
async function detectFacesBatchAll(buffers: Buffer[], userId?: string | null): Promise<FaceAnnotation[][]> {
  const results: FaceAnnotation[][] = []
  for (let i = 0; i < buffers.length; i += VISION_BATCH_LIMIT) {
    const chunk = buffers.slice(i, i + VISION_BATCH_LIMIT)
    const chunkResults = await detectFacesBatch(chunk, userId)
    results.push(...chunkResults)
  }
  return results
}

/**
 * Tính Y dưới cùng của khuôn mặt (vùng cổ) từ bounding box hoặc landmarks.
 * Sử dụng fdBoundingPoly (face detection poly) chính xác hơn boundingPoly.
 */
function getFaceBottomY(faces: FaceAnnotation[], imageHeight: number): number | null {
  void imageHeight
  let maxY = 0

  for (const face of faces) {
    const poly = face.fdBoundingPoly ?? face.boundingPoly
    const vertices = poly?.vertices
    if (!vertices?.length) continue

    for (const v of vertices) {
      const y = v.y ?? 0
      if (y > maxY) maxY = y
    }

    // Ưu tiên landmark CHIN_GNATHION (cằm) nếu có - chính xác hơn
    const chin = face.landmarks?.find((l) => l.type === 'CHIN_GNATHION')
    if (chin?.position?.y != null && chin.position.y > maxY) {
      maxY = chin.position.y
    }
  }

  if (maxY <= 0) return null
  return maxY
}

/**
 * Cắt ảnh: bỏ phần từ cổ lên, chỉ giữ phần từ cổ xuống (trang phục).
 * @param imageBuffer - Buffer ảnh gốc
 * @param neckY - Tọa độ Y dưới cùng của vùng mặt (cổ). Crop từ dòng này xuống.
 */
async function cropBelowNeck(imageBuffer: Buffer, neckY: number): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  if (h <= neckY || w <= 0) return imageBuffer

  const cropHeight = h - neckY
  if (cropHeight <= 0) return imageBuffer

  return sharp(imageBuffer)
    .extract({ left: 0, top: neckY, width: w, height: cropHeight })
    .png()
    .toBuffer()
}

/**
 * Xử lý một ảnh khi đã có tọa độ faces từ Vision API.
 * - Không có mặt → giữ nguyên.
 * - Có mặt → cắt từ cổ xuống.
 */
async function processImageWithFaces(imageBuffer: Buffer, faces: FaceAnnotation[], index: number): Promise<Buffer> {
  if (!faces.length) {
    console.log('[Vision] Anh', index + 1, ': GIU NGUYEN (khong nhan dien mat)')
    return imageBuffer
  }

  const meta = await sharp(imageBuffer).metadata()
  const h = meta.height ?? 0
  const detected = getFaceBottomY(faces, h)

  if (detected == null || detected >= h - 10) {
    console.log('[Vision] Anh', index + 1, ': GIU NGUYEN (neckY khong hop le)')
    return imageBuffer
  }

  const neckY = Math.floor(detected) + 5
  console.log('[Vision] Anh', index + 1, ': CAT tu Y=', neckY, '(cua', h, 'px)')
  return cropBelowNeck(imageBuffer, neckY)
}

/**
 * Xử lý nhiều ảnh sản phẩm: gọi Vision API một lần (batch) → nhận diện mặt tất cả
 * → ảnh không có mặt giữ nguyên, ảnh có mặt cắt bỏ phần mặt → trả về ảnh đã xử lý.
 */
export async function removeFaceFromGarmentImages(images: File[], userId?: string | null): Promise<File[]> {
  console.log('[Vision] Config:', hasVisionConfig() ? 'Service account OK' : 'chua cau hinh')
  console.log('[Vision] ===== Bat dau xu ly', images.length, 'anh san pham (batch) =====')

  let buffers: Buffer[] = await Promise.all(images.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab))))
  buffers = await Promise.all(buffers.map((buf) => ensureVisionCompatibleBuffer(buf).then((b) => Buffer.from(b))))

  for (let i = 0; i < images.length; i++) {
    console.log('[Vision] Anh', i + 1, '/', images.length, '|', images[i].name, '|', buffers[i].length, 'bytes')
  }

  const facesPerImage = await detectFacesBatchAll(buffers, userId)

  const results: File[] = []
  for (let i = 0; i < images.length; i++) {
    const processed = await processImageWithFaces(buffers[i], facesPerImage[i], i)
    const name = images[i].name.replace(/\.[^.]+$/i, '.png')
    results.push(new File([new Uint8Array(processed)], name, { type: 'image/png' }))
  }

  console.log('[Vision] ===== Xong xu ly', results.length, 'anh =====')
  return results
}
