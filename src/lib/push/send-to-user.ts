import webpush from 'web-push'
import { isPgConfigured } from '@/lib/db/pool'
import { getPgPool } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PRIVATE_KEY?.trim() && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  )
}

/**
 * Gửi Web Push tới mọi thiết bị đã đăng ký của user (Android PWA, Chrome…).
 * Bỏ qua nếu chưa cấu VAPID. Xóa subscription hết hạn (410/404).
 */
type PushSubRow = { id: string; endpoint: string; p256dh: string; auth: string }

async function deletePushSubscriptionById(subId: string): Promise<void> {
  if (!isPgConfigured()) return
  await getPgPool().query('delete from public.push_subscriptions where id = $1::uuid', [subId])
}

export async function sendPushNotificationsToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    if (!isWebPushConfigured()) return

    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:thongbao@nanoai.vn'
    webpush.setVapidDetails(
      subject,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim()
    )

    if (!isPgConfigured()) return
    const subs: PushSubRow[] = await pgQuery<PushSubRow>(
      `select id::text, endpoint, p256dh, auth
       from public.push_subscriptions
       where user_id = $1::uuid`,
      [userId]
    )

    if (!subs.length) return

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
          await deletePushSubscriptionById(row.id)
        } else {
          console.error('[web-push]', status, e)
        }
      }
    }
  } catch (e) {
    console.error('[web-push] sendPushNotificationsToUser', e)
  }
}
