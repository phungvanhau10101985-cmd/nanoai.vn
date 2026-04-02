import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCoachReviewDueIfAllowed } from '@/lib/notifications/notify-job-events'

/**
 * Cron (1–2 lần/ngày): nhắc user có từ SRS đến hạn trong Học ngoại ngữ AI.
 * Bảo vệ: Authorization: Bearer <COACH_REVIEW_REMINDER_CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.COACH_REVIEW_REMINDER_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'COACH_REVIEW_REMINDER_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase service env.' }, { status: 500 })
  }

  const admin = createClient(url, key)
  const nowIso = new Date().toISOString()

  const { data: rows, error } = await admin
    .from('language_coach_review_queue')
    .select('user_id')
    .lte('due_at', nowIso)

  if (error) {
    console.error('[cron/coach-review-reminder]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts = new Map<string, number>()
  for (const r of rows ?? []) {
    const uid = typeof r.user_id === 'string' ? r.user_id : null
    if (!uid) continue
    counts.set(uid, (counts.get(uid) ?? 0) + 1)
  }

  let notified = 0
  for (const [userId, dueWordCount] of counts) {
    const sent = await notifyCoachReviewDueIfAllowed(admin, {
      userId,
      dueWordCount,
      minHoursSinceLast: 20,
    })
    if (sent) notified += 1
  }

  return NextResponse.json({
    ok: true,
    usersWithDueWords: counts.size,
    notificationsSent: notified,
  })
}
