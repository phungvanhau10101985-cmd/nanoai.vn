import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { isPgConfigured } from '@/lib/db/pool'
import { getOpeningTranslationCachePg, upsertOpeningTranslationCachePg } from '@/lib/db/language-coach-misc-pg'

async function buildCacheKey(text: string, targetLanguageCode: string, nativeLanguage: string, explainType?: string): Promise<string> {
  const normalized = `${String(explainType || '')}::${String(text || '').trim()}::${String(targetLanguageCode || '').trim()}::${String(nativeLanguage || '').trim()}`
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const h = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `direct-v2:${hex}`
}

type Payload = {
  studentText?: string
  intentAnswer?: string
  correctedSentence?: string
  correctionNote?: string
  targetLanguage?: string
  targetLanguageCode?: string
  nativeLanguage?: string
  topicLabel?: string
  explainType?: 'idea2' | 'idea3'
  coachUsageContext?: 'live' | 'preset'
}

function normalizeShortMeaning(text: string): string {
  const compact = String(text || '').replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  if (compact.length <= 360) return compact
  return `${compact.slice(0, 357).trim()}...`
}

function normalizeVietnameseLearnerAddressing(text: string): string {
  const input = String(text || '')
  if (!input) return ''
  return input
    .replace(/\bCon\b/g, 'Em')
    .replace(/\bcon\b/g, 'em')
}

function pickDirectTranslation(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  for (const key of ['explanation', 'translation', 'meaning', 'text']) {
    const line = String(row[key] || '').trim()
    if (line) return line
  }
  const only = Object.values(row).filter((item) => typeof item === 'string' && String(item).trim())
  return only.length === 1 ? String(only[0]).trim() : ''
}

function safeParse(text: string): { explanation: string } | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  const tryParse = (candidate: string): { explanation: string } | null => {
    const explanation = pickDirectTranslation(JSON.parse(candidate))
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
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const studentText = String(payload.studentText || '').trim()
    const intentAnswer = String(payload.intentAnswer || '').trim()
    const correctedSentence = String(payload.correctedSentence || '').trim()
    const correctionNote = String(payload.correctionNote || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const topicLabel = String(payload.topicLabel || '').trim()
    const explainType = payload.explainType === 'idea2' ? 'idea2' : 'idea3'

    const textToExplain = explainType === 'idea2' ? correctedSentence : intentAnswer
    if (!textToExplain) {
      return NextResponse.json({ error: 'Thiếu câu cần giải thích.' }, { status: 400 })
    }

    const targetLanguageCode = String(payload.targetLanguageCode || 'en').trim()
    const isOpeningStyle = !studentText && !correctionNote && (explainType === 'idea3' ? !correctedSentence : !intentAnswer)

    if (isOpeningStyle && isPgConfigured()) {
      const cacheKey = await buildCacheKey(textToExplain, targetLanguageCode, nativeLanguage, explainType)
      const cached = await getOpeningTranslationCachePg(cacheKey)
      if (cached) {
        const cachedNormalized = normalizeVietnameseLearnerAddressing(String(cached || '').trim())
        return NextResponse.json({ explanation: cachedNormalized })
      }
    }

    const prompt = `Dịch thẳng sang ${nativeLanguage}. Không giải thích.

Câu cần dịch:
${textToExplain}

Chỉ dùng ngữ cảnh để chọn đúng nghĩa. Không viết ngữ cảnh vào bản dịch.
- Học sinh vừa nói: ${studentText || '(không có)'}
- Câu sửa: ${correctedSentence || '(không có)'}
- Chủ đề: ${topicLabel || '(không có)'}
- Ngôn ngữ đang học: ${targetLanguage}

Quy tắc:
- Mỗi câu gốc thành đúng một câu dịch, giữ thứ tự và dấu câu.
- Nhãn vai trong ngoặc vuông là chức danh. Dịch từ trong nhãn. Ví dụ tiếng Việt: [司書] thành [Thủ thư].
- いらっしゃいませ là lời chào khách khi khách bước vào cửa hàng, quán hoặc nơi phục vụ. Nếu ${nativeLanguage} là tiếng Việt, dịch là "Chào mừng quý khách" hoặc "Kính chào quý khách", không dịch "xin chào". Ngôn ngữ mẹ đẻ khác thì dùng lời chào khách lịch sự tương đương.
- Bỏ chú giải tiếng mẹ đẻ đã có sẵn trong ngoặc đơn. Chỉ dịch phần ngôn ngữ đang học.
- Cấm giảng nghĩa, cấm "đây là lời chào", cấm phiên âm, cấm chú thích.
- Nếu ${nativeLanguage} là tiếng Việt và câu xưng hô với người học, gọi là "em". Không dùng "con".

Ví dụ khi ${nativeLanguage} là tiếng Việt:
[司書] いらっしゃいませ。図書館へようこそ。本、好きですか。
→ [Thủ thư] Chào mừng quý khách. Chào mừng quý khách đến thư viện. Bạn có thích sách không?

Chỉ JSON, không markdown:
{"explanation":"..."}`

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(prompt)
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.intentExplain,
      null,
      coachCtx
    )
    const text = result.response.text()?.trim() || ''
    const parsed = safeParse(text)

    if (!parsed) {
      console.error('[intent-explain] unparsed model text', text.slice(0, 240))
      return NextResponse.json({ error: 'Không dịch được câu này.' }, { status: 502 })
    }

    const explanation = normalizeVietnameseLearnerAddressing(normalizeShortMeaning(parsed.explanation))

    if (isOpeningStyle && isPgConfigured()) {
      const cacheKey = await buildCacheKey(textToExplain, targetLanguageCode, nativeLanguage, explainType)
      await upsertOpeningTranslationCachePg(cacheKey, explanation)
    }

    return NextResponse.json({ explanation })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
