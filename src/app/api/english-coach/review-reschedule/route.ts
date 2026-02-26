import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type ReschedulePayload = {
  words: Array<{ word: string; targetLanguage?: string }>
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Đặt due_at = now cho các từ cần ôn lại (từ gợi ý mới gõ được) */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const payload = (await request.json().catch(() => ({}))) as ReschedulePayload
    const words = Array.isArray(payload.words) ? payload.words : []
    if (words.length === 0) return NextResponse.json({ ok: true, updated: 0 })

    const adminSupabase = adminClient()
    const now = new Date().toISOString()
    let updated = 0

    for (const { word, targetLanguage } of words) {
      const w = String(word || '').trim()
      if (!w) continue
      const target = String(targetLanguage || '').trim()

      const baseQuery = adminSupabase
        .from('language_coach_review_queue')
        .update({ due_at: now, updated_at: now })
        .eq('user_id', user.id)
        .eq('word', w)

      const { error } = target
        ? await baseQuery.eq('target_language', target)
        : await baseQuery.is('target_language', null)

      if (!error) updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
