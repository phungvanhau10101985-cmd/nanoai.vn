/**
 * Overlay dịch lên ảnh: xóa chữ cũ (cover bằng nền), vẽ chữ mới đã dịch.
 * Dùng cho hậu kiểm – dịch nốt những từ còn sót.
 */

import sharp from 'sharp'

export interface OverlayItem {
  bbox: { x: number; y: number; width: number; height: number }
  translatedText: string
}

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Overlay các đoạn chữ đã dịch lên ảnh: cover vùng cũ bằng nền trắng, vẽ chữ mới.
 */
export async function overlayTranslatedText(
  imageBuffer: Buffer,
  items: OverlayItem[],
  options?: { fillColor?: string; textColor?: string }
): Promise<Buffer> {
  if (items.length === 0) return imageBuffer

  const fillColor = options?.fillColor ?? '#ffffff'
  const textColor = options?.textColor ?? '#000000'

  const composites: Array<{ input: Buffer; top: number; left: number }> = []

  for (const item of items) {
    const { bbox, translatedText } = item
    const w = Math.max(1, Math.round(bbox.width))
    const h = Math.max(1, Math.round(bbox.height))
    const x = Math.round(bbox.x)
    const y = Math.round(bbox.y)

    const fontSize = Math.max(8, Math.min(72, Math.round(h * 0.85)))
    const text = escapeSvgText(translatedText.trim())
    if (!text) continue

    const svg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy="0.35em" font-size="${fontSize}" font-family="Arial, sans-serif" fill="${textColor}" overflow="hidden">${text}</text>
      </svg>`
    )

    composites.push({ input: svg, top: y, left: x })
  }

  return sharp(imageBuffer)
    .composite(composites)
    .png()
    .toBuffer()
}
