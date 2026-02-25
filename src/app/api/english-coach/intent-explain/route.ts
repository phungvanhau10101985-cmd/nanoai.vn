import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Payload = {
  studentText?: string
  intentAnswer?: string
  correctedSentence?: string
  correctionNote?: string
  targetLanguage?: string
  targetLanguageCode?: string
  nativeLanguage?: string
  topicLabel?: string
}

function normalizeShortMeaning(text: string): string {
  const compact = String(text || '').replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  if (compact.length <= 360) return compact
  return `${compact.slice(0, 357).trim()}...`
}

function safeParse(text: string): { explanation: string } | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  const tryParse = (candidate: string): { explanation: string } | null => {
    const parsed = JSON.parse(candidate) as { explanation?: unknown }
    const explanation = String(parsed.explanation || '').trim()
    if (!explanation) return null
    return { explanation }
  }
  try {
    return tryParse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return tryParse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as Payload
    const studentText = String(payload.studentText || '').trim()
    const intentAnswer = String(payload.intentAnswer || '').trim()
    const correctedSentence = String(payload.correctedSentence || '').trim()
    const correctionNote = String(payload.correctionNote || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const topicLabel = String(payload.topicLabel || '').trim()

    if (!intentAnswer) {
      return NextResponse.json({ error: 'Thiếu câu trả lời cần giải thích.' }, { status: 400 })
    }

    const prompt = `Bạn là giáo viên ngôn ngữ đa ngữ.
Nhiệm vụ: chỉ DỊCH Ý 3 theo đúng ngữ cảnh hội thoại, viết bằng ${nativeLanguage}.

Ngữ cảnh:
- Câu học sinh vừa nói: ${studentText || '(không có)'}
- Ý 1 (sửa lỗi): ${correctionNote || '(không có)'}
- Ý 2 (câu sửa hoàn chỉnh): ${correctedSentence || '(không có)'}
- Ý 3 cần giải thích: ${intentAnswer}
- Chủ đề buổi học: ${topicLabel || '(không có)'}
- Ngôn ngữ đang học: ${targetLanguage}

Yêu cầu:
1) Trả về đúng nghĩa của Ý 3 theo ngữ cảnh hiện tại, diễn đạt rõ ràng cho người học.
2) Viết 2-3 câu ngắn, bám sát ngữ cảnh thực tế.
3) Không phân tích ngữ pháp, không liệt kê thêm, không ghi chú ngoài lề.
4) Không dùng ngôn ngữ thứ ba ngoài ${nativeLanguage}.
5) Nếu có từ dễ nhầm, chọn nghĩa đúng ngữ cảnh và dịch luôn, không diễn giải thêm.

Trả về JSON hợp lệ, không markdown:
{
  "explanation": "..."
}`

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    const parsed = safeParse(text)

    if (!parsed) {
      return NextResponse.json({
        explanation: nativeLanguage.toLowerCase().includes('vietnamese')
          ? 'Ý 3 là câu trả lời tự nhiên của giáo viên trong ngữ cảnh hiện tại.'
          : 'Idea 3 is the teacher natural contextual reply for this context.',
      })
    }

    return NextResponse.json({ explanation: normalizeShortMeaning(parsed.explanation) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

