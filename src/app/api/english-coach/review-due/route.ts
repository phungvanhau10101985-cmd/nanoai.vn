import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type ReviewPayload = {
  id?: string
  score?: number
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function computeNextIntervalDays(score: number, previous: number): number {
  if (score < 3) return 1
  if (previous <= 1) return 3
  if (previous <= 3) return 7
  return Math.min(30, Math.round(previous * 1.6))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem từ cần ôn.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 10

    const adminSupabase = adminClient()
    const { data, error } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, word, target_language, native_language, meaning, pronunciation, due_at, repetitions, interval_days')
      .eq('user_id', user.id)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit)
    if (error) return NextResponse.json({ error: error.message || 'Không tải được danh sách ôn tập.' }, { status: 500 })
    return NextResponse.json({ items: data || [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ReviewPayload
    const id = String(payload.id || '').trim()
    const score = Math.min(5, Math.max(0, Math.floor(Number(payload.score || 3))))
    if (!id) return NextResponse.json({ error: 'Thiếu id bản ghi ôn tập.' }, { status: 400 })

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để cập nhật ôn tập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { data: rows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, interval_days, repetitions')
      .eq('id', id)
      .eq('user_id', user.id)
      .limit(1)
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    if (!row) return NextResponse.json({ error: 'Không tìm thấy mục ôn tập.' }, { status: 404 })

    const prevInterval = Number(row.interval_days || 1)
    const prevRepetitions = Number(row.repetitions || 0)
    const nextInterval = computeNextIntervalDays(score, prevInterval)
    const repetitions = score < 3 ? 1 : prevRepetitions + 1
    const due = new Date()
    due.setDate(due.getDate() + nextInterval)

    const { error } = await adminSupabase
      .from('language_coach_review_queue')
      .update({
        repetitions,
        interval_days: nextInterval,
        due_at: due.toISOString(),
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message || 'Không cập nhật được lịch ôn tập.' }, { status: 500 })

    return NextResponse.json({ ok: true, nextDueAt: due.toISOString(), nextIntervalDays: nextInterval })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
