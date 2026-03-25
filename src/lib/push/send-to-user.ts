import webpush from 'web-push'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PRIVATE_KEY?.trim() && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  )
}

/**
 * Gửi Web Push tới mọi thiết bị đã đăng ký của user (Android PWA, Chrome…).
 * Bỏ qua nếu chưa cấu VAPID. Xóa subscription hết hạn (410/404).
 */
export async function sendPushNotificationsToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    if (!isWebPushConfigured()) return

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:thongbao@nanoai.vn'
    webpush.setVapidDetails(
      subject,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim()
    )

    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error || !subs?.length) return

    const shortBody =
      payload.body.length > 220 ? `${payload.body.slice(0, 217)}...` : payload.body
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: shortBody,
      url: payload.url && payload.url.startsWith('/') ? payload.url : '/',
    })

    for (const row of subs) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }
      try {
        await webpush.sendNotification(subscription, pushPayload, { TTL: 86400 })
      } catch (e: unknown) {
        const err = e as { statusCode?: number; status?: number }
        const status = err.statusCode ?? err.status
        if (status === 410 || status === 404) {
          await admin.from('push_subscriptions').delete().eq('id', row.id)
        } else {
          console.error('[web-push]', status, e)
        }
      }
    }
  } catch (e) {
    console.error('[web-push] sendPushNotificationsToUser', e)
  }
}
