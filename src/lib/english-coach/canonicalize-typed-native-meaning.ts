import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  trackEnglishCoachGeminiResult,
  type EnglishCoachUsageContext,
} from '@/lib/english-coach-api-usage'
import {
  getMeaningCanonicalCachePg,
  upsertMeaningCanonicalCachePg,
} from '@/lib/db/language-coach-misc-pg'
import { normalizeDialogueMeaningKey } from '@/lib/english-coach/dialogue-meaning-key'
import {
  buildTypedMeaningCanonicalPrompt,
  meaningCanonicalCacheKey,
  parseCanonicalMeaning,
} from '@/lib/english-coach/native-meaning-canonical'

/** Chuẩn hóa câu gõ. Cùng câu chữ lần sau đọc cache. Lỗi thì giữ câu gốc để buổi học vẫn chạy. */
export async function canonicalizeTypedNativeMeaning(input: {
  apiKey: string
  text: string
  nativeLanguage: string
  nativeLanguageCode: string
  userId?: string | null
  coachUsageContext: EnglishCoachUsageContext
}): Promise<string> {
  const text = String(input.text || '').replace(/\s+/g, ' ').trim()
  if (!text || !normalizeDialogueMeaningKey(text)) return text
  const cacheKey = meaningCanonicalCacheKey(input.nativeLanguageCode, text)
  const cached = await getMeaningCanonicalCachePg(cacheKey)
  if (cached) return cached
  try {
    const ai = new GoogleGenerativeAI(input.apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(buildTypedMeaningCanonicalPrompt({
      text,
      nativeLanguage: input.nativeLanguage,
      nativeLanguageCode: input.nativeLanguageCode,
    }))
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.meaningCanonical,
      input.userId,
      input.coachUsageContext,
    )
    const meaning = parseCanonicalMeaning(result.response.text() || '')
    if (!meaning || !normalizeDialogueMeaningKey(meaning)) return text
    await upsertMeaningCanonicalCachePg({
      cacheKey,
      nativeLanguage: input.nativeLanguage,
      sourceText: text,
      canonicalText: meaning,
    })
    return meaning
  } catch (e) {
    console.error('[canonicalize-typed-native-meaning]', e)
    return text
  }
}
