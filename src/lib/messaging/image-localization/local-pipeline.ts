import sharp from 'sharp'
import { documentOcrWithScale, type TextWithBbox } from '@/lib/vision-ocr'
import { hasVisionConfig } from '@/lib/vision-api'
import {
  overlayItemLooksLikeEdgeBanner,
  overlayItemsLookLikeTable,
  overlayTranslatedText,
  attachTrailingMeasurements,
  spaceSpecPunctuation,
  splitTrailingModelCode,
  stripInventedLeadingModelCode,
  type OverlayItem,
} from '@/lib/translate-overlay'
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

export async function translateImageLocTexts(
  texts: string[],
  language: string,
  userId?: string | null
): Promise<string[]> {
  return translateBlocksDeepseek(texts, language, userId)
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
4. If Chinese is already paired with an English gloss of the same phrase (e.g. "结构图 /Structure"), return one ${target} phrase. Do not repeat the meaning.
5. Keep standard abbreviations such as NC and NO.
6. Keep the full meaning of a short label. Do not shorten it to one fragment.
7. Do not add explanations, model codes, or SKUs that are not in the source.`
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
        .replace(/\s*[|/／]\s*$/g, '')
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
  if (intersects && overlayModelCodeStaysApart(a, b)) return false
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
    // Ô thưa trên bản vẽ kỹ thuật: nhiều box OCR rác vẫn phải giữ riêng.
    // Gộp chúng thành một ô sẽ tô trắng mất nét vẽ.
    if (density <= 0.1) return group
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

function overlayWordTokens(text: string): string[] {
  const trimmed = text.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  return trimmed.split(/\s+/).filter(Boolean)
}

function overlayBoxIsOversized(
  box: { width: number; height: number },
  imageWidth: number,
  imageHeight: number
): boolean {
  const width = Math.max(0, box.width)
  const height = Math.max(0, box.height)
  const imageArea = Math.max(1, imageWidth * imageHeight)
  const areaRatio = (width * height) / imageArea
  const wide = width >= imageWidth * 0.34
  const tall = height >= imageHeight * 0.2
  return (wide && tall) || areaRatio >= 0.15
}

/**
 * Cụm ngắn (1–2 từ) trên ô chiếm lớn ảnh (vd. «Xương», «Mặc Băng» đọc nhầm nét vẽ).
 * Bỏ đúng cụm đó; cụm khác trên cùng ảnh vẫn dịch.
 */
export function isOversizedSingleWordOverlay(
  item: OverlayItem,
  imageWidth: number,
  imageHeight: number
): boolean {
  const tokens = overlayWordTokens(item.translatedText || '')
  if (tokens.length < 1 || tokens.length > 2) return false
  if (tokens.some((token) => token.length > 24)) return false
  return overlayBoxIsOversized(item.bbox, imageWidth, imageHeight)
}

/** «结构图 /Structure» → một câu, không «Sơ đồ cấu trúc/Cấu trúc». */
export function collapseBilingualGlossTranslation(source: string, translated: string): string {
  const src = source.trim()
  const out = translated.trim()
  if (!/[\u4e00-\u9fff].*[/／|].*[A-Za-z]/.test(src)) return out
  const parts = out.split(/\s*[/／|]\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length !== 2) return out
  const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const folded = parts.map(fold)
  if (!folded[0] || !folded[1]) return out
  if (folded[0].includes(folded[1]) || folded[1].includes(folded[0])) {
    return folded[0].length >= folded[1].length ? parts[0] : parts[1]
  }
  return out
}

export function measureTechnicalLineArt(
  gray: Uint8Array | Buffer,
  width: number,
  height: number
): { inkRatio: number; thinRatio: number; longRunShare: number; lightBg: boolean } {
  const n = width * height
  if (n <= 0 || gray.length < n) return { inkRatio: 0, thinRatio: 0, longRunShare: 0, lightBg: true }
  let ink = 0
  let thin = 0
  let light = 0
  let longInk = 0
  const minRun = Math.max(12, Math.round(Math.min(width, height) * 0.035))
  const darkAt = (x: number, y: number) => gray[y * width + x] < 90
  for (let y = 0; y < height; y++) {
    let run = 0
    for (let x = 0; x < width; x++) {
      const value = gray[y * width + x]
      if (value >= 210) light += 1
      if (!darkAt(x, y)) {
        if (run >= minRun) longInk += run
        run = 0
        continue
      }
      ink += 1
      run += 1
      const up = y > 0 ? gray[(y - 1) * width + x] : 255
      const down = y + 1 < height ? gray[(y + 1) * width + x] : 255
      const left = x > 0 ? gray[y * width + x - 1] : 255
      const right = x + 1 < width ? gray[y * width + x + 1] : 255
      if ((up >= 180 && down >= 180) || (left >= 180 && right >= 180)) thin += 1
    }
    if (run >= minRun) longInk += run
  }
  for (let x = 0; x < width; x++) {
    let run = 0
    for (let y = 0; y < height; y++) {
      if (!darkAt(x, y)) {
        if (run >= minRun) longInk += run
        run = 0
        continue
      }
      run += 1
    }
    if (run >= minRun) longInk += run
  }
  return {
    inkRatio: ink / n,
    thinRatio: ink ? thin / ink : 0,
    longRunShare: ink ? longInk / ink : 0,
    lightBg: light / n >= 0.55,
  }
}

/** Nét mảnh hoặc nét thẳng dài trên nền sáng: sơ đồ kết cấu, không phải dòng chữ. */
export function looksLikeTechnicalLineArt(stats: {
  inkRatio: number
  thinRatio: number
  longRunShare: number
  lightBg: boolean
}): boolean {
  const sparseInk = stats.lightBg && stats.inkRatio >= 0.012 && stats.inkRatio <= 0.35
  if (!sparseInk) return false
  if (stats.thinRatio >= 0.62) return true
  return stats.thinRatio >= 0.15 && stats.longRunShare >= 0.15
}

export async function overlayRegionIsTechnicalLineArt(
  imageBytes: Buffer,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): Promise<boolean> {
  if (!overlayBoxIsOversized(box, imageWidth, imageHeight)) return false
  const left = Math.max(0, Math.min(imageWidth - 1, Math.round(box.x)))
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)))
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(box.width)))
  const height = Math.max(1, Math.min(imageHeight - top, Math.round(box.height)))
  const pipeline = sharp(imageBytes).extract({ left, top, width, height }).greyscale()
  if (width * height > 500_000) {
    const scale = Math.sqrt(500_000 / (width * height))
    pipeline.resize({
      width: Math.max(32, Math.round(width * scale)),
      height: Math.max(32, Math.round(height * scale)),
      fit: 'fill',
      kernel: 'nearest',
    })
  }
  const extracted = await pipeline.raw().toBuffer({ resolveWithObject: true })
  return looksLikeTechnicalLineArt(
    measureTechnicalLineArt(extracted.data, extracted.info.width, extracted.info.height)
  )
}

export function dropOversizedSingleWordOverlays(
  items: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): OverlayItem[] {
  return items.filter((item) => !isOversizedSingleWordOverlay(item, imageWidth, imageHeight))
}

function isParagraphContinuation(previous: OverlayItem, next: OverlayItem, imageWidth: number): boolean {
  if (previous.bbox.width < imageWidth * 0.42 || next.bbox.width < imageWidth * 0.28) return false
  if (next.bbox.width >= previous.bbox.width - 8) return false
  if (Math.abs(previous.bbox.x - next.bbox.x) > 16) return false
  const gap = next.bbox.y - (previous.bbox.y + previous.bbox.height)
  return gap >= -2 && gap <= 16
}

/** Hai dòng chú thích xếp chồng thành một đoạn để chữ Việt xuống dòng trong cùng một ô. */
export function mergeStackedParagraphLines(items: OverlayItem[], imageWidth: number): OverlayItem[] {
  if (items.length < 2 || imageWidth < 1) return items
  const sorted = [...items].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
  const used = new Set<OverlayItem>()
  const out: OverlayItem[] = []
  for (const item of sorted) {
    if (used.has(item)) continue
    const group = [item]
    used.add(item)
    let last = item
    for (const other of sorted) {
      if (used.has(other) || !isParagraphContinuation(last, other, imageWidth)) continue
      group.push(other)
      used.add(other)
      last = other
    }
    if (group.length === 1) {
      out.push(item)
      continue
    }
    const [x1, y1, x2, y2] = overlayUnion(group)
    out.push({
      bbox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
      translatedText: group.map((entry) => entry.translatedText.trim()).filter(Boolean).join(' '),
      eraseOriginal: group.some((entry) => entry.eraseOriginal),
    })
  }
  return out
}

/** Bỏ cụm ngắn trên nền lớn trước và sau khi gộp, để ô đó không nuốt bản vẽ. */
export function layoutImageLocOverlays(
  items: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): OverlayItem[] {
  const rest = dropOversizedSingleWordOverlays(mergeStackedParagraphLines(items, imageWidth), imageWidth, imageHeight)
  if (overlayItemsLookLikeTable(rest)) return rest
  const merged = mergeDenseImageLocOverlayItems(rest, imageWidth, imageHeight)
  return dropOversizedSingleWordOverlays(merged, imageWidth, imageHeight)
}

function overlayModelCodeStaysApart(group: OverlayItem[], item: OverlayItem): boolean {
  const texts = [...group.map((entry) => entry.translatedText), item.translatedText]
  const code = texts.some((text) => isModelCodeToken(text))
  const sentence = texts.some((text) => text.trim().split(/\s+/).length >= 4)
  return code && sentence
}

function isModelCodeToken(text: string): boolean {
  const token = text.trim()
  return /^[A-Z0-9][A-Z0-9-]{2,11}$/i.test(token) && /\d/.test(token) && /[A-Za-z]/.test(token)
}

export type LocalDrawOutcome = { kind: 'drawn'; bytes: Buffer } | { kind: 'unchanged' }

export async function localDrawTranslated(
  imageBytes: Buffer,
  blocks: ImageLocOcrBlock[],
  language: string,
  userId?: string | null
): Promise<LocalDrawOutcome> {
  const metadata = await sharp(imageBytes).metadata()
  const imageWidth = metadata.width || 1
  const imageHeight = metadata.height || 1
  const drawableBlocks = blocks.filter((block) => !block.layoutOnly)
  const modelObstacles: OverlayItem[] = blocks
    .filter((block) => isModelCodeToken(block.text || '') && !hasChineseText(block.text || ''))
    .map((block) => ({
      bbox: {
        x: block.bbox[0],
        y: block.bbox[1],
        width: Math.max(1, block.bbox[2] - block.bbox[0]),
        height: Math.max(1, block.bbox[3] - block.bbox[1]),
      },
      translatedText: '',
    }))
  const obstacles: OverlayItem[] = []
  const redrawLatin: OverlayItem[] = []
  for (const block of blocks) {
    if (!block.layoutOnly || !(block.text || '').trim()) continue
    const bbox = {
      x: block.bbox[0],
      y: block.bbox[1],
      width: Math.max(1, block.bbox[2] - block.bbox[0]),
      height: Math.max(1, block.bbox[3] - block.bbox[1]),
    }
    const spaced = spaceSpecPunctuation(block.text || '')
    if (spaced.includes('\n')) redrawLatin.push({ bbox, translatedText: spaced })
    else obstacles.push({ bbox, translatedText: (block.text || '').trim() })
  }
  const prepared = drawableBlocks.map((block) => {
    const raw = convertJinWeightText(block.text || '').trim()
    const box = {
      x: block.bbox[0],
      y: block.bbox[1],
      width: Math.max(1, block.bbox[2] - block.bbox[0]),
      height: Math.max(1, block.bbox[3] - block.bbox[1]),
    }
    const peeled = overlayItemLooksLikeEdgeBanner({ bbox: box }, imageWidth, imageHeight)
      ? splitTrailingModelCode(raw)
      : { text: raw, code: '' }
    return {
      block,
      source: peeled.text,
      translated: '',
      eraseOriginal: !raw,
    }
  })
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
    const phrase = collapseBilingualGlossTranslation(item.source, (translated[index] || '').trim())
    item.translated = stripInventedLeadingModelCode(item.source, phrase)
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
  const attached = attachTrailingMeasurements(overlayItems, [...obstacles, ...modelObstacles])
  overlayItems = layoutImageLocOverlays([...attached.items, ...redrawLatin], imageWidth, imageHeight)
  const drawable: OverlayItem[] = []
  for (const item of overlayItems) {
    if (await overlayRegionIsTechnicalLineArt(imageBytes, item.bbox, imageWidth, imageHeight)) continue
    drawable.push(item)
  }
  overlayItems = drawable
  if (!overlayItems.length) return { kind: 'unchanged' }
  const png = await overlayTranslatedText(imageBytes, overlayItems, {
    sampleBackground: true,
    obstacles: attached.obstacles,
  })
  const q = imageLocJpegQuality()
  return { kind: 'drawn', bytes: await sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer() }
}

export async function encodeJpeg(imageBytes: Buffer): Promise<Buffer> {
  const q = imageLocJpegQuality()
  return sharp(imageBytes).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export { localBlocksNeedDraw, hasChineseText }
