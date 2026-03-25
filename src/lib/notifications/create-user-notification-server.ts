import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAccountNotificationEmail } from '@/lib/email/account-notification-email'
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
 * Chỉ dùng với Supabase service role (RLS không cho user tự insert notifications).
 */
export async function createUserNotificationWithEmail(
  adminSupabase: SupabaseClient,
  payload: UserNotificationPayload
): Promise<void> {
  const { error } = await adminSupabase.from('notifications').insert({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    meta: payload.meta ?? {},
  })
  if (error) {
    console.error('[createUserNotificationWithEmail] insert:', error.message)
    return
  }

  const pushUrl =
    typeof payload.meta?.push_url === 'string' && payload.meta.push_url.startsWith('/')
      ? payload.meta.push_url
      : '/'

  await sendAccountNotificationEmail(adminSupabase, payload.user_id, {
    title: payload.title,
    body: payload.body,
  })
  await sendPushNotificationsToUser(payload.user_id, {
    title: payload.title,
    body: payload.body,
    url: pushUrl,
  })
}
