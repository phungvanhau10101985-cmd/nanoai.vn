'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'

/**
 * Rewrites user input as a concise English image-generation prompt.
 * Literal copy that must appear in the image stays in its original language.
 */
export async function normalizeToEnglish(text: string): Promise<string> {
  if (!text?.trim()) return ''
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const configs = [
    GEMINI_25_FLASH_TEXT_NO_THINKING,
    { model: 'gemini-2.0-flash' as const, generationConfig: { responseModalities: ['TEXT'] as const } },
    { model: 'gemini-3-flash-preview' as const, generationConfig: { responseModalities: ['TEXT'] as const } },
  ]
  for (const config of configs) {
    try {
      const model = genAI.getGenerativeModel(config)
      const result = await model.generateContent(
        `Rewrite the following input as a clear, concise ENGLISH prompt for an AI image-generation model.
Translate and organize only the visual instructions and descriptions.
LANGUAGE LOCK: Preserve brand names, product names, ingredients, instructions, slogans, proper nouns, numbers, units, URLs, and every literal string requested to appear in the image exactly as supplied. Never translate, transliterate, rewrite, spell-correct, or summarize printed copy. Wrap each preserved literal string in quotation marks.
Do not add visual elements, measurements, mockups, annotations, or requirements that are not present in the input.
Return only the rewritten prompt, with no explanation.

Input:
${text.trim()}`
      )
      trackFromUsageMetadata(result.response.usageMetadata, config.model, 'ai-normalize')
      const out = result.response.text()?.trim() || text.trim()
      return out || text.trim()
    } catch {
      continue
    }
  }
  return text.trim()
}
