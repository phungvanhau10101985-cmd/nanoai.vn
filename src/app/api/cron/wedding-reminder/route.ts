import { NextRequest, NextResponse } from 'next/server'
import { runWeddingReminderCron } from '@/lib/cron/wedding-reminder-cron'
import { isPgConfigured } from '@/lib/db/pool'

/**
 * Cron (1 lần/ngày): gỡ thiệp đã qua 18 ngày sau ngày lễ, gửi email nhắc lịch đám cưới,
 * và nhắc chủ thiệp cưới chưa mua gói khách mời trước 15 ngày ngày cưới.
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

  const result = await runWeddingReminderCron()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 })
  return NextResponse.json(result)
}
