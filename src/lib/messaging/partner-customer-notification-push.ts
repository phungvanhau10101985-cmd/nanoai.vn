import webpush from 'web-push'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import {
  deletePartnerGuestPushSubscriptionByIdFromPg,
  listPartnerGuestPushSubscriptionsFromPg,
} from '@/lib/db/messaging-partner-guest-push-subscriptions-pg'
import {
  markPartnerCustomerNotificationPushStatusFromPg,
  type PartnerCustomerNotificationRow,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { partnerShopPushClickPath } from '@/lib/messaging/partner-shop-push-click-path'
import { isWebPushConfigured } from '@/lib/push/send-to-user'

const IMMEDIATE_PUSH_CAP = 40

export function partnerShopImmediatePushCap(): number {
  return IMMEDIATE_PUSH_CAP
}

function configureVapid(): boolean {
  if (!isWebPushConfigured()) return false
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:thongbao@nanoai.vn'
  webpush.setVapidDetails(
    subject,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  )
  return true
}

export async function sendPartnerCustomerWebPush(input: {
  partnerId: string
  guestAccountId: string
  title: string
  body: string
  href?: string
  tag?: string
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string; delivered: number }> {
  if (!configureVapid()) return { status: 'skipped', reason: 'vapid_off', delivered: 0 }

  const subs = await listPartnerGuestPushSubscriptionsFromPg({
    partnerId: input.partnerId,
    guestAccountId: input.guestAccountId,
  })
  if (!subs.length) return { status: 'skipped', reason: 'no_subscription', delivered: 0 }

  const website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  const siteSlug = website?.siteSlug?.trim() ?? ''
  const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const shopName = partners?.[0]?.display_name?.trim() || website?.title?.trim() || 'Shop'
  const shortBody = input.body.length > 220 ? `${input.body.slice(0, 217)}...` : input.body

  let delivered = 0
  let lastError = ''

  for (const sub of subs) {
    const url = partnerShopPushClickPath({
      href: input.href ?? '',
      siteSlug,
      customDomain: sub.customDomain,
    })
    const payload = JSON.stringify({
      title: input.title.trim() || shopName,
      body: shortBody,
      url,
      tag: input.tag || `pw-shop-${input.guestAccountId.slice(0, 8)}`,
    })
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400 }
      )
      delivered += 1
    } catch (e: unknown) {
      const err = e as { statusCode?: number; status?: number }
      const status = err.statusCode ?? err.status
      if (status === 410 || status === 404) {
        await deletePartnerGuestPushSubscriptionByIdFromPg(sub.id)
      } else {
        lastError = status ? `http_${status}` : 'send_failed'
        console.error('[partner-web-push]', status, e)
      }
    }
  }

  if (delivered > 0) return { status: 'sent', delivered }
  if (lastError) return { status: 'failed', reason: lastError, delivered: 0 }
  return { status: 'skipped', reason: 'stale_subscription', delivered: 0 }
}

export async function deliverPendingPartnerNotificationPush(
  row: PartnerCustomerNotificationRow
): Promise<'sent' | 'skipped' | 'failed'> {
  if (row.pushStatus === 'sent' || row.pushStatus === 'skipped' || row.pushStatus === 'failed') {
    return row.pushStatus
  }
  const scheduledMs = Date.parse(row.scheduledAt)
  if (Number.isFinite(scheduledMs) && scheduledMs > Date.now() + 15_000) {
    return 'skipped'
  }
  const result = await sendPartnerCustomerWebPush({
    partnerId: row.partnerId,
    guestAccountId: row.guestAccountId,
    title: row.title,
    body: row.body,
    href: row.href,
    tag: `pw-shop-n-${row.id}`,
  })
  await markPartnerCustomerNotificationPushStatusFromPg({
    notificationId: row.id,
    status: result.status,
    error: result.reason,
  })
  return result.status
}
