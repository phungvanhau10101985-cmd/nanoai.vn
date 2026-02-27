import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Payload = {
  messageId: string
  sessionId?: string
  clientMessageId?: string
  translation: string
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

    if (!translation) {
      return NextResponse.json({ error: 'Thiếu nội dung dịch.' }, { status: 400 })
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
        .update({ translation: translation.slice(0, 4000) })
        .eq('id', messageId)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message || 'Không cập nhật được dịch.' }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Không tìm thấy tin nhắn.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true })
    }

    if (sessionId && clientMessageId) {
      const { data, error } = await adminSupabase
        .from('language_coach_messages')
        .update({ translation: translation.slice(0, 4000) })
        .eq('session_id', sessionId)
        .eq('client_message_id', clientMessageId)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message || 'Không cập nhật được dịch.' }, { status: 500 })
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
