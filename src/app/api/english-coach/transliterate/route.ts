import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Payload = {
  text?: string
  languageCode?: string
}

function normalizeCode(input: string): 'zh' | 'ja' | 'ko' | '' {
  const code = String(input || '').trim().toLowerCase()
  if (code === 'zh') return 'zh'
  if (code === 'ja') return 'ja'
  if (code === 'ko') return 'ko'
  return ''
}

function buildPrompt(text: string, languageCode: 'zh' | 'ja' | 'ko'): string {
  if (languageCode === 'zh') {
    return `Chuyển câu sau sang phiên âm Latin pinyin có dấu thanh.
Yêu cầu:
- Chỉ trả về 1 dòng pinyin.
- Không thêm giải thích, không markdown.
- Giữ dấu câu tự nhiên.

Văn bản gốc:
${text}`
  }
  if (languageCode === 'ja') {
    return `Convert the following Japanese text to Latin romaji (Hepburn style).
Requirements:
- Return exactly one line of romaji.
- No explanation, no markdown.
- Keep punctuation naturally.

Original text:
${text}`
  }
  return `Convert the following Korean text to Latin romanization (Revised Romanization).
Requirements:
- Return exactly one line of romanization.
- No explanation, no markdown.
- Keep punctuation naturally.

Original text:
${text}`
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as Payload
    const text = String(payload.text || '').trim()
    const languageCode = normalizeCode(payload.languageCode || '')

    if (!text) return NextResponse.json({ error: 'Thiếu văn bản.' }, { status: 400 })
    if (!languageCode) return NextResponse.json({ transliteration: '' })

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = buildPrompt(text, languageCode)
    const result = await model.generateContent(prompt)
    const transliteration = String(result.response.text?.() || '')
      .replace(/^```/g, '')
      .replace(/```$/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return NextResponse.json({ transliteration })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

