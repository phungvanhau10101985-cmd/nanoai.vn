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

async function surroundingBackgroundColor(
  imageBuffer: Buffer,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): Promise<[number, number, number]> {
  const pad = Math.max(5, Math.min(14, Math.trunc(0.18 * Math.max(box.width, box.height))))
  const left = Math.max(0, box.x - pad)
  const top = Math.max(0, box.y - pad)
  const right = Math.min(imageWidth, box.x + box.width + pad)
  const bottom = Math.min(imageHeight, box.y + box.height + pad)
  const extracted = await sharp(imageBuffer)
    .ensureAlpha()
    .extract({ left, top, width: right - left, height: bottom - top })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const samples: number[][] = [[], [], []]
  const totalPixels = extracted.info.width * extracted.info.height
  const step = Math.max(1, Math.ceil(totalPixels / 50_000))
  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const px = pixel % extracted.info.width
    const py = Math.trunc(pixel / extracted.info.width)
    const inside =
      px >= box.x - left &&
      px < box.x - left + box.width &&
      py >= box.y - top &&
      py < box.y - top + box.height
    if (inside) continue
    for (let channel = 0; channel < 3; channel++) {
      samples[channel].push(extracted.data[pixel * channels + channel])
    }
  }
  return samples.map((values) => {
    if (!values.length) return 255
    values.sort((a, b) => a - b)
    return values[Math.trunc(values.length / 2)]
  }) as [number, number, number]
}

function centeredTextBox(
  text: string,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
) {
  if (!text) return box
  const minFont = 14
  const estimatedTextWidth = Math.max(minFont, [...text].length * minFont * 0.58)
  const maxWidth = Math.min(
    imageWidth - 8,
    Math.max(box.width + 80, Math.trunc(box.width * (text.length > 80 ? 1.75 : 1.35)), minFont * 10)
  )
  const requiredWidth = Math.max(box.width, Math.min(estimatedTextWidth + 16, maxWidth))
  const usableWidth = Math.max(10, requiredWidth - 16)
  const lineCount = Math.max(1, Math.ceil(estimatedTextWidth / usableWidth))
  const neededHeight = lineCount * Math.trunc(minFont * 1.42) + Math.max(0, lineCount - 1) + 16
  const maxHeight = Math.min(
    imageHeight - 8,
    Math.max(box.height + 90, Math.trunc(box.height * (text.length > 80 ? 4.5 : 2.6)), minFont * 6)
  )
  const requiredHeight = Math.max(box.height, Math.min(neededHeight, maxHeight))
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  let left = Math.round(centerX - requiredWidth / 2)
  let top = Math.round(centerY - requiredHeight / 2)
  left = Math.max(0, Math.min(imageWidth - Math.round(requiredWidth), left))
  top = Math.max(0, Math.min(imageHeight - Math.round(requiredHeight), top))
  return {
    x: left,
    y: top,
    width: Math.max(1, Math.min(imageWidth - left, Math.round(requiredWidth))),
    height: Math.max(1, Math.min(imageHeight - top, Math.round(requiredHeight))),
  }
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

  const backgrounds: Array<{ input: Buffer; top: number; left: number }> = []
  const texts: Array<{ input: Buffer; top: number; left: number }> = []
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
    let strokeColor = '#ffffff'
    if (options?.sampleBackground) {
      try {
        const rgb = await surroundingBackgroundColor(
          imageBuffer,
          { x, y, width: w, height: h },
          imageWidth,
          imageHeight
        )
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#000000' : '#ffffff'
        strokeColor = luminance > 140 ? '#ffffff' : '#000000'
      } catch {
        /* fallback to configured colors */
      }
    }
    const background = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
      </svg>`
    )
    backgrounds.push({ input: background, top: y, left: x })
    if (!translatedText.trim()) continue

    const drawBox = centeredTextBox(
      translatedText.trim(),
      { x, y, width: w, height: h },
      imageWidth,
      imageHeight
    )
    const rawWords = translatedText.trim().split(/\s+/).filter(Boolean)
    const maxChars = Math.max(
      4,
      Math.floor(drawBox.width / Math.max(6, Math.min(18, drawBox.height * 0.28)))
    )
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
    const fontSize = Math.max(
      14,
      Math.min(
        140,
        Math.floor((drawBox.height * 0.78) / lineCount),
        Math.floor(drawBox.width / Math.max(1, maxChars * 0.52))
      )
    )
    const lineHeight = Math.max(9, Math.round(fontSize * 1.12))
    const startY = Math.max(
      fontSize,
      Math.round((drawBox.height - lineHeight * lineCount) / 2 + fontSize)
    )
    const tspans = (lines.length ? lines : translatedText.trim() ? [translatedText.trim()] : [])
      .map((line, index) => `<tspan x="50%" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
      .join('')

    const svg = Buffer.from(
      `<svg width="${drawBox.width}" height="${drawBox.height}" xmlns="http://www.w3.org/2000/svg">
        <text text-anchor="middle" font-size="${fontSize}" font-family="Arial, sans-serif"
          fill="${textColor}" stroke="${strokeColor}" stroke-width="${fontSize < 24 ? 1 : Math.min(3, Math.max(1, Math.round(fontSize * 0.05)))}"
          paint-order="stroke fill" overflow="hidden">${tspans}</text>
      </svg>`
    )

    texts.push({ input: svg, top: drawBox.y, left: drawBox.x })
  }

  return sharp(imageBuffer)
    .composite([...backgrounds, ...texts])
    .png()
    .toBuffer()
}
