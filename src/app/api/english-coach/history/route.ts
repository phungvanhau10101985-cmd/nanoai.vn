import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type MessageRole = 'teacher' | 'student'
type LearnMode = 'chat' | 'story'
type LanguageCode = 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko' | 'vi'

type HistoryPayload = {
  sessionId?: string
  clientMessageId?: string
  role?: MessageRole
  text?: string
  audioUrl?: string
  languageCode?: LanguageCode
  targetLanguage?: string
  teacherLabel?: string
  teacherLocale?: string
  mode?: LearnMode
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
  tokensJson?: string
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem lịch sử học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const sessionId = String(request.nextUrl.searchParams.get('sessionId') || '').trim()
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20
    const adminSupabase = adminClient()

    if (sessionId) {
      const { data, error } = await adminSupabase
        .from('language_coach_messages')
        .select('id, session_id, role, text, audio_url, translation, language_code, target_language, teacher_label, teacher_locale, mode, main_sentence, correction_note, intent_answer, tokens_json, writing_task_json, created_at')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(500)

      if (error) {
        return NextResponse.json({ error: error.message || 'Không tải được buổi học.' }, { status: 500 })
      }

      return NextResponse.json({
        items: (data ?? []).map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          role: row.role,
          text: row.text,
          audioUrl: row.audio_url,
          translation: (row as { translation?: string }).translation ?? null,
          languageCode: row.language_code,
          targetLanguage: row.target_language,
          teacherLabel: row.teacher_label,
          teacherLocale: row.teacher_locale,
          mode: row.mode,
          mainSentence: (row as { main_sentence?: string }).main_sentence ?? null,
          correctionNote: (row as { correction_note?: string }).correction_note ?? null,
          intentAnswer: (row as { intent_answer?: string }).intent_answer ?? null,
          tokensJson: (row as { tokens_json?: string }).tokens_json ?? null,
          writingTaskJson: (row as { writing_task_json?: string }).writing_task_json ?? null,
          createdAt: row.created_at,
        })),
      })
    }

    const { data, error } = await adminSupabase
      .from('language_coach_messages')
      .select('session_id, role, text, language_code, target_language, teacher_label, teacher_locale, mode, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      return NextResponse.json({ error: error.message || 'Không tải được danh sách buổi học.' }, { status: 500 })
    }

    const bySession = new Map<
      string,
      {
        sessionId: string
        languageCode: string
        targetLanguage: string
        teacherLabel: string
        teacherLocale: string
        mode: string
        lastMessageAt: string
        lastTeacherText: string
        messageCount: number
      }
    >()

    for (const row of data ?? []) {
      const sid = String(row.session_id || '')
      if (!sid) continue
      const existing = bySession.get(sid)
      if (!existing) {
        bySession.set(sid, {
          sessionId: sid,
          languageCode: String(row.language_code || ''),
          targetLanguage: String(row.target_language || ''),
          teacherLabel: String(row.teacher_label || ''),
          teacherLocale: String(row.teacher_locale || ''),
          mode: String(row.mode || ''),
          lastMessageAt: String(row.created_at || ''),
          lastTeacherText: row.role === 'teacher' ? String(row.text || '') : '',
          messageCount: 1,
        })
        continue
      }
      existing.messageCount += 1
      if (!existing.lastTeacherText && row.role === 'teacher') {
        existing.lastTeacherText = String(row.text || '')
      }
    }

    const sessions = Array.from(bySession.values())
      .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
      .slice(0, limit)

    return NextResponse.json({ sessions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as HistoryPayload
    const sessionId = String(payload.sessionId || '').trim()
    const clientMessageId = String(payload.clientMessageId || '').trim()
    const role: MessageRole = payload.role === 'teacher' ? 'teacher' : 'student'
    const text = String(payload.text || '').trim()
    const audioUrl = String(payload.audioUrl || '').trim()
    const languageCode = String(payload.languageCode || '').trim()
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const teacherLabel = String(payload.teacherLabel || '').trim()
    const teacherLocale = String(payload.teacherLocale || '').trim()
    const mode: LearnMode = payload.mode === 'story' ? 'story' : 'chat'
    const mainSentence = String(payload.mainSentence || '').trim().slice(0, 2000) || null
    const correctionNote = String(payload.correctionNote || '').trim().slice(0, 2000) || null
    const intentAnswer = String(payload.intentAnswer || '').trim().slice(0, 2000) || null
    const tokensJson = String(payload.tokensJson || '').trim().slice(0, 4000) || null

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu lưu lịch sử.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu lịch sử học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { data, error } = await adminSupabase
      .from('language_coach_messages')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        client_message_id: clientMessageId || null,
        role,
        text: text.slice(0, 4000),
        audio_url: audioUrl || null,
        language_code: languageCode || null,
        target_language: targetLanguage || null,
        teacher_label: teacherLabel || null,
        teacher_locale: teacherLocale || null,
        mode,
        main_sentence: mainSentence,
        correction_note: correctionNote,
        intent_answer: intentAnswer,
        tokens_json: tokensJson,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Không lưu được lịch sử học.' }, { status: 500 })
    }
    return NextResponse.json({ id: data.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

