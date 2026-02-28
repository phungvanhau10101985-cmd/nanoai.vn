import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { sessionId?: string }
    const sessionId = String(payload.sessionId || '').trim()
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
          'id, role, text, audio_url, translation, language_code, target_language, teacher_label, teacher_locale, mode, main_sentence, correction_note, intent_answer, tokens_json, writing_task_json, created_at'
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
    const teacherMessages = rows.filter((r) => r.role === 'teacher').length
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
    const summary = {
      runningSummary: String(memory?.running_summary || '').trim(),
      pinnedFactsJson: String(memory?.pinned_facts_json || '{}').trim(),
      latestStudentText: String([...rows].reverse().find((r) => r.role === 'student')?.text || '').trim(),
      latestTeacherText: String([...rows].reverse().find((r) => r.role === 'teacher')?.text || '').trim(),
    }
    const transcript = rows.map((r) => ({
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
      createdAt: r.created_at,
    }))

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
        total_messages: rows.length,
        student_messages: studentMessages,
        teacher_messages: teacherMessages,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        completion_reason: 'user_ended',
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
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
