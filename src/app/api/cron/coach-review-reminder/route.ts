import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchReviewQueueDueCountsByUserPg } from '@/lib/db/language-coach-cron-pg'
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

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const nowIso = new Date().toISOString()
  const grouped = await fetchReviewQueueDueCountsByUserPg(nowIso)
  if (grouped === null) {
    return NextResponse.json({ error: 'Failed to load review queue.' }, { status: 500 })
  }

  let notified = 0
  for (const { user_id: userId, cnt: dueWordCount } of grouped) {
    const sent = await notifyCoachReviewDueIfAllowed({
      userId,
      dueWordCount,
      minHoursSinceLast: 20,
    })
    if (sent) notified += 1
  }

  return NextResponse.json({
    ok: true,
    usersWithDueWords: grouped.length,
    notificationsSent: notified,
  })
}
