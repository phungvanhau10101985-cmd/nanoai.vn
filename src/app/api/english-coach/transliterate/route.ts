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
import { stripReadingCommentary } from '@/lib/coach-reading'
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

function normalizeCode(input: string): 'zh' | 'ja' | 'ko' | 'th' | 'hi' | 'en' | '' {
  const code = String(input || '').trim().toLowerCase()
  if (code === 'zh') return 'zh'
  if (code === 'ja') return 'ja'
  if (code === 'ko') return 'ko'
  if (code === 'th') return 'th'
  if (code === 'hi') return 'hi'
  if (code === 'en') return 'en'
  return ''
}

function buildPrompt(text: string, languageCode: 'zh' | 'ja' | 'ko' | 'th' | 'hi' | 'en'): string {
  if (languageCode === 'zh') {
    return `Chuyển câu sau sang Hán ngữ pinyin có dấu thanh. Mỗi tiếng một âm, cách nhau bằng dấu cách.
Ví dụ: 登机口 → dēng jī kǒu
Yêu cầu:
- Chỉ trả về đúng 1 dòng chữ Latin.
- Có dấu thanh (ā á ǎ à), không dùng số 1-4.
- Cấm chữ Hán. Cấm viết theo chính tả tiếng Việt (cấm dạng chỉnh-tào, chi-khẩu).
- Không dịch nghĩa, không markdown, không câu tiếng Anh. Cấm viết "Looks correct".

Văn bản gốc:
${text}`
  }
  if (languageCode === 'ja') {
    return `Convert the following Japanese text to Hepburn romaji.
Requirements:
- One romaji token per character (each kanji or kana), separated by spaces.
- Example: 私は → watashi wa
- Return exactly one line. No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'ko') {
    return `Convert the following Korean text to Revised Romanization.
Requirements:
- One token per hangul syllable block, separated by spaces.
- Example: 안녕 → an nyeong
- Return exactly one line. No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'th') {
    return `Convert the following Thai text to Latin romanization (RTGS).
Requirements:
- If the text has spaces, one token per spaced word.
- If it has no spaces, one token per character.
- Separate tokens with spaces. Return exactly one line. No explanation, no markdown.

Original text:
${text}`
  }
  if (languageCode === 'hi') {
    return `Convert the following Hindi text to Latin romanization (IAST).
Requirements:
- One token per word, separated by spaces. The number of tokens must match the number of words.
- Example: मैं जाता → maĩ jātā
- Return exactly one line. No explanation, no markdown.

Original text:
${text}`
  }
  return `Write the IPA of this English text, without slash marks.
Requirements:
- One IPA token per word, separated by spaces. Do not put spaces inside a word.
- Example: I go to the stadium → aɪ ɡoʊ tə ðə ˈsteɪdiəm
- Keep the stress mark. Weak forms are allowed.
- One line only. Do not translate. No explanation, no markdown.

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
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const text = String(payload.text || '').trim()
    const languageCode = normalizeCode(payload.languageCode || '')

    if (!text) return NextResponse.json({ error: 'Thiếu văn bản.' }, { status: 400 })
    if (!languageCode) return NextResponse.json({ transliteration: '' })

    const cacheKey = toCacheKey(text, languageCode)
    if (isPgConfigured()) {
      const cached = await fetchTransliterationCachePg(cacheKey)
      if (cached) {
        const rawCached = String(cached.transliteration || '')
        const cleaned = stripReadingCommentary(rawCached)
        void touchTransliterationCachePg(cached.id, new Date().toISOString())
        if (cleaned && cleaned !== rawCached.replace(/\s+/g, ' ').trim()) {
          void upsertTransliterationCachePg({
            cacheKey,
            languageCode,
            transliteration: cleaned,
            nowIso: new Date().toISOString(),
          })
        }
        return NextResponse.json({
          transliteration: cleaned,
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
    const transliteration = stripReadingCommentary((lastLatinLine ?? raw)
      .replace(/[\u4E00-\u9FFF]/g, '')
      .replace(/^(?:pinyin|phiên âm|phát âm)\s*[:：]\s*/i, '')
      .replace(/^[→>:：\s]+/, '')
      .replace(/\s+/g, ' '))
    if (languageCode === 'zh' && (/[ăơưđĂƠƯĐ]/.test(transliteration) || transliteration.includes('-'))) {
      return NextResponse.json({ transliteration: '' })
    }
    if (!transliteration) return NextResponse.json({ transliteration: '' })

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
