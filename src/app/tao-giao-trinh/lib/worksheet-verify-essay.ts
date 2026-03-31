import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const VERIFY_PROMPT = `Bạn là giáo viên kiểm tra chất lượng. Đối chiếu GIÁO TRÌNH với bài tự luận.

GIÁO TRÌNH:
---
{curriculum}
---

ĐỀ BÀI:
---
{problem}
---

LỜI GIẢI:
---
{solution}
---

Nhiệm vụ: Lời giải có đúng với đề bài không? Công thức, bước giải có logic không? Có sai sót kiến thức không?

Nếu SAI – BẮT BUỘC trả về các trường đã sửa. Sai ở đâu sửa ở đó, KHÔNG tạo lại bài mới.

Trả về JSON:
- verified: true nếu mọi thứ đúng
- verified: false thì BẮT BUỘC điền problem và/hoặc solution đã sửa. Không được để trống khi sai.`

function parseVerifyResult(raw: string): { verified: boolean; reason?: string; problem?: string; solution?: string } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const v = JSON.parse(cleaned) as { verified?: boolean; reason?: string; problem?: string; solution?: string }
    return {
      verified: v.verified === true,
      reason: v.reason,
      problem: typeof v.problem === 'string' ? v.problem : undefined,
      solution: typeof v.solution === 'string' ? v.solution : undefined,
    }
  } catch {
    return null
  }
}

async function verifyWithGemini(
  curriculum: string,
  problem: string,
  solution: string,
  userId?: string | null
): Promise<{ verified: boolean; reason?: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const prompt = VERIFY_PROMPT.replace('{curriculum}', curriculum.slice(0, 3000)).replace('{problem}', problem).replace('{solution}', solution)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const res = await model.generateContent(prompt)
  void trackFromUsageMetadata(
    res.response.usageMetadata,
    GEMINI_25_FLASH_NO_THINKING.model,
    'worksheet-verify-essay-api-flash',
    userId ?? null
  )
  const raw = res.response.text()?.trim() || ''
  return raw ? parseVerifyResult(raw) : null
}

/** Kiểm tra bài tự luận: đề có khớp lời giải không, công thức đúng không. Khi sai trả về problem/solution đã sửa. */
export async function verifyEssay(
  curriculumMarkdown: string,
  problem: string,
  solution: string,
  userId?: string | null
): Promise<{ verified: boolean; reason?: string; problem?: string; solution?: string }> {
  const result = await verifyWithGemini(curriculumMarkdown, problem, solution, userId)
  return result ?? { verified: false }
}
