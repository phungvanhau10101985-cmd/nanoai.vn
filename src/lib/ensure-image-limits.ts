/**
 * Giới hạn dung lượng và kích thước ảnh – nếu vượt trần thì resize/nén về dưới trần một chút.
 */

import sharp from 'sharp'

/** Trần pixel (16MP) – dưới giới hạn Sharp ~268MP */
const MAX_PIXELS = 16 * 1024 * 1024
/** Trần dung lượng (2.5 MB) */
const MAX_BYTES = Math.floor(2.5 * 1024 * 1024)
/** Hệ số an toàn – resize về 95% trần */
const SAFETY = 0.95

/**
 * Nếu ảnh vượt trần (pixels hoặc bytes), resize/nén về dưới trần.
 * Trả về buffer đã xử lý hoặc buffer gốc nếu đã trong giới hạn.
 */
export async function ensureImageWithinLimits(buffer: Buffer): Promise<Buffer> {
  const img = sharp(buffer)
  const meta = await img.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w <= 0 || h <= 0) return buffer

  const pixels = w * h
  const bytes = buffer.length
  const limitPixels = MAX_PIXELS * SAFETY
  const limitBytes = MAX_BYTES * SAFETY

  if (pixels <= limitPixels && bytes <= limitBytes) return buffer

  let scale = 1
  if (pixels > limitPixels) {
    scale = Math.min(scale, Math.sqrt(limitPixels / pixels))
  }
  if (bytes > limitBytes) {
    scale = Math.min(scale, Math.sqrt(limitBytes / bytes))
  }

  const nw = Math.max(1, Math.round(w * scale))
  const nh = Math.max(1, Math.round(h * scale))
  let out = await img.resize(nw, nh).png({ compressionLevel: 9 }).toBuffer()

  if (out.length > limitBytes) {
    out = await sharp(out).resize(Math.round(nw * 0.9), Math.round(nh * 0.9)).png({ compressionLevel: 9 }).toBuffer()
  }

  return out
}
