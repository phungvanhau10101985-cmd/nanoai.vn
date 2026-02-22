import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })

    const form = await request.formData()
    const image = form.get('image') as File | null
    const requestedLanguage = String(form.get('language') || 'vi').toLowerCase()
    const languageMap: Record<string, string> = {
      vi: 'tiếng Việt',
      en: 'English',
      ja: 'tiếng Nhật',
      ko: 'tiếng Hàn',
      zh: 'tiếng Trung',
    }
    const outputLanguage = languageMap[requestedLanguage] || 'tiếng Việt'
    if (!image || image.size === 0) {
      return NextResponse.json({ error: 'Thiếu ảnh đầu vào.' }, { status: 400 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Bạn là chuyên gia chuyển cảm xúc thị giác thành prompt nhạc cho Lyria RealTime.
Hãy phân tích ảnh và trả về DUY NHẤT JSON với format:
{"prompt":"<một prompt ngắn, giàu mood, dùng được ngay cho nhạc nền instrumental>"}
Yêu cầu bắt buộc: trường "prompt" phải viết bằng ${outputLanguage}.
Không giải thích thêm, không markdown.`

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: image.type || 'image/png',
          data: buffer.toString('base64'),
        },
      },
    ])

    const text = result.response.text()?.trim() || ''
    const clean = text.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim()
    let parsed: { prompt?: string } = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      parsed = {}
    }

    const resolvedPrompt = parsed.prompt?.trim()
    if (!resolvedPrompt) {
      return NextResponse.json({
        prompt: 'Ambient điện ảnh, piano cảm xúc, dây nhẹ, chuyển động êm, phù hợp nhạc nền không lời',
      })
    }

    return NextResponse.json({ prompt: resolvedPrompt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

