import sharp from 'sharp'
import { documentOcrWithScale, type TextWithBbox } from '@/lib/vision-ocr'
import { hasVisionConfig } from '@/lib/vision-api'
import { overlayTranslatedText } from '@/lib/translate-overlay'
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
  userId?: string | null
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
      }),
    'Google Vision OCR'
  )
  return { blocks: ocrBlocksFromVision(results, scale), scale }
}

async function translateBlocksDeepseek(
  texts: string[],
  language: string,
  userId?: string | null
): Promise<string[]> {
  if (!texts.length) return []
  const target = LANGUAGE_LABELS[language] || language || 'Vietnamese'
  const system =
    'You translate e-commerce product-image OCR snippets. Return JSON {"translations":["t1","t2",...]} in the SAME ORDER. Convert 斤 to kg. Remove website URLs. If a snippet is only a domain or year, return empty string. Keep numbers/units. No markdown.'
  const user = `Target language: ${target}\nTexts:\n${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  return imageLocSmartRetry(async () => {
    const res = await deepseekPartnerChat(system, user, {
      feature: 'image-localization-deepseek-translate',
      userId: userId ?? null,
    })
    if ('error' in res && res.error) {
      const msg = String(res.error)
      if (/missing|not configured|api.?key/i.test(msg)) {
        throw new ImageLocalizationError(`deepseek_missing_key: ${msg}`)
      }
      throw new ImageLocalizationError(`DeepSeek dịch lỗi: ${msg}`)
    }
    const raw = String((res as { text?: string }).text || '').trim()
    const match = raw.match(/\{[\s\S]*"translations"[\s\S]*\}/)
    try {
      const parsed = JSON.parse(match ? match[0] : raw) as { translations?: unknown }
      if (!Array.isArray(parsed.translations)) throw new Error('response thiếu translations[]')
      const translations = parsed.translations.map((t) => (typeof t === 'string' ? t : String(t ?? '')))
      while (translations.length < texts.length) translations.push('')
      return translations.slice(0, texts.length)
    } catch (e) {
      throw new ImageLocalizationError(`DeepSeek trả JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, 'DeepSeek dịch ảnh')
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
  const overlayItems = prepared
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
  const png = await overlayTranslatedText(imageBytes, overlayItems, { sampleBackground: true })
  const q = imageLocJpegQuality()
  return sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export async function encodeJpeg(imageBytes: Buffer): Promise<Buffer> {
  const q = imageLocJpegQuality()
  return sharp(imageBytes).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export { localBlocksNeedDraw, hasChineseText }
