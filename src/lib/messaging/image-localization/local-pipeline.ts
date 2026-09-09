import sharp from 'sharp'
import { documentOcrWithScale, type TextWithBbox } from '@/lib/vision-ocr'
import { hasVisionConfig } from '@/lib/vision-api'
import { overlayTranslatedText } from '@/lib/translate-overlay'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { LANGUAGE_LABELS, imageLocJpegQuality } from './image-localization-config'
import {
  convertJinWeightText,
  hasChineseText,
  localBlocksNeedDraw,
  type ImageLocOcrBlock,
} from './image-localization-classifier'
import { ImageLocalizationError } from './gemini-adapter'

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
      'Chưa cấu hình Google Cloud Vision (VISION_CREDENTIALS_PATH / GOOGLE_APPLICATION_CREDENTIALS).'
    )
  }
  const { results, scale } = await documentOcrWithScale(imageBytes, {
    userId: userId ?? null,
    feature: 'image-localization-vision-ocr',
  })
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
  let translations: string[] = []
  try {
    const parsed = JSON.parse(match ? match[0] : raw) as { translations?: unknown }
    if (Array.isArray(parsed.translations)) {
      translations = parsed.translations.map((t) => (typeof t === 'string' ? t : String(t ?? '')))
    }
  } catch {
    translations = texts.map((t) => convertJinWeightText(t))
  }
  while (translations.length < texts.length) translations.push('')
  return translations.slice(0, texts.length)
}

export async function localDrawTranslated(
  imageBytes: Buffer,
  blocks: ImageLocOcrBlock[],
  language: string,
  userId?: string | null
): Promise<Buffer> {
  const needTranslate = blocks.map((b) => {
    const t = convertJinWeightText(b.text || '')
    return { ...b, text: t }
  })
  const sources = needTranslate.map((b) => b.text)
  const translated = await translateBlocksDeepseek(sources, language, userId)
  const overlayItems = needTranslate.map((b, i) => ({
    bbox: {
      x: b.bbox[0],
      y: b.bbox[1],
      width: Math.max(1, b.bbox[2] - b.bbox[0]),
      height: Math.max(1, b.bbox[3] - b.bbox[1]),
    },
    translatedText: (translated[i] || '').trim(),
  }))
  const png = await overlayTranslatedText(imageBytes, overlayItems)
  const q = imageLocJpegQuality()
  return sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export async function encodeJpeg(imageBytes: Buffer): Promise<Buffer> {
  const q = imageLocJpegQuality()
  return sharp(imageBytes).jpeg({ quality: q, mozjpeg: true }).toBuffer()
}

export { localBlocksNeedDraw, hasChineseText }
