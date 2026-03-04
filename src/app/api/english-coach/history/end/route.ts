import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function isPresetCopiedSession(pinnedFactsRaw: string): boolean {
  try {
    const parsed = JSON.parse(String(pinnedFactsRaw || '{}')) as Record<string, unknown>
    const preset = parsed?.preset_replay
    if (!preset || typeof preset !== 'object') return false
    const sourceLessonId = String((preset as { source_lesson_id?: unknown; sourceLessonId?: unknown }).source_lesson_id
      ?? (preset as { sourceLessonId?: unknown }).sourceLessonId
      ?? '').trim()
    return Boolean(sourceLessonId)
  } catch {
    return false
  }
}

function parseReviewDrillStatsFromPinnedFacts(raw: string): {
  speakingPass: number
  speakingFail: number
  listeningPass: number
  listeningFail: number
  hintServed: number
} | null {
  try {
    const parsed = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const stats = parsed?.review_drill_stats
    if (!stats || typeof stats !== 'object') return null
    const row = stats as Record<string, unknown>
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
    }
  } catch {
    return null
  }
}

const MIN_STUDENT_MESSAGES_FOR_COMPLETED_SAVE = 10
const MIN_TOTAL_MESSAGES_FOR_COMPLETED_SAVE = 11

function isTimelineCompletedReason(reason: string): boolean {
  const r = String(reason || '').trim().toLowerCase()
  return r === 'timeline_completed' || r === 'timeline_completed_auto'
}

function hasPersonalizationSignals(text: string): boolean {
  const s = String(text || '').trim()
  if (!s) return false
  const patterns: RegExp[] = [
    /\bmy\s+name\b/i,
    /\bmy\s+name(?:\s+is|\s*'s)?\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /\bmy\s+name\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /(?:tên\s+(?:tôi|em|mình|anh|chị)\s+là)\s+[^\n,.!?;:]{1,80}/iu,
    /我叫[^\n。！？!?，,]{1,40}/u,
    /(?:私の名前は|僕の名前は|俺の名前は)[^\n。！？!?，,]{1,40}(?:です|だ)?/u,
    /(?:제\s*이름은|내\s*이름은)\s*[^\n.!?]{1,40}/u,
    /मेरा\s+नाम\s+[^\n।.!?]{1,40}/u,
    /\bhttps?:\/\//i,
    /\bwww\./i,
    /\b[a-z0-9-]+\s*(?:\.|\s+dot\s+|\s+chấm\s+)\s*(?:com|vn|net|org|io)\b/i,
    /\b\d{2,}\s*com\s*vn\b/i,
  ]
  return patterns.some((re) => re.test(s))
}

function transcriptHasPersonalizationSignals(rows: Array<{
  text?: string | null
  main_sentence?: string | null
  correction_note?: string | null
  intent_answer?: string | null
}>): boolean {
  return rows.some((row) => {
    const fields = [
      String(row.text || '').trim(),
      String(row.main_sentence || '').trim(),
      String(row.correction_note || '').trim(),
      String(row.intent_answer || '').trim(),
    ]
    return fields.some((field) => hasPersonalizationSignals(field))
  })
}

function rowHasPersonalizationSignals(row: {
  text?: string | null
  main_sentence?: string | null
  correction_note?: string | null
  intent_answer?: string | null
}): boolean {
  return transcriptHasPersonalizationSignals([row])
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      sessionId?: string
      markEnded?: boolean
      completionReason?: string
      qualityPassed?: boolean
    }
    const sessionId = String(payload.sessionId || '').trim()
    const markEnded = payload.markEnded !== false
    const qualityPassed = payload.qualityPassed === true
    const completionReasonRaw = String(payload.completionReason || '').trim()
    const completionReason = completionReasonRaw || (markEnded ? 'user_ended' : 'timeline_completed_auto')
    if (!sessionId) {
      return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })
    }
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để kết thúc buổi học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const [messagesResult, memoryResult] = await Promise.all([
      adminSupabase
        .from('language_coach_messages')
        .select(
          'id, role, text, audio_url, translation, language_code, target_language, teacher_label, teacher_locale, mode, main_sentence, correction_note, intent_answer, tokens_json, writing_task_json, ai_payload_json, created_at'
        )
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(1200),
      adminSupabase
        .from('language_coach_session_memories')
        .select('target_language, native_language, learner_level, topic_id, topic_label, learning_mode, running_summary, pinned_facts_json')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .limit(1)
        .maybeSingle(),
    ])

    if (messagesResult.error) {
      return NextResponse.json(
        { error: messagesResult.error.message || 'Không tải được dữ liệu buổi học để kết thúc.' },
        { status: 500 }
      )
    }
    if (memoryResult.error) {
      return NextResponse.json(
        { error: memoryResult.error.message || 'Không tải được memory buổi học để kết thúc.' },
        { status: 500 }
      )
    }

    const rows = Array.isArray(messagesResult.data) ? messagesResult.data : []
    const first = rows[0]
    const last = rows.length > 0 ? rows[rows.length - 1] : null
    const studentMessages = rows.filter((r) => r.role === 'student').length
    const startedAt = String(first?.created_at || '').trim() || null
    const endedAt = String(last?.created_at || '').trim() || new Date().toISOString()
    const durationSeconds =
      startedAt && endedAt
        ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
        : 0
    const memory = memoryResult.data as {
      target_language?: string
      native_language?: string
      learner_level?: number
      topic_id?: string
      topic_label?: string
      learning_mode?: string
      running_summary?: string
      pinned_facts_json?: string
    } | null
    const isPresetSession = isPresetCopiedSession(String(memory?.pinned_facts_json || '{}'))
    const reviewDrillStats = parseReviewDrillStatsFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))
    const rowsWithoutPersonalization = rows.filter((r) => !rowHasPersonalizationSignals({
      text: String((r as { text?: string }).text || ''),
      main_sentence: String((r as { main_sentence?: string }).main_sentence || ''),
      correction_note: String((r as { correction_note?: string }).correction_note || ''),
      intent_answer: String((r as { intent_answer?: string }).intent_answer || ''),
    }))
    // Do not save opening line in completed lesson snapshots.
    const firstTeacherId = String((rowsWithoutPersonalization.find((r) => r.role === 'teacher')?.id || '')).trim()
    const replayRows = rowsWithoutPersonalization.filter((r) => String(r.id || '').trim() !== firstTeacherId)
    const summary = {
      runningSummary: String(memory?.running_summary || '').trim(),
      pinnedFactsJson: String(memory?.pinned_facts_json || '{}').trim(),
      reviewDrillStats: reviewDrillStats || undefined,
      latestStudentText: String([...replayRows].reverse().find((r) => r.role === 'student')?.text || '').trim(),
      latestTeacherText: String([...replayRows].reverse().find((r) => r.role === 'teacher')?.text || '').trim(),
    }
    const transcript = replayRows.map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      audioUrl: r.audio_url,
      translation: (r as { translation?: string }).translation || null,
      languageCode: r.language_code,
      targetLanguage: r.target_language,
      teacherLabel: r.teacher_label,
      teacherLocale: r.teacher_locale,
      mode: r.mode,
      mainSentence: (r as { main_sentence?: string }).main_sentence || null,
      correctionNote: (r as { correction_note?: string }).correction_note || null,
      intentAnswer: (r as { intent_answer?: string }).intent_answer || null,
      tokensJson: (r as { tokens_json?: string }).tokens_json || null,
      writingTaskJson: (r as { writing_task_json?: string }).writing_task_json || null,
      aiPayloadJson: (r as { ai_payload_json?: string }).ai_payload_json || null,
      createdAt: r.created_at,
    }))

    const meetsDepthGate =
      studentMessages >= MIN_STUDENT_MESSAGES_FOR_COMPLETED_SAVE
      && rows.length >= MIN_TOTAL_MESSAGES_FOR_COMPLETED_SAVE
    const timelineCompleted = isTimelineCompletedReason(completionReason)
    const allowCompletedSave =
      qualityPassed && timelineCompleted && meetsDepthGate && !isPresetSession && transcript.length > 0

    if (allowCompletedSave) {
      const { error: completedError } = await adminSupabase.from('language_coach_completed_lessons').upsert(
        {
          user_id: user.id,
          session_id: sessionId,
          target_language: String(memory?.target_language || first?.target_language || '').trim() || null,
          native_language: String(memory?.native_language || '').trim() || null,
          learner_level: Number.isFinite(Number(memory?.learner_level)) ? Math.max(0, Math.round(Number(memory?.learner_level))) : 0,
          language_code: String(first?.language_code || '').trim() || null,
          mode: String(first?.mode || '').trim() || null,
          learning_mode: String(memory?.learning_mode || 'review').trim() || 'review',
          topic_id: String(memory?.topic_id || '').trim() || null,
          topic_label: String(memory?.topic_label || '').trim() || null,
          teacher_label: String(first?.teacher_label || '').trim() || null,
          teacher_locale: String(first?.teacher_locale || '').trim() || null,
          total_messages: replayRows.length,
          student_messages: replayRows.filter((r) => r.role === 'student').length,
          teacher_messages: replayRows.filter((r) => r.role === 'teacher').length,
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          completion_reason: completionReason,
          summary_json: JSON.stringify(summary),
          transcript_json: JSON.stringify(transcript),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' }
      )
      if (completedError) {
        return NextResponse.json(
          { error: completedError.message || 'Không lưu được dữ liệu buổi học hoàn thành.' },
          { status: 500 }
        )
      }
    } else {
      await adminSupabase
        .from('language_coach_completed_lessons')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
    }

    if (markEnded) {
      const { error } = await adminSupabase.from('language_coach_ended_sessions').upsert(
        { user_id: user.id, session_id: sessionId },
        { onConflict: 'user_id,session_id' }
      )

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Không đánh dấu kết thúc được.' },
          { status: 500 }
        )
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
