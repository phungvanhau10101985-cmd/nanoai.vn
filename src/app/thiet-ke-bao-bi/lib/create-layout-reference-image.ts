/**
 * Tạo ảnh layout tham chiếu: nền đen + hình chữ nhật carton (vùng thiết kế) ở giữa, viền trắng.
 * AI vẽ nội dung CHỈ trong khung carton (bên trong viền trắng). Phần đen bị cắt bỏ.
 */

import sharp from 'sharp'

const CARTON_COLOR = { r: 196, g: 165, b: 116 } // #C4A574 kraft/be
const BASE_SIZE_2K = 1024
const BASE_SIZE_4K = 2048

/** Parse "9:16" → [width, height] với longer side = baseSize */
function parseAspectRatioToDimensions(ar: string, baseSize: number): [number, number] {
  const [w, h] = ar.split(':').map(Number)
  if (!w || !h) return [baseSize, baseSize]
  const ratio = w / h
  if (ratio >= 1) {
    return [baseSize, Math.round(baseSize / ratio)]
  }
  return [Math.round(baseSize * ratio), baseSize]
}

/** Tính vùng design (surfaceLength × surfaceWidth) fit trong canvas – dùng cho layout và crop */
export function getDesignRectInCanvas(
  canvasW: number,
  canvasH: number,
  surfaceLength: number,
  surfaceWidth: number
): { x: number; y: number; w: number; h: number } {
  const designRatio = surfaceLength / surfaceWidth
  let rectW: number
  let rectH: number
  if (designRatio >= canvasW / canvasH) {
    rectW = canvasW
    rectH = Math.round(canvasW / designRatio)
  } else {
    rectH = canvasH
    rectW = Math.round(canvasH * designRatio)
  }
  const x = Math.round((canvasW - rectW) / 2)
  const y = Math.round((canvasH - rectH) / 2)
  return { x, y, w: rectW, h: rectH }
}

export async function createLayoutReferenceImage(params: {
  aspectRatio: string
  surfaceLength: number
  surfaceWidth: number
  imageQuality: '2K' | '4K'
}): Promise<Buffer> {
  const { aspectRatio, surfaceLength, surfaceWidth, imageQuality } = params
  const baseSize = imageQuality === '4K' ? BASE_SIZE_4K : BASE_SIZE_2K
  const [canvasW, canvasH] = parseAspectRatioToDimensions(aspectRatio, baseSize)

  const { x, y, w, h } = getDesignRectInCanvas(canvasW, canvasH, surfaceLength, surfaceWidth)

  const cartonRect = await sharp({
    create: {
      width: Math.max(1, w),
      height: Math.max(1, h),
      channels: 3,
      background: CARTON_COLOR,
    },
  })
    .png()
    .toBuffer()

  const borderPx = baseSize >= 2048 ? 6 : 3
  const borderSvg = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="white" stroke-width="${borderPx}"/></svg>`
  )

  const result = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: cartonRect, left: x, top: y },
      { input: borderSvg, left: x, top: y },
    ])
    .png()
    .toBuffer()

  return result
}

/**
 * Crop ảnh AI output về đúng tỷ lệ thiết kế (surfaceLength × surfaceWidth).
 * Khi Gemini trả về tỷ lệ khác (vd 21:9 thay vì 5:1), crop lấy vùng design ở giữa.
 */
export async function cropToDesignArea(
  imageBuffer: Buffer,
  surfaceLength: number,
  surfaceWidth: number
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w < 2 || h < 2) return imageBuffer

  const designRatio = surfaceLength / surfaceWidth
  const canvasRatio = w / h
  if (Math.abs(designRatio - canvasRatio) < 0.02) return imageBuffer

  const { x, y, w: cropW, h: cropH } = getDesignRectInCanvas(w, h, surfaceLength, surfaceWidth)
  if (cropW < 2 || cropH < 2) return imageBuffer

  return sharp(imageBuffer)
    .extract({ left: x, top: y, width: cropW, height: cropH })
    .png()
    .toBuffer()
}
