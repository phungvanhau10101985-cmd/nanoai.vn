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

    const newSessionId = randomUUID()
    const nowIso = new Date().toISOString()
    const records = transcript.map((item) => {
      const role = String(item.role || '').trim() === 'teacher' ? 'teacher' : 'student'
      return {
        user_id: user.id,
        session_id: newSessionId,
        role,
        text: String(item.text || '').trim().slice(0, 4000),
        audio_url: String(item.audioUrl || '').trim() || null,
        translation: String(item.translation || '').trim() || null,
        language_code: String(item.languageCode || '').trim() || null,
        target_language: String(item.targetLanguage || '').trim() || null,
        teacher_label: String(item.teacherLabel || '').trim() || null,
        teacher_locale: String(item.teacherLocale || '').trim() || null,
        mode: String(item.mode || 'chat').trim() || 'chat',
        main_sentence: String(item.mainSentence || '').trim() || null,
        correction_note: String(item.correctionNote || '').trim() || null,
        intent_answer: String(item.intentAnswer || '').trim() || null,
        tokens_json: String(item.tokensJson || '').trim() || null,
        writing_task_json: String(item.writingTaskJson || '').trim() || null,
      }
    }).filter((x) => x.text)

    if (records.length === 0) {
      return NextResponse.json({ found: false })
    }

    const { error: insertError } = await adminSupabase
      .from('language_coach_messages')
      .insert(records)
    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Không copy được transcript bài có sẵn.' }, { status: 500 })
    }

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
          pinned_facts_json: pinnedFactsJson,
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
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

