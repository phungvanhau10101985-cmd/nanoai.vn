import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Payload = {
  learnerText?: string
  referenceSentence?: string
  teacherText?: string
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: 0 | 1 | 2 | 3 | 4
  taskType?: 'copy' | 'guided_rewrite' | 'rewrite' | 'context_response' | 'advanced_response'
}

type EvalResult = {
  score: number
  passed: boolean
  correctedText: string
  feedback: string
  shortHint: string
}

function safeParse(text: string): EvalResult | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<EvalResult>
    const scoreRaw = Number(parsed.score)
    const score = Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, Math.round(scoreRaw))) : 0
    const correctedText = String(parsed.correctedText || '').trim()
    const feedback = String(parsed.feedback || '').trim()
    const shortHint = String(parsed.shortHint || '').trim()
    if (!feedback) return null
    return {
      score,
      passed: Boolean(parsed.passed),
      correctedText,
      feedback,
      shortHint,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const learnerText = String(payload.learnerText || '').trim()
    const referenceSentence = String(payload.referenceSentence || '').trim()
    const teacherText = String(payload.teacherText || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const rawLevel = Number(payload.learnerLevel)
    const learnerLevel: 0 | 1 | 2 | 3 | 4 =
      rawLevel === 4 ? 4 : rawLevel === 3 ? 3 : rawLevel === 2 ? 2 : rawLevel === 1 ? 1 : 0
    const taskType = payload.taskType || 'rewrite'
    if (!learnerText) {
      return NextResponse.json({ error: 'Thiếu câu học sinh viết.' }, { status: 400 })
    }
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const passRule =
      learnerLevel === 0 ? 'passed=true khi score >= 90'
      : learnerLevel === 1 ? 'passed=true khi score >= 82'
      : learnerLevel === 2 ? 'passed=true khi score >= 75'
      : learnerLevel === 3 ? 'passed=true khi score >= 72'
      : 'passed=true khi score >= 70'
    const prompt = `Bạn là giám khảo bài viết micro-writing cho học ngoại ngữ.
Đầu vào:
- targetLanguage: ${targetLanguage}
- nativeLanguage: ${nativeLanguage}
- learnerLevel: ${learnerLevel}
- taskType: ${taskType}
- referenceSentence: ${referenceSentence || '(trống)'}
- teacherContext: ${teacherText || '(trống)'}
- learnerText: ${learnerText}

Yêu cầu:
1) Chấm score 0-100 theo đúng taskType và level.
2) correctedText: câu sửa tự nhiên bằng ${targetLanguage} (ngắn).
3) feedback: giải thích ngắn bằng ${nativeLanguage}, tối đa 2 câu.
4) shortHint: gợi ý 1 câu rất ngắn bằng ${nativeLanguage}.
5) ${passRule}
6) Không dùng ngôn ngữ thứ ba ngoài cặp ${targetLanguage} + ${nativeLanguage}.

Trả về JSON hợp lệ:
{
  "score": 0,
  "passed": false,
  "correctedText": "...",
  "feedback": "...",
  "shortHint": "..."
}`

    const result = await model.generateContent(prompt)
    const parsed = safeParse(result.response.text?.() || '')
    if (!parsed) {
      return NextResponse.json({
        score: 60,
        passed: false,
        correctedText: learnerText,
        feedback: `Câu của bạn cần chỉnh thêm để tự nhiên hơn trong ${targetLanguage}.`,
        shortHint: 'Hãy viết ngắn gọn hơn và bám đúng ý chính.',
      })
    }
    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
