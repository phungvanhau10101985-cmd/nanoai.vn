import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type TeacherAccent = 'uk' | 'us'
type TeacherGender = 'female' | 'male'

type ChatMessage = {
  role: 'teacher' | 'student'
  text: string
}

type Correction = {
  original: string
  fixed: string
  explanationVi: string
}

type ChatPayload = {
  studentText?: string
  history?: ChatMessage[]
  accent?: TeacherAccent
  gender?: TeacherGender
  mode?: 'chat' | 'story'
  targetLanguage?: string
  teacherLabel?: string
  teacherLocale?: string
}

function safeJsonParse(text: string): {
  reply: string
  corrections: Correction[]
  pronunciationTips: string[]
} | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as {
      reply?: string
      corrections?: Correction[]
      pronunciationTips?: string[]
    }
    if (!parsed.reply || typeof parsed.reply !== 'string') return null
    return {
      reply: parsed.reply,
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 5) : [],
      pronunciationTips: Array.isArray(parsed.pronunciationTips) ? parsed.pronunciationTips.slice(0, 5) : [],
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as ChatPayload
    const studentText = String(payload.studentText || '').trim()
    const history = Array.isArray(payload.history) ? payload.history.slice(-10) : []
    const accent: TeacherAccent = payload.accent === 'uk' ? 'uk' : 'us'
    const gender: TeacherGender = payload.gender === 'male' ? 'male' : 'female'
    const mode = payload.mode === 'story' ? 'story' : 'chat'
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const teacherLabel = String(payload.teacherLabel || '').trim()
    const teacherLocale = String(payload.teacherLocale || '').trim()

    if (!studentText) {
      return NextResponse.json({ error: 'Thiếu nội dung học sinh.' }, { status: 400 })
    }

    const accentLabel = accent === 'uk' ? 'Anh - UK' : 'Mỹ - US'
    const genderLabel = gender === 'male' ? 'thầy giáo' : 'cô giáo'
    const teacherIdentity = teacherLabel || `${genderLabel} bản địa (${accentLabel})`
    const modeGuide =
      mode === 'story'
        ? `Ưu tiên kể chuyện ngắn bằng ${targetLanguage} nhẹ nhàng, thân thiện như trò chuyện đời thường.`
        : `Ưu tiên hội thoại đời thường bằng ${targetLanguage}, câu ngắn dễ hiểu và thân thiện.`

    const transcript = history
      .map((m) => `${m.role === 'teacher' ? 'Teacher' : 'Student'}: ${m.text}`)
      .join('\n')

    const systemPrompt = `Bạn là ${teacherIdentity} đang dạy học sinh Việt Nam.
Mục tiêu:
1) Trả lời bằng ${targetLanguage} tự nhiên, nhẹ nhàng, dễ hiểu.
2) Nếu học sinh sai ngữ pháp/từ vựng/phát âm (suy ra từ câu), hãy sửa NGAY nhưng lịch sự.
3) Giữ hội thoại tương tác như nói chuyện thật.
4) ${modeGuide}
5) Nếu cần, thêm 1 câu dịch nghĩa tiếng Việt ngắn ở cuối để học sinh hiểu.
6) Ưu tiên cách nói bản địa đúng theo locale: ${teacherLocale || 'auto'}.

Đầu ra BẮT BUỘC là JSON hợp lệ, không markdown:
{
  "reply": "câu trả lời của giáo viên bằng ngôn ngữ mục tiêu",
  "corrections": [
    { "original": "...", "fixed": "...", "explanationVi": "giải thích tiếng Việt ngắn gọn" }
  ],
  "pronunciationTips": ["mẹo phát âm ngắn bằng tiếng Việt", "..."]
}`

    const userPrompt = `Lịch sử gần đây:
${transcript || '(trống)'}

Học sinh vừa nói:
${studentText}

Hãy trả về đúng JSON theo format đã yêu cầu.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent([systemPrompt, userPrompt])
    const text = result.response.text()?.trim() || ''
    const parsed = safeJsonParse(text)

    if (!parsed) {
      return NextResponse.json({
        reply: 'Great try! Could you say that one more time in a short sentence?',
        corrections: [],
        pronunciationTips: ['Nói chậm hơn một chút để phát âm rõ từng từ.'],
      })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

