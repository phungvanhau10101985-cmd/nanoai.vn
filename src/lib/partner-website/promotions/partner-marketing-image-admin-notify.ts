import { pgQuery } from '@/lib/db/pg-query'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { partnerShopEmailBrandName } from '@/lib/messaging/partner-shop-email-brand'
import { partnerMarketingImageKindLabel } from '@/lib/partner-website/promotions/partner-marketing-image-guard'

const TYPE = 'partner_marketing_image_blocked'

export async function notifyNanoAiAdminsMarketingImageBlocked(input: {
  partnerId: string
  kind: string
  campaignKey: string
  lastError?: string | null
}): Promise<void> {
  try {
    const admins = await pgQuery<{ id: string }>(
      `select id::text as id from public.profiles where role = 'admin'`
    )
    if (!admins.length) return
    const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
    const partner = partners?.[0]
    const shop = partnerShopEmailBrandName(partner)
    const slug = partner?.slug?.trim() || input.partnerId
    const kindLabel = partnerMarketingImageKindLabel(input.kind)
    const last = String(input.lastError || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    const body = last
      ? `${shop} (${slug}): ${kindLabel} đã thử 3 lần nhưng không lưu được ảnh. Lần cuối: ${last}. Cron đã dừng, không gọi model ảnh nữa.`
      : `${shop} (${slug}): ${kindLabel} đã thử 3 lần nhưng không lưu được ảnh. Cron đã dừng, không gọi model ảnh nữa.`
    const idempotencyKey = `mkt-img-cap:${input.partnerId}:${input.kind}:${input.campaignKey}`.slice(0, 240)
    const pushUrl = `/dashboard/messaging/settings?section=partner-website-promotions&partner=${encodeURIComponent(input.partnerId)}`
    await Promise.all(
      admins.map((admin) =>
        deliverUserNotificationPg({
          user_id: admin.id,
          type: TYPE,
          title: 'Dừng tạo ảnh khuyến mãi',
          body,
          meta: {
            push_url: pushUrl,
            partner_id: input.partnerId,
            idempotency_key: idempotencyKey,
          },
        })
      )
    )
  } catch (error) {
    console.warn('[notifyNanoAiAdminsMarketingImageBlocked]', error)
  }
}
