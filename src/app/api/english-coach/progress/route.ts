import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type ProgressPayload = {
  targetLanguage?: string
  pronunciationScore?: number | null
  hadCorrections?: boolean
  newSession?: boolean
  localDate?: string
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function toSafeDate(input?: string): string {
  const raw = String(input || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 10)
}

function yesterdayOf(dateText: string): string {
  const d = new Date(`${dateText}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem tiến độ học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()
    const today = toSafeDate(request.nextUrl.searchParams.get('date') || '')
    const targetLanguage = String(request.nextUrl.searchParams.get('targetLanguage') || '').trim()

    const todayProgressQuery = adminSupabase
      .from('language_coach_progress_daily')
      .select('*')
      .eq('user_id', user.id)
      .eq('progress_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (targetLanguage) todayProgressQuery.eq('target_language', targetLanguage)

    const [{ data: todayRows }, { data: dueRows }, { data: activeGoal }] = await Promise.all([
      todayProgressQuery,
      adminSupabase
        .from('language_coach_review_queue')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .lte('due_at', new Date().toISOString()),
      adminSupabase
        .from('language_coach_learning_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return NextResponse.json({
      today: Array.isArray(todayRows) && todayRows.length > 0 ? todayRows[0] : null,
      dueReviewCount: dueRows?.length || 0,
      activeGoal: activeGoal || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ProgressPayload
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const pronunciationScore = Number(payload.pronunciationScore)
    const hasPronunciationScore = Number.isFinite(pronunciationScore) && pronunciationScore >= 0
    const hadCorrections = Boolean(payload.hadCorrections)
    const newSession = Boolean(payload.newSession)

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu tiến độ học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const date = toSafeDate(payload.localDate)
    const yesterday = yesterdayOf(date)
    const { data: todayRows } = await adminSupabase
      .from('language_coach_progress_daily')
      .select('*')
      .eq('user_id', user.id)
      .eq('progress_date', date)
      .eq('target_language', targetLanguage || null)
      .limit(1)
    const current = Array.isArray(todayRows) && todayRows.length > 0 ? todayRows[0] : null

    let streakDays = Number(current?.streak_days || 0)
    if (!current) {
      const { data: yRows } = await adminSupabase
        .from('language_coach_progress_daily')
        .select('streak_days, turns_count')
        .eq('user_id', user.id)
        .eq('progress_date', yesterday)
        .eq('target_language', targetLanguage || null)
        .limit(1)
      const y = Array.isArray(yRows) && yRows.length > 0 ? yRows[0] : null
      streakDays = y && Number(y.turns_count || 0) > 0 ? Number(y.streak_days || 0) + 1 : 1
    }

    const prevTurns = Number(current?.turns_count || 0)
    const prevSessions = Number(current?.sessions_count || 0)
    const prevCorrected = Number(current?.corrected_turns || 0)
    const prevSamples = Number(current?.pronunciation_samples || 0)
    const prevAvg = Number(current?.avg_pronunciation_score || 0)

    const nextTurns = prevTurns + 1
    const nextSessions = prevSessions + (newSession ? 1 : 0)
    const nextCorrected = prevCorrected + (hadCorrections ? 1 : 0)
    const nextSamples = prevSamples + (hasPronunciationScore ? 1 : 0)
    const nextAvg = hasPronunciationScore
      ? ((prevAvg * prevSamples) + pronunciationScore) / Math.max(1, nextSamples)
      : prevAvg

    const { error } = await adminSupabase.from('language_coach_progress_daily').upsert(
      {
        user_id: user.id,
        progress_date: date,
        target_language: targetLanguage || null,
        turns_count: nextTurns,
        sessions_count: nextSessions,
        corrected_turns: nextCorrected,
        pronunciation_samples: nextSamples,
        avg_pronunciation_score: Number(nextAvg.toFixed(2)),
        streak_days: streakDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,progress_date,target_language' }
    )
    if (error) return NextResponse.json({ error: error.message || 'Không lưu được tiến độ học.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
