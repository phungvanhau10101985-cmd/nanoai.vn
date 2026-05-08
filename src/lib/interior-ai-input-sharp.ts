/**
 * Chuẩn hóa ảnh đầu vào cho Gemini (Thiết kế nội ngoại thất): giới hạn cạnh dài + JPEG chất lượng cao.
 * Dùng trên server (Sharp) cho mọi nguồn (File, URL, đệm từ client đã nén).
 */

import sharp from 'sharp'

const MAX_EDGE_PX = 3200
const JPEG_QUALITY = 88
/** Chỉ xử lý khi cần — tránh tái nén ảnh nhỏ/đã vừa. */
const MIN_BYTES_TO_OPTIMIZE = 900_000

export async function optimizeInteriorAiInputBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!buffer?.length) return { buffer, mimeType }
  try {
    const img = sharp(buffer, { failOn: 'none' })
    const meta = await img.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w <= 0 || h <= 0) return { buffer, mimeType }

    const maxDim = Math.max(w, h)
    const needsResize = maxDim > MAX_EDGE_PX
    const needsShrink = buffer.length >= MIN_BYTES_TO_OPTIMIZE
    if (!needsResize && !needsShrink) return { buffer, mimeType }

    let pipeline = sharp(buffer).rotate()
    if (needsResize) {
      pipeline = pipeline.resize(MAX_EDGE_PX, MAX_EDGE_PX, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
    if (out.length >= buffer.length * 0.98 && !needsResize) {
      return { buffer, mimeType }
    }
    return { buffer: out, mimeType: 'image/jpeg' }
  } catch {
    return { buffer, mimeType }
  }
}
