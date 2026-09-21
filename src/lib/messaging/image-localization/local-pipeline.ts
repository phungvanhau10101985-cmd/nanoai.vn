import sharp from 'sharp'
import { documentOcrWithScale, type TextWithBbox } from '@/lib/vision-ocr'
import { hasVisionConfig } from '@/lib/vision-api'
import { overlayTranslatedText, type OverlayItem } from '@/lib/translate-overlay'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import {
  LANGUAGE_LABELS,
  imageLocJpegQuality,
  imageLocRetryMaxSlowWaits,
  imageLocRetrySlowWaitMs,
} from './image-localization-config'
import {
  convertJinWeightText,
  hasChineseText,
  localBlocksNeedDraw,
  type ImageLocOcrBlock,
} from './image-localization-classifier'
import {
  ImageLocalizationError,
  ImageLocalizationFatalDependencyError,
  raiseIfFatalDependency,
} from './gemini-adapter'

async function imageLocSmartRetry<T>(work: () => Promise<T>, label: string): Promise<T> {
  const maxSlowWaits = imageLocRetryMaxSlowWaits()
  let slowWaits = 0
  let lastError: unknown
  while (true) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        return await work()
      } catch (error) {
        lastError = error
        raiseIfFatalDependency(error)
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
    if (slowWaits >= maxSlowWaits) {
      throw new ImageLocalizationFatalDependencyError(
        `IMAGE_LOCALIZATION_FATAL_DEPENDENCY:retry_exhausted: ${label} lỗi sau retry: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`
      )
    }
    slowWaits += 1
    await new Promise((resolve) => setTimeout(resolve, imageLocRetrySlowWaitMs()))
  }
}

export function ocrBlocksFromVision(results: TextWithBbox[], scale: number): ImageLocOcrBlock[] {
  const inv = scale > 0 ? 1 / scale : 1
  return results
    .filter((r) => (r.text || '').trim())
    .map((r) => {
      const x = Math.round(r.bbox.x * inv)
      const y = Math.round(r.bbox.y * inv)
      const w = Math.max(1, Math.round(r.bbox.width * inv))
      const h = Math.max(1, Math.round(r.bbox.height * inv))
      return { text: r.text.trim(), bbox: [x, y, x + w, y + h] as [number, number, number, number] }
    })
}

export async function ocrImageBlocks(
  imageBytes: Buffer,
  userId?: string | null,
  options?: { preserveResolution?: boolean }
): Promise<{ blocks: ImageLocOcrBlock[]; scale: number }> {
  if (!hasVisionConfig()) {
    throw new ImageLocalizationError(
      'Chưa cấu hình Google Cloud Vision (VISION_CREDENTIALS_PATH / GOOGLE_APPLICATION_CREDENTIALS / IMAGE_LOCALIZATION_GCP_KEY_FILE).'
    )
  }
  const { results, scale } = await imageLocSmartRetry(
    () =>
      documentOcrWithScale(imageBytes, {
        userId: userId ?? null,
        feature: 'image-localization-vision-ocr',
      }, options),
    'Google Vision OCR'
  )
  let blocks = ocrBlocksFromVision(results, scale)
  try {
    const metadata = await sharp(imageBytes, { limitInputPixels: false }).metadata()
    const imageArea = Math.max(1, (metadata.width || 1) * (metadata.height || 1))
    blocks = blocks.filter((block) => {
      const area =
        Math.max(0, block.bbox[2] - block.bbox[0]) *
        Math.max(0, block.bbox[3] - block.bbox[1])
      return area <= imageArea * 0.6
    })
  } catch {
    /* 188 giữ toàn bộ OCR nếu không đọc được kích thước để lọc block rác. */
  }
  return { blocks, scale }
}

async function translateBlocksDeepseek(
  texts: string[],
  language: string,
  userId?: string | null
): Promise<string[]> {
  if (!texts.length) return []
  const target = LANGUAGE_LABELS[language] || language || 'Vietnamese'
  const translations: string[] = []
  for (const text of texts) {
    const cacheKey = `${language}:${text}`
    const cached = imageLocTranslationCache.get(cacheKey)
    if (cached !== undefined) {
      translations.push(cached)
      continue
    }
    const translated = await imageLocSmartRetry(async () => {
      const prompt = `Translate the following short text into ${target} for an e-commerce product image:
"${text}"
REQUIREMENTS:
1. Return ONLY the ${target} result. Do not repeat the prompt.
2. Preserve all measurements and numbers (45kg, 5cm, etc.).
3. Translate both English and Chinese text when present.
4. Do not add explanations.`
      const res = await deepseekPartnerChat(
        'You are a precise e-commerce image translator. Output only the translated text.',
        prompt,
        {
          feature: 'image-localization-deepseek-translate',
          userId: userId ?? null,
          temperature: 0.1,
          maxTokens: 400,
        }
      )
      if ('error' in res && res.error) {
        const msg = String(res.error)
        if (/missing|not configured|api.?key/i.test(msg)) {
          throw new ImageLocalizationError(`deepseek_missing_key: ${msg}`)
        }
        throw new ImageLocalizationError(`DeepSeek dịch lỗi: ${msg}`)
      }
      return String((res as { text?: string }).text || '')
        .trim()
        .replace(/^(?:Dịch|Bản dịch|Translation|Vietnamese|English|Chinese|Japanese|Korean):\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }, 'DeepSeek dịch ảnh')
    imageLocTranslationCache.set(cacheKey, translated)
    translations.push(translated)
  }
  return translations
}

const imageLocTranslationCache = new Map<string, string>()

function overlayXyxy(item: OverlayItem): [number, number, number, number] {
  return [
    item.bbox.x,
    item.bbox.y,
    item.bbox.x + item.bbox.width,
    item.bbox.y + item.bbox.height,
  ]
}

function overlayUnion(items: OverlayItem[]): [number, number, number, number] {
  const boxes = items.map(overlayXyxy)
  return [
    Math.min(...boxes.map((box) => box[0])),
    Math.min(...boxes.map((box) => box[1])),
    Math.max(...boxes.map((box) => box[2])),
    Math.max(...boxes.map((box) => box[3])),
  ]
}

function overlayItemsClose(a: OverlayItem[], b: OverlayItem): boolean {
  const [ax1, ay1, ax2, ay2] = overlayUnion(a)
  const [bx1, by1, bx2, by2] = overlayXyxy(b)
  const aw = Math.max(1, ax2 - ax1)
  const ah = Math.max(1, ay2 - ay1)
  const bw = Math.max(1, bx2 - bx1)
  const bh = Math.max(1, by2 - by1)
  const padX = Math.max(12, Math.trunc(Math.min(aw, bw) * 0.18))
  const padY = Math.max(8, Math.trunc(Math.min(ah, bh) * 0.85))
  const intersects = !(
    ax2 + padX < bx1 ||
    bx2 + padX < ax1 ||
    ay2 + padY < by1 ||
    by2 + padY < ay1
  )
  if (intersects) return true
  const isCm = (text: string) => /^\d+(?:[.,]\d+)?\s*cm$/i.test(text.trim())
  if (!isCm(b.translatedText) && !a.some((item) => isCm(item.translatedText))) return false
  const yOverlap = Math.min(ay2, by2) - Math.max(ay1, by1)
  const centerClose =
    Math.abs((ay1 + ay2) / 2 - (by1 + by2) / 2) <= Math.max(ah, bh) * 1.2
  const sameRow = yOverlap > -Math.max(8, Math.min(ah, bh) * 0.6) || centerClose
  const horizontalGap = Math.max(0, bx1 - ax2, ax1 - bx2)
  return sameRow && horizontalGap <= Math.max(80, Math.trunc(Math.max(aw, bw) * 0.9))
}

export function mergeDenseImageLocOverlayItems(
  items: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): OverlayItem[] {
  if (items.length < 2) return items
  let groups: OverlayItem[][] = []
  for (const item of [...items].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)) {
    const group = groups.find((candidate) => overlayItemsClose(candidate, item))
    if (group) group.push(item)
    else groups.push([item])
  }
  let changed = true
  while (changed) {
    changed = false
    const merged: OverlayItem[][] = []
    while (groups.length) {
      const group = groups.shift()!
      const index = groups.findIndex((other) =>
        other.some((candidate) => overlayItemsClose(group, candidate))
      )
      if (index < 0) merged.push(group)
      else {
        group.push(...groups.splice(index, 1)[0])
        groups.push(group)
        changed = true
      }
    }
    groups = merged
  }
  return groups.flatMap((group) => {
    if (group.length === 1) return group
    const [x1, y1, x2, y2] = overlayUnion(group)
    const totalArea = group.reduce(
      (sum, item) => sum + Math.max(1, item.bbox.width * item.bbox.height),
      0
    )
    const density = totalArea / Math.max(1, (x2 - x1) * (y2 - y1))
    if (density <= 0.1 && group.length < 3) return group
    const padX = Math.max(18, Math.trunc((x2 - x1) * 0.08))
    const padY = Math.max(12, Math.trunc((y2 - y1) * 0.25))
    const left = Math.max(0, x1 - padX)
    const top = Math.max(0, y1 - padY)
    const right = Math.min(imageWidth, x2 + padX)
    const bottom = Math.min(imageHeight, y2 + padY)
    const translatedText = group
      .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
      .map((item) => item.translatedText.trim())
      .filter(Boolean)
      .join(' ')
    return [{
      bbox: { x: left, y: top, width: right - left, height: bottom - top },
      translatedText,
      eraseOriginal: !translatedText && group.some((item) => item.eraseOriginal),
    }]
  })
}

export async function localDrawTranslated(
  imageBytes: Buffer,
  blocks: ImageLocOcrBlock[],
  language: string,
  userId?: string | null
): Promise<Buffer> {
  const prepared = blocks.map((block) => ({
    block,
    source: convertJinWeightText(block.text || '').trim(),
    translated: '',
    eraseOriginal: !(block.text || '').trim(),
  }))
  const translatable = prepared.filter(
    (item) =>
      !item.eraseOriginal &&
      hasChineseText(item.source) &&
      !/^\d+(?:[.,]\d+)?\s*cm$/i.test(item.source)
  )
  const translated = await translateBlocksDeepseek(
    translatable.map((item) => item.source),
    language,
    userId
  )
  translatable.forEach((item, index) => {
    item.translated = (translated[index] || '').trim()
  })
  let overlayItems: OverlayItem[] = prepared
    .map((item) => {
      const text = item.eraseOriginal
        ? ''
        : hasChineseText(item.source)
          ? item.translated
          : item.source
      if (!text && !item.eraseOriginal) return null
      return {
        bbox: {
          x: item.block.bbox[0],
          y: item.block.bbox[1],
          width: Math.max(1, item.block.bbox[2] - item.block.bbox[0]),
          height: Math.max(1, item.block.bbox[3] - item.block.bbox[1]),
        },
        translatedText: text,
        eraseOriginal: item.eraseOriginal,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const metadata = await sharp(imageBytes).metadata()
  overlayItems = mergeDenseImageLocOverlayItems(
    overlayItems,
    metadata.width || 1,
    metadata.height || 1
  )
  const png = await overlayTranslatedText(imageBytes, overlayItems, { sampleBackground: true })
  const q = imageLocJpegQuality()
  return sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export async function encodeJpeg(imageBytes: Buffer): Promise<Buffer> {
  const q = imageLocJpegQuality()
  return sharp(imageBytes).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export { localBlocksNeedDraw, hasChineseText }
