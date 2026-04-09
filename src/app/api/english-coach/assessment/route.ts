import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isPgConfigured } from '@/lib/db/pool'
import { insertLanguageCoachAssessmentPg } from '@/lib/db/language-coach-assessment-pg'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { getUserForAction } from '@/lib/auth'
type Payload = {
  assessmentType?: 'baseline' | 'checkpoint'
  targetLanguage?: string
  nativeLanguage?: string
  samples?: string[]
  coachUsageContext?: 'live' | 'preset'
}

type AssessmentResult = {
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  recommendedLevel: 0 | 1 | 2 | 3 | 4
  confidence: number
  overallScore: number
  speakingScore: number
  listeningScore: number
  readingScore: number
  writingScore: number
  summary: string
}

function clampScore(value: unknown, fallback = 60): number {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return fallback
  return Math.min(100, Math.max(0, Math.round(raw)))
}

function mapLevelToCefr(level: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' {
  if (level >= 4) return 'C1'
  if (level === 3) return 'B2'
  if (level === 2) return 'B1'
  if (level === 1) return 'A2'
  return 'A1'
}

function safeParseAssessment(text: string): AssessmentResult | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const levelRaw = Number(parsed.recommendedLevel)
    const recommendedLevel: 0 | 1 | 2 | 3 | 4 =
      levelRaw === 4 ? 4 : levelRaw === 3 ? 3 : levelRaw === 2 ? 2 : levelRaw === 1 ? 1 : 0
    const cefrMaybe = String(parsed.cefrLevel || '').trim().toUpperCase()
    const cefrLevel = (['A1', 'A2', 'B1', 'B2', 'C1'].includes(cefrMaybe) ? cefrMaybe : mapLevelToCefr(recommendedLevel)) as
      | 'A1'
      | 'A2'
      | 'B1'
      | 'B2'
      | 'C1'
    const summary = String(parsed.summary || '').trim()
    if (!summary) return null
    return {
      cefrLevel,
      recommendedLevel,
      confidence: clampScore(parsed.confidence, 60),
      overallScore: clampScore(parsed.overallScore, 55),
      speakingScore: clampScore(parsed.speakingScore, 55),
      listeningScore: clampScore(parsed.listeningScore, 55),
      readingScore: clampScore(parsed.readingScore, 55),
      writingScore: clampScore(parsed.writingScore, 55),
      summary,
    }
  } catch {
    return null
  }
}

function buildFallbackFromSamples(samples: string[]): AssessmentResult {
  const tokenCount = samples.join(' ').split(/\s+/).filter(Boolean).length
  const avgTokens = tokenCount / Math.max(1, samples.length)
  const roughLevel = avgTokens >= 16 ? 3 : avgTokens >= 11 ? 2 : avgTokens >= 7 ? 1 : 0
  const recommendedLevel: 0 | 1 | 2 | 3 | 4 = roughLevel >= 4 ? 4 : roughLevel >= 3 ? 3 : roughLevel >= 2 ? 2 : roughLevel >= 1 ? 1 : 0
  const overall = Math.min(85, 42 + roughLevel * 12 + Math.round(avgTokens))
  return {
    cefrLevel: mapLevelToCefr(recommendedLevel),
    recommendedLevel,
    confidence: 45,
    overallScore: overall,
    speakingScore: Math.max(0, overall - 3),
    listeningScore: Math.max(0, overall - 1),
    readingScore: Math.max(0, overall),
    writingScore: Math.max(0, overall - 2),
    summary:
      'Hệ thống dùng fallback heuristic vì chưa parse được kết quả AI. Hãy làm thêm 1 checkpoint sau vài buổi để tăng độ chính xác.',
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const assessmentType = payload.assessmentType === 'checkpoint' ? 'checkpoint' : 'baseline'
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const samples = Array.isArray(payload.samples)
      ? payload.samples.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : []

    if (samples.length < 2) {
      return NextResponse.json({ error: 'Cần ít nhất 2 câu mẫu để chấm CEFR.' }, { status: 400 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    let assessed: AssessmentResult | null = null

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
      const prompt = `Bạn là khảo thí viên CEFR.
Loại bài test: ${assessmentType}
Ngôn ngữ đang học: ${targetLanguage}
Ngôn ngữ mẹ đẻ: ${nativeLanguage}
Mẫu câu người học:
${samples.map((s, i) => `${i + 1}) ${s}`).join('\n')}

Quy tắc:
- learner level: 0-4 (0=A1, 1=A2, 2=B1, 3=B2, 4=C1)
- Trả về JSON hợp lệ, không markdown:
{
  "cefrLevel": "A1",
  "recommendedLevel": 0,
  "confidence": 0,
  "overallScore": 0,
  "speakingScore": 0,
  "listeningScore": 0,
  "readingScore": 0,
  "writingScore": 0,
  "summary": "2 câu ngắn: điểm mạnh + điểm cần cải thiện"
}`
      const result = await model.generateContent(prompt)
      trackEnglishCoachGeminiResult(
        result,
        GEMINI_25_FLASH_NO_THINKING.model,
        EnglishCoachApiFeature.assessment,
        user.id,
        coachCtx
      )
      assessed = safeParseAssessment(result.response.text?.() || '')
    }

    if (!assessed) assessed = buildFallbackFromSamples(samples)

    const takenAt = new Date().toISOString()
    const inserted = await insertLanguageCoachAssessmentPg({
      userId: user.id,
      assessmentType,
      targetLanguage,
      nativeLanguage,
      cefrLevel: assessed.cefrLevel,
      learnerLevel: assessed.recommendedLevel,
      confidence: assessed.confidence,
      overallScore: assessed.overallScore,
      speakingScore: assessed.speakingScore,
      listeningScore: assessed.listeningScore,
      readingScore: assessed.readingScore,
      writingScore: assessed.writingScore,
      samplesJson: JSON.stringify(samples),
      summary: assessed.summary,
      takenAtIso: takenAt,
    })

    if (!inserted.ok) {
      return NextResponse.json({ error: inserted.message || 'Không lưu được kết quả test.' }, { status: 500 })
    }
    return NextResponse.json({ assessment: inserted.row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
