import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type GoalPayload = {
  goalType?: string
  title?: string
  targetLanguage?: string
  nativeLanguage?: string
  targetDays?: number
  targetDailyMinutes?: number
  targetWeeklySessions?: number
  targetPronunciationScore?: number
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem mục tiêu học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = adminClient()
    const { data, error } = await adminSupabase
      .from('language_coach_learning_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message || 'Không tải được mục tiêu học.' }, { status: 500 })
    return NextResponse.json({ goal: data || null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GoalPayload
    const goalType = String(payload.goalType || 'communication').trim()
    const title = String(payload.title || 'Mục tiêu giao tiếp theo chủ đề').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const targetDays = Math.min(180, Math.max(7, Math.floor(Number(payload.targetDays || 30))))
    const targetDailyMinutes = Math.min(180, Math.max(5, Math.floor(Number(payload.targetDailyMinutes || 15))))
    const targetWeeklySessions = Math.min(14, Math.max(1, Math.floor(Number(payload.targetWeeklySessions || 5))))
    const targetPronunciationScore = Math.min(100, Math.max(50, Math.floor(Number(payload.targetPronunciationScore || 80))))

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu mục tiêu học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = adminClient()
    await adminSupabase
      .from('language_coach_learning_goals')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + targetDays)

    const { data, error } = await adminSupabase
      .from('language_coach_learning_goals')
      .insert({
        user_id: user.id,
        goal_type: goalType,
        title,
        target_language: targetLanguage,
        native_language: nativeLanguage,
        target_days: targetDays,
        target_daily_minutes: targetDailyMinutes,
        target_weekly_sessions: targetWeeklySessions,
        target_pronunciation_score: targetPronunciationScore,
        is_active: true,
        started_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message || 'Không lưu được mục tiêu học.' }, { status: 500 })
    return NextResponse.json({ goal: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
