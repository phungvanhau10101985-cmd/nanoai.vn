'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'

/**
 * Chuẩn hóa yêu cầu người dùng về tiếng Việt rõ ràng, mạch lạc bằng Gemini.
 * Dùng cho mọi input khách nhập trước khi gửi vào prompt cho AI tạo ảnh.
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
        `Hãy viết lại nội dung sau bằng TIẾNG VIỆT rõ ràng, ngắn gọn, dễ hiểu.
Chỉ trả về đúng câu đã viết lại, không thêm giải thích.
Nếu nội dung đã là tiếng Việt rõ ràng thì giữ nguyên ý chính.
Nội dung: "${text.trim()}"`
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
