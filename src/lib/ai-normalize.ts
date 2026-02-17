'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/**
 * Chuẩn hóa văn bản tiếng Việt (hoặc ngôn ngữ khác) sang tiếng Anh bằng Gemini.
 * Dùng cho mọi input khách nhập trước khi gửi vào prompt cho AI tạo ảnh.
 */
export async function normalizeToEnglish(text: string): Promise<string> {
  if (!text?.trim()) return ''
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  for (const modelId of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3-flash-preview']) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: { responseModalities: ['TEXT'] },
      })
      const result = await model.generateContent(
        `Translate this text to clear English. Return ONLY the English text, no explanation. If already in English, return as-is. Text: "${text.trim()}"`
      )
      trackFromUsageMetadata(result.response.usageMetadata, modelId, 'ai-normalize')
      const out = result.response.text()?.trim() || text.trim()
      return out || text.trim()
    } catch {
      continue
    }
  }
  return text.trim()
}
