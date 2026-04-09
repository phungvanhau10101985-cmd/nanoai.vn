import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchTopicCurriculumCachePg,
  touchTopicCurriculumLastUsedPg,
  upsertTopicCurriculumPg,
} from '@/lib/db/language-coach-topics-pg'

type Payload = {
  topicId?: string
  topicLabel?: string
  topicDifficulty?: 'basic' | 'intermediate' | 'advanced'
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: 0 | 1 | 2 | 3 | 4
  coachUsageContext?: 'live' | 'preset'
}

type Curriculum = {
  roleplayRole: string
  dailyQuest: string
  objective: string
  keywords: string[]
  starterSentences: string[]
  lessonSteps: string[]
  openingLine: string
  openingQuestion: string
}

function tr(input: string): 'vi' | 'en' {
  const value = String(input || '').toLowerCase()
  return value.includes('vietnamese') ? 'vi' : 'en'
}

function msg(locale: 'vi' | 'en', vi: string, en: string): string {
  return locale === 'vi' ? vi : en
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function safeParse(text: string): Curriculum | null {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<Curriculum>
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8) : []
    const starterSentences = Array.isArray(parsed.starterSentences) ? parsed.starterSentences.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4) : []
    const lessonSteps = Array.isArray(parsed.lessonSteps) ? parsed.lessonSteps.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6) : []
    const openingLine = String(parsed.openingLine || '').trim()
    const openingQuestion = String(parsed.openingQuestion || '').trim()
    if (keywords.length === 0 || starterSentences.length === 0) return null
    return {
      roleplayRole: String(parsed.roleplayRole || '').trim() || 'Facilitator',
      dailyQuest: String(parsed.dailyQuest || '').trim() || 'Daily quest',
      objective: String(parsed.objective || '').trim() || 'Practice communication',
      keywords,
      starterSentences,
      lessonSteps,
      openingLine,
      openingQuestion,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const locale = tr(payload.nativeLanguage || '')
    const topicId = String(payload.topicId || 'solo-teacher').trim()
    const topicLabel = String(payload.topicLabel || 'Solo hội thoại với thầy/cô').trim()
    const topicDifficulty =
      payload.topicDifficulty === 'advanced'
        ? 'advanced'
        : payload.topicDifficulty === 'intermediate'
          ? 'intermediate'
          : 'basic'
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const learnerLevelRaw = Number(payload.learnerLevel)
    const learnerLevel: 0 | 1 | 2 | 3 | 4 =
      learnerLevelRaw === 4 ? 4 : learnerLevelRaw === 3 ? 3 : learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0

    if (!isPgConfigured()) {
      return NextResponse.json({ error: msg(locale, 'Cơ sở dữ liệu chưa cấu hình.', 'Database not configured.') }, { status: 503 })
    }

    const normalizedTopicId = normalizeLookup(topicId)
    const normalizedTarget = normalizeLookup(targetLanguage)
    const normalizedNative = normalizeLookup(nativeLanguage)
    const cached = await fetchTopicCurriculumCachePg({
      normalizedTopicId,
      normalizedTargetLanguage: normalizedTarget,
      normalizedNativeLanguage: normalizedNative,
      learnerLevel,
    })
    if (cached) {
      const nowIso = new Date().toISOString()
      void touchTopicCurriculumLastUsedPg(cached.id, nowIso)
      return NextResponse.json({
        roleplayRole: String(cached.roleplay_role || '').trim(),
        dailyQuest: String(cached.daily_quest || '').trim(),
        objective: String(cached.objective || '').trim(),
        keywords: JSON.parse(String(cached.keywords_json || '[]')) as string[],
        starterSentences: JSON.parse(String(cached.starter_sentences_json || '[]')) as string[],
        lessonSteps: JSON.parse(String(cached.lesson_steps_json || '[]')) as string[],
        openingLine: String(cached.opening_line || '').trim(),
        openingQuestion: String(cached.opening_question || '').trim(),
        cached: true,
      })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: msg(locale, 'Thiếu GOOGLE_API_KEY.', 'Missing GOOGLE_API_KEY.') }, { status: 500 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const difficultyGuide =
      topicDifficulty === 'advanced'
        ? 'Độ khó: Nâng cao. Tạo tình huống thực tế nhiều biến thể, từ vựng và phản xạ cao hơn.'
        : topicDifficulty === 'intermediate'
          ? 'Độ khó: Trung cấp. Cân bằng giữa tự tin giao tiếp và mở rộng cụm từ ứng dụng.'
          : 'Độ khó: Cơ bản. Ưu tiên câu ngắn, rõ nghĩa, dễ bắt chước.'
    const levelGuide =
      learnerLevel === 0
        ? `Learner level 0: tuyệt đối người mới bắt đầu. Bài học phải rất chậm, câu 3-6 từ, ưu tiên bắt chước.`
        : learnerLevel === 1
          ? `Learner level 1: cơ bản. Câu ngắn, mẫu lặp rõ ràng, từ vựng nền tảng.`
          : learnerLevel === 2
            ? `Learner level 2: sơ trung cấp. Cân bằng giữa hiểu nghĩa và phản xạ nói.`
            : learnerLevel === 3
              ? `Learner level 3: trung cấp. Tăng câu hỏi mở và phản xạ hội thoại tự nhiên.`
              : `Learner level 4: nâng cao. Ưu tiên hội thoại thực chiến, ít scaffold hơn.`

    const prompt = `Bạn là chuyên gia thiết kế giáo trình hội thoại ngoại ngữ theo chủ đề.
Tạo giáo trình ngắn gọn, không nhàm chán cho:
- Chủ đề: ${topicLabel} (${topicId})
- Độ khó chủ đề: ${topicDifficulty}
- Ngôn ngữ học: ${targetLanguage}
- Ngôn ngữ mẹ đẻ: ${nativeLanguage}
- Level: ${learnerLevel}

Yêu cầu:
1) roleplayRole: vai trò AI trong tình huống (ví dụ: nhân viên cửa hàng, phỏng vấn viên, bạn đồng hành...).
2) dailyQuest: 1 nhiệm vụ ngắn hấp dẫn.
3) objective: mục tiêu rõ ràng của buổi học.
4) keywords: 3-5 từ/cụm then chốt bằng ${targetLanguage}.
5) starterSentences: 2-3 mẫu câu mở đầu bằng ${targetLanguage}.
6) lessonSteps: 4-6 bước dẫn dắt buổi học theo kiểu facilitator.
7) openingLine: 1 câu mở đầu bài học bằng ${targetLanguage}, đúng vai roleplayRole, tự nhiên, không lan man.
8) openingQuestion: 1 câu hỏi mở đầu bám sát topicLabel để học sinh trả lời ngay (KHÔNG dùng câu chung chung như hobby nếu topic khác).
9) Chỉ dùng đúng cặp ngôn ngữ ${targetLanguage} + ${nativeLanguage}, không chèn ngôn ngữ thứ ba.
10) ${difficultyGuide}
11) ${levelGuide}

Trả về JSON:
{
  "roleplayRole":"...",
  "dailyQuest":"...",
  "objective":"...",
  "keywords":["..."],
  "starterSentences":["..."],
  "lessonSteps":["..."],
  "openingLine":"...",
  "openingQuestion":"..."
}`
    const result = await model.generateContent(prompt)
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.topicCurriculum,
      null,
      coachCtx
    )
    const parsed = safeParse(result.response.text()?.trim() || '')
    if (!parsed) {
      return NextResponse.json({ error: msg(locale, 'Không tạo được giáo trình chủ đề.', 'Failed to generate topic curriculum.') }, { status: 502 })
    }

    const nowIso = new Date().toISOString()
    const saved = await upsertTopicCurriculumPg({
      topicId,
      topicLabel,
      normalizedTopicId,
      targetLanguage,
      normalizedTargetLanguage: normalizedTarget,
      nativeLanguage,
      normalizedNativeLanguage: normalizedNative,
      learnerLevel,
      roleplayRole: parsed.roleplayRole,
      dailyQuest: parsed.dailyQuest,
      objective: parsed.objective,
      keywordsJson: JSON.stringify(parsed.keywords),
      starterSentencesJson: JSON.stringify(parsed.starterSentences),
      lessonStepsJson: JSON.stringify(parsed.lessonSteps),
      openingLine: parsed.openingLine || null,
      openingQuestion: parsed.openingQuestion || null,
      sourceModel: 'gemini-2.5-flash',
      nowIso,
    })
    if (!saved.ok) {
      return NextResponse.json(
        { error: saved.message || msg(locale, 'Không lưu được giáo trình chủ đề.', 'Failed to save topic curriculum.') },
        { status: 500 }
      )
    }

    return NextResponse.json({ ...parsed, cached: false })
  } catch (e) {
    const msgErr = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msgErr }, { status: 500 })
  }
}
