import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Payload = {
  assessmentType?: 'baseline' | 'checkpoint'
  targetLanguage?: string
  nativeLanguage?: string
  samples?: string[]
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

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
    const assessmentType = payload.assessmentType === 'checkpoint' ? 'checkpoint' : 'baseline'
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const samples = Array.isArray(payload.samples)
      ? payload.samples.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : []

    if (samples.length < 2) {
      return NextResponse.json({ error: 'Cần ít nhất 2 câu mẫu để chấm CEFR.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để chạy bài test.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

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
      assessed = safeParseAssessment(result.response.text?.() || '')
    }

    if (!assessed) assessed = buildFallbackFromSamples(samples)

    const adminSupabase = adminClient()
    const insertPayload = {
      user_id: user.id,
      assessment_type: assessmentType,
      target_language: targetLanguage,
      native_language: nativeLanguage,
      cefr_level: assessed.cefrLevel,
      learner_level: assessed.recommendedLevel,
      confidence: assessed.confidence,
      overall_score: assessed.overallScore,
      speaking_score: assessed.speakingScore,
      listening_score: assessed.listeningScore,
      reading_score: assessed.readingScore,
      writing_score: assessed.writingScore,
      samples_json: JSON.stringify(samples),
      summary: assessed.summary,
      taken_at: new Date().toISOString(),
    }

    const { data, error } = await adminSupabase
      .from('language_coach_assessments')
      .insert(insertPayload)
      .select(
        'id, assessment_type, cefr_level, learner_level, confidence, overall_score, speaking_score, listening_score, reading_score, writing_score, summary'
      )
      .single()

    if (error) return NextResponse.json({ error: error.message || 'Không lưu được kết quả test.' }, { status: 500 })
    return NextResponse.json({ assessment: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
