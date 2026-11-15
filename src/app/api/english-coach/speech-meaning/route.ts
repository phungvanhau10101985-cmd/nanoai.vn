import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { buildSpeechMeaningPrompt, parseCanonicalMeaning } from '@/lib/english-coach/native-meaning-canonical'
import { toSimplifiedChinese, usesSimplifiedChinese } from '@/lib/chinese-script'

type Payload = {
  text?: string
  targetLanguage?: string
  targetLanguageCode?: string
  nativeLanguage?: string
  nativeLanguageCode?: string
  coachUsageContext?: 'live' | 'preset'
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
    const nativeLanguageCode = String(payload.nativeLanguageCode || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const prompt = buildSpeechMeaningPrompt({
      text,
      nativeLanguage,
      nativeLanguageCode,
      targetLanguage,
    })
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
    const parsedMeaning = parseCanonicalMeaning(result.response.text() || '')
    const meaning = usesSimplifiedChinese(nativeLanguageCode)
      ? toSimplifiedChinese(parsedMeaning)
      : parsedMeaning
    if (!meaning) {
      return NextResponse.json({ error: 'Không dịch được câu nói.' }, { status: 502 })
    }
    return NextResponse.json({ meaning })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
