import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { fetchMessagingPartnerOwnerUserIdFromPg, fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { partnerShopEmailBrandName } from '@/lib/messaging/partner-shop-email-brand'
import { hasRecentUserNotificationFromPg } from '@/lib/db/notifications-repo'
import type { PartnerWebsiteLeadRow } from '@/lib/db/partner-website-leads-pg'

/**
 * M4.1 — thông báo cho MERCHANT (chủ shop) khi có đơn mới / cọc / lead / chat / CTV.
 * Khác W5.2 (thông báo cho khách hàng cuối).
 * Chỉ gửi cho chủ shop (`owner_user_id`).
 */

function toVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

function ownerOrdersUrl(partnerId: string): string {
  return `/dashboard/messaging/settings?section=hub-orders&partner=${partnerId}`
}

async function notifyPartnerOwner(input: {
  partnerId: string
  type: string
  title: string
  body: string
  pushUrl: string
  extraMeta?: Record<string, unknown>
}): Promise<void> {
  try {
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(input.partnerId)
    if (!ownerUserId) return
    const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
    const shopName = partnerShopEmailBrandName(partners?.[0])
    await deliverUserNotificationPg({
      user_id: ownerUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      meta: {
        push_url: input.pushUrl,
        partner_id: input.partnerId,
        shop_display_name: shopName,
        ...(input.extraMeta ?? {}),
      },
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
    pushUrl: ownerOrdersUrl(partnerId),
    extraMeta: { order_id: order.id },
  })
}

export async function notifyPartnerOwnerPaymentVerified(partnerId: string, order: PartnerOrderRow): Promise<void> {
  const ref = order.payment_reference || order.id.slice(0, 8)
  await notifyPartnerOwner({
    partnerId,
    type: 'messaging_partner_payment_verified',
    title: 'Đã nhận cọc / thanh toán',
    body: `Đơn ${ref}: đã xác nhận ${toVnd(order.paid_amount || 0)} từ ${order.customer_name || 'khách'}.`,
    pushUrl: ownerOrdersUrl(partnerId),
    extraMeta: { order_id: order.id },
  })
}

export async function notifyPartnerOwnerPaymentNeedsReview(partnerId: string, order: PartnerOrderRow): Promise<void> {
  const ref = order.payment_reference || order.id.slice(0, 8)
  await notifyPartnerOwner({
    partnerId,
    type: 'messaging_partner_payment_review',
    title: 'Cần duyệt thanh toán tay',
    body: `Đơn ${ref} có chứng từ cần bạn xác nhận (${order.customer_name || 'khách'}).`,
    pushUrl: ownerOrdersUrl(partnerId),
    extraMeta: { order_id: order.id },
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
    pushUrl: ownerOrdersUrl(input.partnerId),
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

export async function notifyPartnerOwnerNewLead(input: {
  partnerId: string
  lead: PartnerWebsiteLeadRow
}): Promise<void> {
  const bits = [input.lead.name, input.lead.phone, input.lead.email].filter(Boolean).join(' · ')
  const preview = input.lead.message.trim().slice(0, 140)
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_new_lead',
    title: 'Form liên hệ mới',
    body: preview ? `${bits}: "${preview}"` : bits || 'Khách vừa gửi form liên hệ.',
    pushUrl: `/dashboard/messaging/website?partner=${input.partnerId}#partner-website-leads`,
    extraMeta: { lead_id: input.lead.id },
  })
}

export async function notifyPartnerOwnerAffiliateApplication(input: {
  partnerId: string
  email?: string | null
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_affiliate_apply',
    title: 'Hồ sơ CTV mới',
    body: `${input.email?.trim() || 'Khách'} vừa đăng ký cộng tác viên — cần duyệt.`,
    pushUrl: `/dashboard/messaging/settings?section=hub-marketing&partner=${input.partnerId}`,
  })
}

export async function notifyPartnerOwnerAffiliateWithdrawal(input: {
  partnerId: string
  amount: number
  email?: string | null
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_affiliate_withdraw',
    title: 'Yêu cầu rút ví affiliate',
    body: `${input.email?.trim() || 'CTV'} yêu cầu rút ${toVnd(input.amount)}.`,
    pushUrl: `/dashboard/messaging/settings?section=hub-marketing&partner=${input.partnerId}`,
  })
}

/** Chat inbound khi AI tắt — tối đa 1 thông báo / hội thoại / 20 phút. */
export async function notifyPartnerOwnerChatNeedsReply(input: {
  partnerId: string
  conversationId: string
  customerName?: string | null
  preview?: string | null
}): Promise<void> {
  try {
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(input.partnerId)
    if (!ownerUserId) return
    const recent = await hasRecentUserNotificationFromPg({
      userId: ownerUserId,
      type: 'messaging_partner_chat_inbound',
      metaKey: 'conversation_id',
      metaValue: input.conversationId,
      withinMinutes: 20,
    })
    if (recent) return
    const preview = (input.preview || '').trim().slice(0, 140)
    await notifyPartnerOwner({
      partnerId: input.partnerId,
      type: 'messaging_partner_chat_inbound',
      title: 'Tin nhắn chat cần trả lời',
      body: preview
        ? `${input.customerName || 'Khách'}: "${preview}"`
        : `${input.customerName || 'Khách'} vừa nhắn — AI đang tắt.`,
      pushUrl: `/dashboard/messaging?partner=${input.partnerId}`,
      extraMeta: { conversation_id: input.conversationId },
    })
  } catch (e) {
    console.warn('[notifyPartnerOwnerChatNeedsReply]', e)
  }
}
