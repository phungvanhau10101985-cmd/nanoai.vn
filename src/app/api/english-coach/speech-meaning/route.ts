import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'

type Payload = {
  text?: string
  targetLanguage?: string
  targetLanguageCode?: string
  nativeLanguage?: string
  nativeLanguageCode?: string
  coachUsageContext?: 'live' | 'preset'
}

function parseMeaning(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as { meaning?: unknown }
    return String(parsed.meaning || '').replace(/\s+/g, ' ').trim()
  } catch {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) {
      try {
        const parsed = JSON.parse(cleaned.slice(first, last + 1)) as { meaning?: unknown }
        return String(parsed.meaning || '').replace(/\s+/g, ' ').trim()
      } catch {
        return ''
      }
    }
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    const payload = (await request.json()) as Payload
    const text = String(payload.text || '').replace(/\s+/g, ' ').trim()
    if (!text) {
      return NextResponse.json({ error: 'Thiếu câu cần dịch.' }, { status: 400 })
    }
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const prompt = `Dịch đúng một cụm lời nói của học viên sang ${nativeLanguage}.
Cụm có thể là ${targetLanguage}, ${nativeLanguage}, hoặc trộn cả hai.
Chỉ trả nghĩa của cả cụm, một câu ngắn, đúng ngôn ngữ ${nativeLanguage}.
Không chú thích, không phiên âm, không câu thứ hai, không ngôn ngữ khác.
Nếu ${nativeLanguage} là tiếng Việt thì xưng "em", không dùng "con".

Cụm: ${text}

JSON, không markdown:
{ "meaning": "..." }`
    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(prompt)
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.speechMeaning,
      null,
      coachCtx
    )
    const meaning = parseMeaning(result.response.text() || '')
    if (!meaning) {
      return NextResponse.json({ error: 'Không dịch được câu nói.' }, { status: 502 })
    }
    return NextResponse.json({ meaning })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
