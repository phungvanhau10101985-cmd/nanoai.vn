/**
 * Overlay dịch lên ảnh: xóa chữ cũ (cover bằng nền), vẽ chữ mới đã dịch.
 * Dùng cho hậu kiểm – dịch nốt những từ còn sót.
 */

import sharp from 'sharp'

export interface OverlayItem {
  bbox: { x: number; y: number; width: number; height: number }
  translatedText: string
  /** Xóa chữ/vùng cũ dù không có chữ thay thế (domain, năm cũ). */
  eraseOriginal?: boolean
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
  options?: { fillColor?: string; textColor?: string; sampleBackground?: boolean }
): Promise<Buffer> {
  if (items.length === 0) return imageBuffer

  const composites: Array<{ input: Buffer; top: number; left: number }> = []
  const source = sharp(imageBuffer)
  const meta = await source.metadata()
  const imageWidth = meta.width || 0
  const imageHeight = meta.height || 0
  if (!imageWidth || !imageHeight) return imageBuffer

  for (const item of items) {
    const { bbox, translatedText } = item
    const x = Math.max(0, Math.min(imageWidth - 1, Math.round(bbox.x)))
    const y = Math.max(0, Math.min(imageHeight - 1, Math.round(bbox.y)))
    const w = Math.max(1, Math.min(imageWidth - x, Math.round(bbox.width)))
    const h = Math.max(1, Math.min(imageHeight - y, Math.round(bbox.height)))
    if (!translatedText.trim() && !item.eraseOriginal) continue
    let fillColor = options?.fillColor ?? '#ffffff'
    let textColor = options?.textColor ?? '#000000'
    if (options?.sampleBackground) {
      try {
        const stats = await sharp(imageBuffer).extract({ left: x, top: y, width: w, height: h }).stats()
        const [r, g, b] = stats.channels
        const rgb = [r?.mean || 255, g?.mean || 255, b?.mean || 255].map((n) => Math.max(0, Math.min(255, Math.round(n))))
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#000000' : '#ffffff'
      } catch {
        /* fallback to configured colors */
      }
    }
    const rawWords = translatedText.trim().split(/\s+/).filter(Boolean)
    const maxChars = Math.max(4, Math.floor(w / Math.max(6, Math.min(18, h * 0.28))))
    const lines: string[] = []
    for (const word of rawWords) {
      const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word
      if (candidate.length <= maxChars || !lines.length) {
        if (lines.length) lines[lines.length - 1] = candidate
        else lines.push(candidate)
      } else {
        lines.push(word)
      }
    }
    const lineCount = Math.max(1, lines.length)
    const fontSize = Math.max(8, Math.min(72, Math.floor((h * 0.78) / lineCount), Math.floor(w / Math.max(1, maxChars * 0.52))))
    const lineHeight = Math.max(9, Math.round(fontSize * 1.12))
    const startY = Math.max(fontSize, Math.round((h - lineHeight * lineCount) / 2 + fontSize))
    const tspans = (lines.length ? lines : translatedText.trim() ? [translatedText.trim()] : [])
      .map((line, index) => `<tspan x="50%" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
      .join('')

    const svg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
        <text text-anchor="middle" font-size="${fontSize}" font-family="Arial, sans-serif" fill="${textColor}" overflow="hidden">${tspans}</text>
      </svg>`
    )

    composites.push({ input: svg, top: y, left: x })
  }

  return sharp(imageBuffer)
    .composite(composites)
    .png()
    .toBuffer()
}
