import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Payload = {
  action?: 'random_copy'
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: number
  topicId?: string
  topicLabel?: string
  mode?: string
  learningMode?: 'review' | 'reflex'
}

type PresetTurn = {
  reply: string
  correctionNote?: string
  mainSentence?: string
  intentAnswer?: string
  mustKnowText?: string
  teacherLabel?: string
  teacherLocale?: string
  languageCode?: string
  targetLanguage?: string
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const action = payload.action || 'random_copy'
    if (action !== 'random_copy') {
      return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để dùng bài học có sẵn.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const learnerLevel = Number.isFinite(Number(payload.learnerLevel)) ? Math.max(0, Math.min(4, Math.round(Number(payload.learnerLevel)))) : 0
    const topicId = String(payload.topicId || '').trim()
    const topicLabel = String(payload.topicLabel || '').trim()
    const mode = String(payload.mode || 'chat').trim()
    const learningMode = payload.learningMode === 'reflex' ? 'reflex' : 'review'

    const normalizedTarget = normalizeLookup(targetLanguage)
    const normalizedNative = normalizeLookup(nativeLanguage)
    const normalizedTopicId = normalizeLookup(topicId)
    const normalizedTopicLabel = normalizeLookup(topicLabel)

    const { data: candidates, error: candidateError } = await adminSupabase
      .from('language_coach_completed_lessons')
      .select('id, target_language, native_language, learner_level, topic_id, topic_label, mode, learning_mode, transcript_json, summary_json')
      .neq('user_id', user.id)
      .eq('learner_level', learnerLevel)
      .eq('learning_mode', learningMode)
      .eq('mode', mode)
      .order('ended_at', { ascending: false })
      .limit(240)

    if (candidateError) {
      return NextResponse.json({ error: candidateError.message || 'Không đọc được bài học có sẵn.' }, { status: 500 })
    }

    const rows = Array.isArray(candidates) ? candidates : []
    const strict = rows.filter((r) => {
      const sameTarget = normalizeLookup(String(r.target_language || '')) === normalizedTarget
      const sameNative = normalizeLookup(String(r.native_language || '')) === normalizedNative
      const sameTopicId = normalizedTopicId && normalizeLookup(String(r.topic_id || '')) === normalizedTopicId
      const sameTopicLabel = normalizedTopicLabel && normalizeLookup(String(r.topic_label || '')) === normalizedTopicLabel
      return sameTarget && sameNative && (sameTopicId || sameTopicLabel)
    })
    const fallback = rows.filter((r) => {
      const sameTarget = normalizeLookup(String(r.target_language || '')) === normalizedTarget
      const sameNative = normalizeLookup(String(r.native_language || '')) === normalizedNative
      return sameTarget && sameNative
    })
    const pool = strict.length > 0 ? strict : fallback
    if (pool.length === 0) {
      return NextResponse.json({ found: false })
    }
    const picked = pool[Math.floor(Math.random() * pool.length)]
    const transcriptRaw = String((picked as { transcript_json?: string }).transcript_json || '[]').trim()
    const summaryRaw = String((picked as { summary_json?: string }).summary_json || '{}').trim()

    let transcript: Array<Record<string, unknown>> = []
    try {
      const parsed = JSON.parse(transcriptRaw) as unknown
      transcript = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>> : []
    } catch {
      transcript = []
    }
    if (transcript.length === 0) {
      return NextResponse.json({ found: false })
    }

    let runningSummary = ''
    let pinnedFactsJson = '{}'
    try {
      const parsed = JSON.parse(summaryRaw) as { runningSummary?: unknown; pinnedFactsJson?: unknown }
      runningSummary = String(parsed.runningSummary || '').trim()
      pinnedFactsJson = String(parsed.pinnedFactsJson || '{}').trim() || '{}'
    } catch {
      // keep defaults
    }

    const teacherRows = transcript
      .filter((item) => String(item.role || '').trim() === 'teacher')
      .map((item) => ({
        text: String(item.text || '').trim().slice(0, 4000),
        audioUrl: String(item.audioUrl || '').trim() || null,
        translation: String(item.translation || '').trim() || null,
        languageCode: String(item.languageCode || '').trim() || null,
        targetLanguage: String(item.targetLanguage || '').trim() || null,
        teacherLabel: String(item.teacherLabel || '').trim() || null,
        teacherLocale: String(item.teacherLocale || '').trim() || null,
        mode: String(item.mode || mode || 'chat').trim() || 'chat',
        mainSentence: String(item.mainSentence || '').trim(),
        correctionNote: String(item.correctionNote || '').trim(),
        intentAnswer: String(item.intentAnswer || '').trim(),
      }))
      .filter((x) => x.text)

    if (teacherRows.length === 0) {
      return NextResponse.json({ found: false })
    }

    const firstTeacher = teacherRows[0]
    const presetTurns: PresetTurn[] = teacherRows.slice(1).map((x) => ({
      reply: x.text,
      correctionNote: x.correctionNote || undefined,
      mainSentence: x.mainSentence || undefined,
      intentAnswer: x.intentAnswer || undefined,
      mustKnowText: x.mainSentence || x.intentAnswer || x.text,
      teacherLabel: x.teacherLabel || undefined,
      teacherLocale: x.teacherLocale || undefined,
      languageCode: x.languageCode || undefined,
      targetLanguage: x.targetLanguage || undefined,
    }))

    const newSessionId = randomUUID()
    const nowIso = new Date().toISOString()
    const openingRecord = {
      user_id: user.id,
      session_id: newSessionId,
      role: 'teacher' as const,
      text: firstTeacher.text,
      audio_url: firstTeacher.audioUrl,
      translation: firstTeacher.translation,
      language_code: firstTeacher.languageCode,
      target_language: firstTeacher.targetLanguage,
      teacher_label: firstTeacher.teacherLabel,
      teacher_locale: firstTeacher.teacherLocale,
      mode: firstTeacher.mode,
      main_sentence: firstTeacher.mainSentence || null,
      correction_note: firstTeacher.correctionNote || null,
      intent_answer: firstTeacher.intentAnswer || null,
      tokens_json: null,
      writing_task_json: null,
    }

    const { error: insertError } = await adminSupabase
      .from('language_coach_messages')
      .insert(openingRecord)
    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Không copy được transcript bài có sẵn.' }, { status: 500 })
    }

    const parsedPinnedFacts = (() => {
      try {
        const obj = JSON.parse(pinnedFactsJson || '{}') as unknown
        return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {}
      } catch {
        return {}
      }
    })()

    const { error: memoryError } = await adminSupabase
      .from('language_coach_session_memories')
      .upsert(
        {
          user_id: user.id,
          session_id: newSessionId,
          target_language: targetLanguage,
          native_language: nativeLanguage,
          learner_level: learnerLevel,
          topic_id: topicId || null,
          topic_label: topicLabel || null,
          learning_mode: learningMode,
          running_summary: runningSummary,
          pinned_facts_json: JSON.stringify({
            ...parsedPinnedFacts,
            preset_replay: {
              source_lesson_id: String(picked.id || ''),
              active: true,
              next_turn_index: 0,
              turns: presetTurns,
            },
          }),
          updated_at: nowIso,
        },
        { onConflict: 'user_id,session_id' }
      )
    if (memoryError) {
      return NextResponse.json({ error: memoryError.message || 'Không tạo được memory cho buổi copy.' }, { status: 500 })
    }

    return NextResponse.json({
      found: true,
      sessionId: newSessionId,
      sourceLessonId: String(picked.id || ''),
      strictMatched: strict.length > 0,
      scriptedTurns: presetTurns.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

