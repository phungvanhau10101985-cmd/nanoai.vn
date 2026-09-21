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
