import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchTransliterationCachePg,
  touchTransliterationCachePg,
  upsertTransliterationCachePg,
} from '@/lib/db/language-coach-transliteration-tokenize-pg'

type Payload = {
  text?: string
  languageCode?: string
  coachUsageContext?: 'live' | 'preset'
}

function toCacheKey(text: string, languageCode: string): string {
  const normalized = String(text || '').trim()
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `${languageCode}:${hash}`
}

function normalizeCode(input: string): 'zh' | 'ja' | 'ko' | 'th' | 'hi' | '' {
  const code = String(input || '').trim().toLowerCase()
  if (code === 'zh') return 'zh'
  if (code === 'ja') return 'ja'
  if (code === 'ko') return 'ko'
  if (code === 'th') return 'th'
  if (code === 'hi') return 'hi'
  return ''
}

function buildPrompt(text: string, languageCode: 'zh' | 'ja' | 'ko' | 'th' | 'hi'): string {
  if (languageCode === 'zh') {
    return `Chuyển câu sau sang phiên âm Latin pinyin có dấu thanh.
Yêu cầu:
- Chỉ trả về đúng 1 dòng pinyin.
- Không thêm giải thích, không markdown.

Văn bản gốc:
${text}`
  }
  if (languageCode === 'ja') {
    return `Convert the following Japanese text to Latin romaji (Hepburn style).
Requirements:
- Return exactly one line of romaji.
- No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'ko') {
    return `Convert the following Korean text to Latin romanization (Revised Romanization).
Requirements:
- Return exactly one line of romanization.
- No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'th') {
    return `Convert the following Thai text to Latin romanization (RTGS or similar).
Requirements:
- Return exactly one line of romanization.
- No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'hi') {
    return `Convert the following Hindi (Devanagari) text to Latin romanization (IAST or similar).
Requirements:
- Return exactly one line of romanization.
- No explanation, no markdown.

Original text:
${text}`
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as Payload
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const text = String(payload.text || '').trim()
    const languageCode = normalizeCode(payload.languageCode || '')

    if (!text) return NextResponse.json({ error: 'Thiếu văn bản.' }, { status: 400 })
    if (!languageCode) return NextResponse.json({ transliteration: '' })

    const cacheKey = toCacheKey(text, languageCode)
    if (isPgConfigured()) {
      const cached = await fetchTransliterationCachePg(cacheKey)
      if (cached) {
        void touchTransliterationCachePg(cached.id, new Date().toISOString())
        return NextResponse.json({
          transliteration: String(cached.transliteration || '').trim(),
          cached: true,
        })
      }
    }

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(buildPrompt(text, languageCode))
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.transliterate,
      null,
      coachCtx
    )
    const raw = String(result.response.text?.() || '')
      .replace(/^```/g, '')
      .replace(/```$/g, '')
      .trim()

    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    const skipPattern = /^(THOUGHTS|Reasoning|Thinking|思考|推理)[:\s]/i
    const latinLinePattern = /[A-Za-z\u00C0-\u024F]/
    const candidateLines = lines.filter((line) => !skipPattern.test(line))
    const lastLatinLine = [...candidateLines].reverse().find((line) => latinLinePattern.test(line))
    const transliteration = (lastLatinLine ?? raw)
      .replace(/\s+/g, ' ')
      .trim()

    if (isPgConfigured()) {
      const up = await upsertTransliterationCachePg({
        cacheKey,
        languageCode,
        transliteration,
        nowIso: new Date().toISOString(),
      })
      if (!up.ok) {
        return NextResponse.json(
          { error: up.message || 'Không lưu được cache phiên âm.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ transliteration, cached: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
