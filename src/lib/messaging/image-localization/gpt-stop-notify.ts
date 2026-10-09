import { pgQuery } from '@/lib/db/pg-query'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { partnerShopEmailBrandName } from '@/lib/messaging/partner-shop-email-brand'

const TYPE = 'image_localization_gpt_stopped'

/** Chuông admin NanoAI khi GPT Image lỗi và job bản địa hóa ảnh phải dừng. */
export async function notifyNanoAiAdminsImageLocGptStopped(input: {
  partnerId: string
  jobId: string
  inventoryId: string
  detail: string
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
    const detail = String(input.detail || '').replace(/\s+/g, ' ').trim().slice(0, 240)
    const body = detail
      ? `${shop} (${slug}): GPT Image lỗi ở sản phẩm ${input.inventoryId}. Job đã dừng, không gọi GPT cho sản phẩm phía sau. ${detail}`
      : `${shop} (${slug}): GPT Image lỗi ở sản phẩm ${input.inventoryId}. Job đã dừng, không gọi GPT cho sản phẩm phía sau.`
    const pushUrl = `/dashboard/messaging/settings?section=inventory-image-loc&partner=${encodeURIComponent(input.partnerId)}`
    await Promise.all(
      admins.map((admin) =>
        deliverUserNotificationPg({
          user_id: admin.id,
          type: TYPE,
          title: 'Dừng bản địa hóa ảnh',
          body,
          meta: {
            push_url: pushUrl,
            partner_id: input.partnerId,
            job_id: input.jobId,
            inventory_id: input.inventoryId,
            idempotency_key: `img-loc-gpt:${input.jobId}`.slice(0, 240),
          },
        })
      )
    )
  } catch (error) {
    console.warn('[notifyNanoAiAdminsImageLocGptStopped]', error)
  }
}
