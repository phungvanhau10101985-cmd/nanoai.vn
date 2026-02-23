import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Payload = {
  topicId?: string
  topicLabel?: string
  topicDifficulty?: 'basic' | 'intermediate' | 'advanced'
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: 0 | 1 | 2
}

type Curriculum = {
  roleplayRole: string
  dailyQuest: string
  objective: string
  keywords: string[]
  starterSentences: string[]
  lessonSteps: string[]
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
    if (keywords.length === 0 || starterSentences.length === 0) return null
    return {
      roleplayRole: String(parsed.roleplayRole || '').trim() || 'Facilitator',
      dailyQuest: String(parsed.dailyQuest || '').trim() || 'Daily quest',
      objective: String(parsed.objective || '').trim() || 'Practice communication',
      keywords,
      starterSentences,
      lessonSteps,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
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
    const learnerLevel: 0 | 1 | 2 = learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0

    const adminSupabase = adminClient()
    const normalizedTopicId = normalizeLookup(topicId)
    const normalizedTarget = normalizeLookup(targetLanguage)
    const normalizedNative = normalizeLookup(nativeLanguage)
    const { data: cachedRows } = await adminSupabase
      .from('language_coach_topic_curricula')
      .select('id, roleplay_role, daily_quest, objective, keywords_json, starter_sentences_json, lesson_steps_json')
      .eq('normalized_topic_id', normalizedTopicId)
      .eq('normalized_target_language', normalizedTarget)
      .eq('normalized_native_language', normalizedNative)
      .eq('learner_level', learnerLevel)
      .limit(1)
    const cached = Array.isArray(cachedRows) && cachedRows.length > 0 ? cachedRows[0] : null
    if (cached) {
      void adminSupabase
        .from('language_coach_topic_curricula')
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', cached.id)
      return NextResponse.json({
        roleplayRole: String(cached.roleplay_role || '').trim(),
        dailyQuest: String(cached.daily_quest || '').trim(),
        objective: String(cached.objective || '').trim(),
        keywords: JSON.parse(String(cached.keywords_json || '[]')) as string[],
        starterSentences: JSON.parse(String(cached.starter_sentences_json || '[]')) as string[],
        lessonSteps: JSON.parse(String(cached.lesson_steps_json || '[]')) as string[],
        cached: true,
      })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const difficultyGuide =
      topicDifficulty === 'advanced'
        ? 'Độ khó: Nâng cao. Tạo tình huống thực tế nhiều biến thể, từ vựng và phản xạ cao hơn.'
        : topicDifficulty === 'intermediate'
          ? 'Độ khó: Trung cấp. Cân bằng giữa tự tin giao tiếp và mở rộng cụm từ ứng dụng.'
          : 'Độ khó: Cơ bản. Ưu tiên câu ngắn, rõ nghĩa, dễ bắt chước.'

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
7) ${difficultyGuide}

Trả về JSON:
{
  "roleplayRole":"...",
  "dailyQuest":"...",
  "objective":"...",
  "keywords":["..."],
  "starterSentences":["..."],
  "lessonSteps":["..."]
}`
    const result = await model.generateContent(prompt)
    const parsed = safeParse(result.response.text()?.trim() || '')
    if (!parsed) {
      return NextResponse.json({ error: 'Không tạo được giáo trình chủ đề.' }, { status: 502 })
    }

    await adminSupabase.from('language_coach_topic_curricula').upsert(
      {
        topic_id: topicId,
        topic_label: topicLabel,
        normalized_topic_id: normalizedTopicId,
        target_language: targetLanguage,
        normalized_target_language: normalizedTarget,
        native_language: nativeLanguage,
        normalized_native_language: normalizedNative,
        learner_level: learnerLevel,
        roleplay_role: parsed.roleplayRole,
        daily_quest: parsed.dailyQuest,
        objective: parsed.objective,
        keywords_json: JSON.stringify(parsed.keywords),
        starter_sentences_json: JSON.stringify(parsed.starterSentences),
        lesson_steps_json: JSON.stringify(parsed.lessonSteps),
        source_model: 'gemini-2.5-flash',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'normalized_topic_id,normalized_target_language,normalized_native_language,learner_level' }
    )

    return NextResponse.json({ ...parsed, cached: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
