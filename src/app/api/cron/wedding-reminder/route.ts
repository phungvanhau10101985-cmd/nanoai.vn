import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { listWeddingRemindersDueToday, markWeddingReminderSent, purgeExpiredWeddingCardsFromPg } from '@/lib/db/wedding-cards-pg'
import { isSmtpConfigured } from '@/lib/email/smtp'
import { notifyWeddingCardExpired } from '@/lib/wedding/wedding-card-retention-notify'
import { sendWeddingReminderEmail } from '@/lib/wedding/wedding-reminder-email'
import { sendDueWeddingAttendanceDailyDigests } from '@/lib/wedding/wedding-rsvp-notify'

/**
 * Cron (1 lần/ngày): gỡ thiệp đã qua 18 ngày sau ngày lễ, rồi gửi email nhắc lịch đám cưới.
 * Bảo vệ: Authorization: Bearer <WEDDING_REMINDER_CRON_SECRET>
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.WEDDING_REMINDER_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'WEDDING_REMINDER_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const purged = await purgeExpiredWeddingCardsFromPg()
  let purgeNotified = 0
  for (const card of purged) {
    const sent = await notifyWeddingCardExpired({
      userId: card.userId,
      cardId: card.id,
      groomName: card.groomName,
      brideName: card.brideName,
      ceremonyIso: card.ceremonyIso,
    }).then(
      () => true,
      (error) => {
        console.error('[wedding-reminder-cron] purge notify', card.id, error)
        return false
      },
    )
    if (sent) purgeNotified += 1
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({
      ok: true,
      purgedCards: purged.length,
      purgeNotified,
      reminder: 'skipped_smtp',
    })
  }

  const due = await listWeddingRemindersDueToday()
  let sent = 0
  let failed = 0

  for (const row of due) {
    const result = await sendWeddingReminderEmail(row)
    if (result.ok) {
      await markWeddingReminderSent(row.id)
      sent += 1
    } else {
      failed += 1
      console.error('[wedding-reminder-cron]', row.id, result.error)
    }
  }

  const attendance = await sendDueWeddingAttendanceDailyDigests()

  return NextResponse.json({
    ok: true,
    purgedCards: purged.length,
    purgeNotified,
    dueCount: due.length,
    sent,
    failed,
    attendanceDailyDue: attendance.due,
    attendanceDailySent: attendance.sent,
    attendanceDailyFailed: attendance.failed,
    attendanceDailySkipped: attendance.skipped,
  })
}
