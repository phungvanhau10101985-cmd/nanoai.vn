import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import {
  fetchMessagingPartnerOwnerUserIdFromPg,
  fetchMessagingPartnersByIdsFromPg,
  listMessagingPartnerNotifyUserIdsFromPg,
} from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerPaymentSettingsFromPg,
  type PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'
import { partnerShopEmailBrandName, shopEmailSubject } from '@/lib/messaging/partner-shop-email-brand'
import { hasRecentUserNotificationFromPg } from '@/lib/db/notifications-repo'
import type { PartnerWebsiteLeadRow } from '@/lib/db/partner-website-leads-pg'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { findGuestAccountIdByEmailPg } from '@/lib/db/messaging-guest-pg'
import { sendPartnerCustomerWebPush } from '@/lib/messaging/partner-customer-notification-push'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import {
  partnerOrderNotifyIdempotencyKey,
  partnerOwnerAlertSendsEmail,
  type PartnerOrderNotifyEvent,
  type PartnerOwnerAlertKind,
} from '@/lib/messaging/partner-order-notify-ui'

/**
 * M4.1 — thông báo webapp cho người quản trị shop (chủ, tài khoản trùng email chủ, nhân viên).
 * Khác W5.2 (thông báo cho khách hàng cuối).
 */

function toVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

function ownerOrdersUrl(partnerId: string): string {
  return `/dashboard/messaging/settings?section=hub-orders&partner=${partnerId}`
}

function isMailbox(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
}

/** Một hộp thư quản trị: notify_email nếu có, không thì email chủ shop. */
async function resolvePartnerOwnerAlertEmail(partnerId: string): Promise<string | null> {
  const settings = await fetchPartnerPaymentSettingsFromPg(partnerId)
  const notify = String(settings?.notify_email || '').trim().toLowerCase()
  if (isMailbox(notify)) return notify
  const ownerId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)
  if (!ownerId) return null
  const owner = (await getAuthUserEmailFromPg(ownerId))?.trim().toLowerCase() || ''
  return isMailbox(owner) ? owner : null
}

async function shopNotifyInboxConfigured(partnerId: string): Promise<boolean> {
  const settings = await fetchPartnerPaymentSettingsFromPg(partnerId)
  return isMailbox(String(settings?.notify_email || '').trim().toLowerCase())
}

async function notifyPartnerOwner(input: {
  partnerId: string
  type: string
  title: string
  body: string
  pushUrl: string
  alertKind: PartnerOwnerAlertKind
  extraMeta?: Record<string, unknown>
  excludeUserId?: string | null
  idempotencyKey?: string
}): Promise<void> {
  try {
    const skip = input.excludeUserId?.trim() || ''
    const userIds = (await listMessagingPartnerNotifyUserIdsFromPg(input.partnerId)).filter(
      (id) => id !== skip
    )
    if (!userIds.length) {
      console.warn('[notifyPartnerOwner] no dashboard users', input.type, input.partnerId)
      return
    }
    const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
    const shopName = partnerShopEmailBrandName(partners?.[0])
    const platformOrigin = getPublicAppUrlForServer().replace(/\/$/, '')
    const dashboardHref = input.pushUrl.startsWith('http')
      ? input.pushUrl
      : `${platformOrigin}${input.pushUrl.startsWith('/') ? input.pushUrl : `/${input.pushUrl}`}`
    const phoneTitle = shopEmailSubject(shopName, input.title)
    let insertedAny = false
    await Promise.all(
      userIds.map(async (user_id) => {
        if (input.idempotencyKey) {
          const duplicate = await hasRecentUserNotificationFromPg({
            userId: user_id,
            type: input.type,
            metaKey: 'idempotency_key',
            metaValue: input.idempotencyKey,
            withinMinutes: 60 * 24 * 365 * 10,
          })
          if (duplicate) return
        }
        const inserted = await deliverUserNotificationPg({
          user_id,
          type: input.type,
          title: input.title,
          body: input.body,
          meta: {
            push_url: input.pushUrl,
            partner_id: input.partnerId,
            shop_display_name: shopName,
            skip_platform_push: true,
            skip_email: true,
            ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
            ...(input.extraMeta ?? {}),
          },
        })
        if (!inserted) return
        insertedAny = true
        const email = (await getAuthUserEmailFromPg(user_id))?.trim().toLowerCase() || ''
        const guestAccountId = email ? await findGuestAccountIdByEmailPg(input.partnerId, email) : null
        if (!guestAccountId) return
        await sendPartnerCustomerWebPush({
          partnerId: input.partnerId,
          guestAccountId,
          title: phoneTitle,
          body: input.body,
          href: dashboardHref,
          tag: `pw-shop-owner-${input.type}`,
        })
      })
    )
    if (!insertedAny) return
    const sendEmail = partnerOwnerAlertSendsEmail(input.alertKind, {
      shopNotifyInboxConfigured: await shopNotifyInboxConfigured(input.partnerId),
    })
    if (!sendEmail || !isSmtpConfigured()) return
    const to = await resolvePartnerOwnerAlertEmail(input.partnerId)
    if (!to) return
    if (input.excludeUserId) {
      const actor = (await getAuthUserEmailFromPg(input.excludeUserId))?.trim().toLowerCase() || ''
      if (actor && actor === to) return
    }
    await sendSmtpMail({
      to,
      subject: phoneTitle,
      text: [input.title, '', input.body, '', '—', `Thông báo từ ${shopName}.`].join('\n'),
      fromName: shopName,
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
    alertKind: 'new_order',
    extraMeta: { order_id: order.id },
    idempotencyKey: partnerOrderNotifyIdempotencyKey({
      partnerId,
      orderId: order.id,
      event: 'order_placed',
      channel: 'owner',
    }),
  })
}

export async function notifyPartnerOwnerPaymentVerified(
  partnerId: string,
  order: PartnerOrderRow,
  opts?: { excludeUserId?: string | null }
): Promise<void> {
  const ref = order.payment_reference || order.id.slice(0, 8)
  await notifyPartnerOwner({
    partnerId,
    type: 'messaging_partner_payment_verified',
    title: 'Đã nhận cọc / thanh toán',
    body: `Đơn ${ref}: đã xác nhận ${toVnd(order.paid_amount || 0)} từ ${order.customer_name || 'khách'}.`,
    pushUrl: ownerOrdersUrl(partnerId),
    alertKind: 'payment_verified',
    extraMeta: { order_id: order.id },
    excludeUserId: opts?.excludeUserId,
    idempotencyKey: partnerOrderNotifyIdempotencyKey({
      partnerId,
      orderId: order.id,
      event: 'payment_confirmed',
      channel: 'owner',
    }),
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
    alertKind: 'payment_review',
    extraMeta: { order_id: order.id },
    idempotencyKey: partnerOrderNotifyIdempotencyKey({
      partnerId,
      orderId: order.id,
      event: 'payment_proof_received',
      channel: 'owner',
    }),
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
    alertKind: 'new_question',
  })
}

export async function notifyPartnerOwnerOrderCustomerAction(input: {
  partnerId: string
  title: string
  body: string
  orderId?: string | null
  conversationId?: string | null
  event?: Extract<PartnerOrderNotifyEvent, 'customer_cancelled' | 'customer_received'>
}): Promise<void> {
  await notifyPartnerOwner({
    partnerId: input.partnerId,
    type: 'messaging_partner_order_customer_action',
    title: input.title,
    body: input.body,
    pushUrl: ownerOrdersUrl(input.partnerId),
    alertKind: input.event === 'customer_cancelled' ? 'customer_cancelled' : 'customer_received',
    idempotencyKey: input.event
      ? partnerOrderNotifyIdempotencyKey({
          partnerId: input.partnerId,
          orderId: input.orderId,
          conversationId: input.conversationId,
          event: input.event,
          channel: 'owner',
        })
      : undefined,
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
    alertKind: 'new_review',
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
    alertKind: 'new_lead',
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
    alertKind: 'affiliate_apply',
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
    alertKind: 'affiliate_withdraw',
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
    const userIds = await listMessagingPartnerNotifyUserIdsFromPg(input.partnerId)
    const cooldownUserId =
      (await fetchMessagingPartnerOwnerUserIdFromPg(input.partnerId)) || userIds[0] || ''
    if (!cooldownUserId) return
    const recent = await hasRecentUserNotificationFromPg({
      userId: cooldownUserId,
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
      alertKind: 'chat_needs_reply',
      extraMeta: { conversation_id: input.conversationId },
      idempotencyKey: partnerOrderNotifyIdempotencyKey({
        partnerId: input.partnerId,
        conversationId: `${input.conversationId}:${Math.floor(Date.now() / (20 * 60_000))}`,
        event: 'chat_needs_reply',
        channel: 'owner',
      }),
    })
  } catch (e) {
    console.warn('[notifyPartnerOwnerChatNeedsReply]', e)
  }
}
