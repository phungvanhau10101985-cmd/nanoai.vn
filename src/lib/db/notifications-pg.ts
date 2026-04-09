import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/** Đếm thông báo theo user + type từ mốc thời gian — chống spam cron coach. */
export async function countNotificationsByUserTypeSincePg(
  userId: string,
  notificationType: string,
  sinceIso: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c from public.notifications
       where user_id = $1::uuid and type = $2 and created_at >= $3::timestamptz`,
      [userId, notificationType, sinceIso]
    )
    return row ? Number(row.c) : 0
  } catch (e) {
    console.error('[notifications-pg] countNotificationsByUserTypeSincePg', e)
    return null
  }
}
