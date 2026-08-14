import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { fetchMessagingPartnerOwnerUserIdFromPg } from '@/lib/db/messaging-partners-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'

/**
 * M4.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — thông báo cho MERCHANT (chủ shop) khi có
 * đơn mới / khách hỏi / review mới. Khác `W5.2` (đó là thông báo cho khách hàng cuối).
 * Chỉ gửi cho chủ shop (`owner_user_id`) — chưa mở rộng cho nhân viên theo quyền (staff permissions)
 * để giữ phạm vi tối thiểu, an toàn.
 */

function toVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

async function notifyPartnerOwner(input: {
  partnerId: string
  type: string
  title: string
  body: string
  pushUrl: string
}): Promise<void> {
  try {
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(input.partnerId)
    if (!ownerUserId) return
    await deliverUserNotificationPg({
      user_id: ownerUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      meta: { push_url: input.pushUrl, partner_id: input.partnerId },
    })
  } catch (e) {
    console.warn('[notifyPartnerOwner]', input.type, e)
  }
}

export async function notifyPartnerOwnerNewOrder(partnerId: string, order: PartnerOrderRow): Promise<void> {
  const amount = order.amount_after_discount > 0 ? order.amount_after_discount : order.subtotal_amount
  await notifyPartnerOwner({
    partnerId,
    type: 'messaging_partner_new_order',
    title: 'Đơn hàng mới',
    body: `${order.customer_name || 'Khách hàng'} vừa đặt đơn ${toVnd(amount)}${order.product_name ? ` — ${order.product_name}` : ''}.`,
    pushUrl: `/dashboard/messaging/settings?section=hub-orders&partner=${partnerId}`,
  })
}

export async function notifyPartnerOwnerNewQuestion(input: {
  partnerId: string
  askerName: string
  content: string
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_new_question',
    title: 'Khách hỏi sản phẩm mới',
    body: `${input.askerName || 'Khách hàng'}: "${input.content.slice(0, 140)}"`,
    pushUrl: `/dashboard/messaging/website?partner=${input.partnerId}`,
  })
}

export async function notifyPartnerOwnerOrderCustomerAction(input: {
  partnerId: string
  title: string
  body: string
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_order_customer_action',
    title: input.title,
    body: input.body,
    pushUrl: `/dashboard/messaging/settings?section=hub-orders&partner=${input.partnerId}`,
  })
}

export async function notifyPartnerOwnerNewReview(input: {
  partnerId: string
  reviewerName: string
  rating: number
  content: string
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_new_review',
    title: `Đánh giá mới (${input.rating}★)`,
    body: `${input.reviewerName || 'Khách hàng'}: "${input.content.slice(0, 140)}"`,
    pushUrl: `/dashboard/messaging/website?partner=${input.partnerId}`,
  })
}
