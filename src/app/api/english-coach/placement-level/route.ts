import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Payload = {
  targetLanguage?: string
  nativeLanguage?: string
  samples?: string[]
}

type PlacementResult = {
  recommendedLevel: 0 | 1 | 2 | 3 | 4
  confidence: number
  reason: string
}

function safeParsePlacement(text: string): PlacementResult | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<PlacementResult>
    const rawLevel = Number(parsed.recommendedLevel)
    const recommendedLevel: 0 | 1 | 2 | 3 | 4 =
      rawLevel === 4 ? 4 : rawLevel === 3 ? 3 : rawLevel === 2 ? 2 : rawLevel === 1 ? 1 : 0
    const rawConfidence = Number(parsed.confidence)
    const confidence = Number.isFinite(rawConfidence)
      ? Math.min(100, Math.max(0, Math.round(rawConfidence)))
      : 60
    const reason = String(parsed.reason || '').trim()
    if (!reason) return null
    return { recommendedLevel, confidence, reason }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const samples = Array.isArray(payload.samples)
      ? payload.samples.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5)
      : []

    if (samples.length < 2) {
      return NextResponse.json({ error: 'Cần ít nhất 2 câu để ước lượng level.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = `Bạn là trợ lý phân loại trình độ người học ngoại ngữ.
Mục tiêu: gợi ý level 0-4 cho học viên dựa trên các câu họ tự nói.

Ngôn ngữ đang học: ${targetLanguage}
Ngôn ngữ mẹ đẻ: ${nativeLanguage}
Mẫu câu học viên:
${samples.map((s, i) => `${i + 1}) ${s}`).join('\n')}

Quy tắc level:
- 0: mới bắt đầu, câu rời rạc/thiếu cấu trúc rõ.
- 1: câu rất ngắn, lỗi cơ bản nhiều nhưng hiểu được.
- 2: câu đơn tương đối ổn, vẫn lỗi thì/ngữ pháp/từ vựng.
- 3: hội thoại trung cấp, câu dài vừa, lỗi không nhiều.
- 4: hội thoại nâng cao, diễn đạt tự nhiên, lỗi ít.

Yêu cầu:
1) Phân tích theo ngôn ngữ đang học ${targetLanguage}, không đánh giá theo ngôn ngữ mẹ đẻ.
2) Trả về JSON hợp lệ, không markdown:
{
  "recommendedLevel": 0,
  "confidence": 0,
  "reason": "1-2 câu ngắn giải thích lý do"
}`

    const result = await model.generateContent(prompt)
    const parsed = safeParsePlacement(result.response.text?.() || '')
    if (!parsed) {
      return NextResponse.json(
        {
          recommendedLevel: 1,
          confidence: 50,
          reason: 'Không đủ chắc chắn để chấm chính xác. Mặc định đề xuất level cơ bản và có thể điều chỉnh thủ công.',
        },
        { status: 200 }
      )
    }
    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
