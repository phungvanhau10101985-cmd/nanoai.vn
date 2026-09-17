import { insertNotificationPg } from '@/lib/db/notifications-repo'
import type { UserNotificationPayload } from '@/lib/notifications/create-user-notification-server'
import {
  accountNotificationFromNameFromMeta,
  sendAccountNotificationEmailByUserIdPg,
} from '@/lib/email/account-notification-email'
import { sendPushNotificationsToUser } from '@/lib/push/send-to-user'

/** Thông báo + email SMTP + Web Push — chỉ Postgres (insert notifications, đọc email từ auth.users). */
export async function deliverUserNotificationPg(payload: UserNotificationPayload): Promise<void> {
  const ins = await insertNotificationPg({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    meta: payload.meta,
  })
  if (!ins.ok) {
    console.error('[deliverUserNotificationPg] insert:', ins.error)
    return
  }

  const pushUrl =
    typeof payload.meta?.push_url === 'string' && payload.meta.push_url.startsWith('/')
      ? payload.meta.push_url
      : '/'

  void sendAccountNotificationEmailByUserIdPg(payload.user_id, {
    title: payload.title,
    body: payload.body,
    fromName: accountNotificationFromNameFromMeta(payload.meta),
  }).catch((e) => console.warn('[deliverUserNotificationPg] email', e))

  void sendPushNotificationsToUser(payload.user_id, {
    title: payload.title,
    body: payload.body,
    url: pushUrl,
  }).catch((e) => console.warn('[deliverUserNotificationPg] push', e))
}
