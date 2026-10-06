import sharp from 'sharp'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import {
  IMAGE_LOC_BRAND_LOGO_TEMPLATE_MAX_PX,
  imageLocBrandLogoMarginFrac,
  imageLocBrandLogoMaxWidthFrac,
} from './image-localization-config'

const LARGE_IMAGE_INPUT = { limitInputPixels: false, sequentialRead: true } as const

export type BrandLogoStampLayout = {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Chuẩn hóa logo trước khi lưu / đóng: PNG alpha, EXIF rotate, fit trong khung vuông
 * (không phóng to). Overlay vẫn scale theo từng ảnh như 188.
 */
export async function normalizeBrandLogoTemplate(logoBytes: Buffer): Promise<Buffer> {
  const max = IMAGE_LOC_BRAND_LOGO_TEMPLATE_MAX_PX
  return sharp(logoBytes, LARGE_IMAGE_INPUT)
    .rotate()
    .ensureAlpha()
    .resize({
      width: max,
      height: max,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
}

/**
 * Vị trí + cỡ stamp góc phải trên — cùng công thức 188
 * `apply_brand_logo_top_right_bgr` (frac 0.22, lề 0.012, không enlarge).
 */
export function brandLogoStampLayout(
  imageWidth: number,
  imageHeight: number,
  logoWidth: number,
  logoHeight: number,
  opts?: { maxWidthFrac?: number; marginFrac?: number }
): BrandLogoStampLayout | null {
  const w = Math.trunc(imageWidth)
  const h = Math.trunc(imageHeight)
  if (h < 16 || w < 48) return null
  const lw0 = Math.max(1, Math.trunc(logoWidth))
  const lh0 = Math.max(1, Math.trunc(logoHeight))
  const frac = opts?.maxWidthFrac ?? imageLocBrandLogoMaxWidthFrac()
  const maxW = Math.max(8, Math.trunc(w * frac))
  const scale = Math.min(1, maxW / lw0)
  const width = Math.max(1, Math.trunc(lw0 * scale))
  const height = Math.max(1, Math.trunc(lh0 * scale))
  const mfrac = opts?.marginFrac ?? imageLocBrandLogoMarginFrac()
  const margin = Math.max(4, Math.trunc(Math.min(h, w) * mfrac))
  const left = w - width - margin
  const top = margin
  if (left < 0 || top < 0 || top + height > h || left + width > w) return null
  return { left, top, width, height }
}

export async function loadImageLocBrandLogoBytes(logoUrl?: string | null): Promise<Buffer | null> {
  const src = String(logoUrl || '').trim()
  if (!src || !/^https?:\/\//i.test(src)) return null
  try {
    const buf = await fetchImageWith1688Bypass(src, { timeoutMs: 20_000, maxBytes: 5 * 1024 * 1024 })
    return await normalizeBrandLogoTemplate(buf)
  } catch (error) {
    console.warn('[image-localization] không tải được logo đóng ảnh:', src, error)
    return null
  }
}

/** Góc đã có icon/chữ thì không dán logo đè lên điểm bán hàng. Nền phẳng vẫn nhận logo. */
export async function topRightCornerHasArtwork(
  imageBytes: Buffer,
  layout: BrandLogoStampLayout
): Promise<boolean> {
  const extracted = await sharp(imageBytes, LARGE_IMAGE_INPUT)
    .extract({ left: layout.left, top: layout.top, width: layout.width, height: layout.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const width = extracted.info.width
  const height = extracted.info.height
  const count = width * height
  if (count < 16) return false
  let sum = 0
  let sumSq = 0
  const gray = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const offset = i * channels
    const value = 0.299 * extracted.data[offset] + 0.587 * extracted.data[offset + 1] + 0.114 * extracted.data[offset + 2]
    gray[i] = value
    sum += value
    sumSq += value * value
  }
  const mean = sum / count
  const std = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
  let edges = 0
  let checks = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = gray[y * width + x]!
      if (x + 1 < width) {
        checks += 1
        if (Math.abs(value - gray[y * width + x + 1]!) > 48) edges += 1
      }
      if (y + 1 < height) {
        checks += 1
        if (Math.abs(value - gray[(y + 1) * width + x]!) > 48) edges += 1
      }
    }
  }
  const edgeRatio = checks ? edges / checks : 0
  return std >= 14 && edgeRatio >= 0.012
}

/** Dán logo đã chuẩn hóa lên góc phải trên của ảnh đã dịch. Lỗi overlay không được nuốt im lặng thành “không logo”. */
export async function overlayBrandLogoOnProcessedImage(
  imageBytes: Buffer,
  logoPng: Buffer | null | undefined
): Promise<Buffer> {
  if (!logoPng?.length || !imageBytes?.length) return imageBytes
  const imageMeta = await sharp(imageBytes, LARGE_IMAGE_INPUT).metadata()
  const w = imageMeta.width || 0
  const h = imageMeta.height || 0
  const logoMeta = await sharp(logoPng, LARGE_IMAGE_INPUT).metadata()
  const lw = logoMeta.width || 0
  const lh = logoMeta.height || 0
  const layout = brandLogoStampLayout(w, h, lw, lh)
  if (!layout) return imageBytes
  if (await topRightCornerHasArtwork(imageBytes, layout)) return imageBytes
  const stamped =
    layout.width === lw && layout.height === lh
      ? logoPng
      : await sharp(logoPng, LARGE_IMAGE_INPUT)
          .resize(layout.width, layout.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
          .png()
          .toBuffer()
  return sharp(imageBytes, LARGE_IMAGE_INPUT)
    .composite([{ input: stamped, left: layout.left, top: layout.top }])
    .toBuffer()
}
