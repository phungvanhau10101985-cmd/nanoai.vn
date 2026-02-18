'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/**
 * Chuẩn hóa yêu cầu người dùng về tiếng Việt rõ ràng, mạch lạc bằng Gemini.
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
        `Hãy viết lại nội dung sau bằng TIẾNG VIỆT rõ ràng, ngắn gọn, dễ hiểu.
Chỉ trả về đúng câu đã viết lại, không thêm giải thích.
Nếu nội dung đã là tiếng Việt rõ ràng thì giữ nguyên ý chính.
Nội dung: "${text.trim()}"`
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
