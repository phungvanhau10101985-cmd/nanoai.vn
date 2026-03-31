/**
 * Hậu kiểm dịch ảnh: OCR phát hiện chữ còn sót, dịch nốt và overlay lên ảnh.
 * Dùng cho TẤT CẢ các ảnh đã dịch – đảm bảo không còn chữ nguồn sót lại.
 */

import type { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { documentOcrWithScale } from './vision-ocr'
import { hasVisionConfig } from './vision-api'
import { overlayTranslatedText } from './translate-overlay'

const TARGET_LANGUAGES: Record<string, string> = {
  vi: 'Vietnamese', en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  'zh-tw': 'Chinese Traditional', th: 'Thai', id: 'Indonesian', ms: 'Malay',
  fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
}

export interface PostCheckOptions {
  sourceLang: string
  sourceLang2?: string | null
  targetLang: string
  logPrefix?: string
  /** Ghi api_usage_log (hậu kiểm Flash) — nên truyền khi có user. */
  userId?: string | null
}

/**
 * Hậu kiểm: OCR ảnh kết quả, phát hiện chữ còn sót (ngôn ngữ nguồn), dịch nốt và overlay.
 * Nếu chưa cấu hình Vision API hoặc lỗi → trả về ảnh gốc (không overlay).
 */
export async function applyPostCheckOcr(
  resultBuffer: Buffer,
  genAI: GoogleGenerativeAI,
  options: PostCheckOptions
): Promise<Buffer> {
  if (!hasVisionConfig()) {
    if (options.logPrefix) console.log(`${options.logPrefix} Bỏ qua OCR hậu kiểm: chưa cấu hình Vision API`)
    return resultBuffer
  }

  const { sourceLang, sourceLang2, targetLang, logPrefix = '[post-check]', userId = null } = options

  try {
    const { results: ocrResults, scale } = await documentOcrWithScale(resultBuffer, {
      userId,
      feature: 'dich-anh-tai-lieu-vision-ocr',
    })
    const textList = ocrResults.map((r) => r.text).filter(Boolean).slice(0, 100)
    if (textList.length === 0) return resultBuffer

    const sourceNames = sourceLang2
      ? `${TARGET_LANGUAGES[sourceLang] || sourceLang} and ${TARGET_LANGUAGES[sourceLang2] || sourceLang2}`
      : TARGET_LANGUAGES[sourceLang] || sourceLang
    const targetName = TARGET_LANGUAGES[targetLang] || targetLang

    const verifyPrompt = `This image was translated from ${sourceNames} to ${targetName}. Which segments are STILL in the source language(s)? Return JSON: {"missed":["exact text 1","exact text 2"]}. If none: {"missed":[]}. Ignore: numbers, codes, units, brand names.`
    const flashModel = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]

    const verifyResult = await flashModel.generateContent([`${verifyPrompt}\n\nTexts:\n${textList.join('\n')}`], { safetySettings })
    void trackFromUsageMetadata(
      verifyResult.response.usageMetadata,
      GEMINI_25_FLASH_TEXT_NO_THINKING.model,
      'dich-anh-tai-lieu-postcheck-verify',
      userId,
      null
    )
    const verifyText = verifyResult.response.text?.() || '{}'
    const jsonMatch = verifyText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    const missed: string[] = Array.isArray(parsed?.missed) ? parsed.missed.filter((t: unknown) => typeof t === 'string' && (t as string).trim()) : []

    if (missed.length === 0) {
      if (logPrefix) console.log(`${logPrefix} Không có đoạn sót (hậu kiểm OK)`)
      return resultBuffer
    }

    const missedSet = new Set(missed.map((m) => m.trim().toLowerCase()))
    const itemsWithBbox = ocrResults.filter((r) => {
      if (!r.text?.trim()) return false
      const t = r.text.trim()
      return missedSet.has(t.toLowerCase()) || [...missedSet].some((m) => t.toLowerCase().includes(m) || m.includes(t.toLowerCase()))
    })

    if (itemsWithBbox.length === 0) return resultBuffer

    const translatePrompt = `Translate these from ${sourceNames} to ${targetName}. Return JSON: {"translations":["t1","t2",...]} in SAME ORDER.`
    const transResult = await flashModel.generateContent([`${translatePrompt}\n\nTexts:\n${itemsWithBbox.map((r) => r.text).join('\n')}`], { safetySettings })
    void trackFromUsageMetadata(
      transResult.response.usageMetadata,
      GEMINI_25_FLASH_TEXT_NO_THINKING.model,
      'dich-anh-tai-lieu-postcheck-translate',
      userId,
      null
    )
    const transText = (transResult.response.text?.() || '{}').trim()
    const transMatch = transText.match(/\{[\s\S]*"translations"[\s\S]*?\}/)
    let translations: string[] = []
    try {
      const transParsed = transMatch ? JSON.parse(transMatch[0]) : {}
      translations = Array.isArray(transParsed?.translations) ? transParsed.translations.filter((t: unknown) => typeof t === 'string') : []
    } catch {
      //
    }

    const invScale = scale > 0 ? 1 / scale : 1
    const overlayItems = itemsWithBbox.slice(0, translations.length).map((r, idx) => ({
      bbox: {
        x: r.bbox.x * invScale,
        y: r.bbox.y * invScale,
        width: r.bbox.width * invScale,
        height: r.bbox.height * invScale,
      },
      translatedText: translations[idx] ?? r.text,
    }))

    if (overlayItems.length === 0) return resultBuffer

    const finalBuffer = await overlayTranslatedText(resultBuffer, overlayItems)
    if (logPrefix) console.log(`${logPrefix} Overlay ${overlayItems.length} đoạn sót`)
    return finalBuffer
  } catch (e) {
    console.error(`${logPrefix} OCR/overlay lỗi (bỏ qua, dùng ảnh gốc):`, e instanceof Error ? e.message : e)
    return resultBuffer
  }
}
