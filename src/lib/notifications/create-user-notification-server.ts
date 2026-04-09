import { insertNotificationPg } from '@/lib/db/notifications-repo'
import { isPgConfigured } from '@/lib/db/pool'
import { sendAccountNotificationEmailByUserIdPg } from '@/lib/email/account-notification-email'
import { sendPushNotificationsToUser } from '@/lib/push/send-to-user'

export type UserNotificationPayload = {
  user_id: string
  type: string
  title: string
  body: string
  meta?: Record<string, unknown>
}

/**
 * Ghi thông báo trong app (chuông), gửi email (nếu có SMTP) và Web Push (nếu có VAPID + subscription).
 * Chỉ Postgres — cần `DATABASE_URL`.
 */
export async function createUserNotificationWithEmail(payload: UserNotificationPayload): Promise<void> {
  const pushUrl =
    typeof payload.meta?.push_url === 'string' && payload.meta.push_url.startsWith('/')
      ? payload.meta.push_url
      : '/'

  if (!isPgConfigured()) {
    console.warn('[createUserNotificationWithEmail] skipped: DATABASE_URL not configured')
    return
  }

  const ins = await insertNotificationPg({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    meta: payload.meta,
  })
  if (!ins.ok) {
    console.error('[createUserNotificationWithEmail] insert:', ins.error)
    return
  }
  await sendAccountNotificationEmailByUserIdPg(payload.user_id, {
    title: payload.title,
    body: payload.body,
  })
  await sendPushNotificationsToUser(payload.user_id, {
    title: payload.title,
    body: payload.body,
    url: pushUrl,
  })
}
