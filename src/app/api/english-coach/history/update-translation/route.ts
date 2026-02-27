import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Payload = {
  messageId: string
  sessionId?: string
  clientMessageId?: string
  translation?: string
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
  tokensJson?: string
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const messageId = String(payload.messageId || '').trim()
    const sessionId = String(payload.sessionId || '').trim()
    const clientMessageId = String(payload.clientMessageId || '').trim()
    const translation = String(payload.translation || '').trim()
    const mainSentence = String(payload.mainSentence || '').trim().slice(0, 2000) || null
    const correctionNote = String(payload.correctionNote || '').trim().slice(0, 2000) || null
    const intentAnswer = String(payload.intentAnswer || '').trim().slice(0, 2000) || null
    const tokensJson = String(payload.tokensJson || '').trim().slice(0, 4000) || null

    const updates: Record<string, string | null> = {}
    if (payload.translation !== undefined) updates.translation = translation ? translation.slice(0, 4000) : null
    if (payload.mainSentence !== undefined) updates.main_sentence = mainSentence
    if (payload.correctionNote !== undefined) updates.correction_note = correctionNote
    if (payload.intentAnswer !== undefined) updates.intent_answer = intentAnswer
    if (payload.tokensJson !== undefined) updates.tokens_json = tokensJson

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Thiếu dữ liệu cập nhật.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu dịch.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)

    if (isUuid) {
      const { data, error } = await adminSupabase
        .from('language_coach_messages')
        .update(updates)
        .eq('id', messageId)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message || 'Không cập nhật được.' }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Không tìm thấy tin nhắn.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true })
    }

    if (sessionId && clientMessageId) {
      const { data, error } = await adminSupabase
        .from('language_coach_messages')
        .update(updates)
        .eq('session_id', sessionId)
        .eq('client_message_id', clientMessageId)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message || 'Không cập nhật được.' }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Không tìm thấy tin nhắn.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Cần messageId (uuid) hoặc sessionId + clientMessageId.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
