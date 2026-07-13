import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { listWeddingRemindersDueToday, markWeddingReminderSent } from '@/lib/db/wedding-cards-pg'
import { isSmtpConfigured } from '@/lib/email/smtp'
import { sendWeddingReminderEmail } from '@/lib/wedding/wedding-reminder-email'

/**
 * Cron (1 lần/ngày): gửi email nhắc lịch đám cưới theo số ngày khách đăng ký.
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
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: 'SMTP not configured.' }, { status: 503 })
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

  return NextResponse.json({
    ok: true,
    dueCount: due.length,
    sent,
    failed,
  })
}
