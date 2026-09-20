import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { sendSmtpMail, type SmtpInlineAttachment } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import {
  formatCheckoutSubmittedEmailContentForCustomer,
  formatDepositConfirmedEmailContentForCustomer,
  formatDepositReminderEmailContentForCustomer,
  formatOrderCancelledEmailContentForCustomer,
  formatOrderDeliveredReviewEmailContentForCustomer,
  formatOrderReviewReminderEmailContentForCustomer,
  formatOrderRefundedEmailContentForCustomer,
  formatPaymentManualReviewEmailContentForCustomer,
  formatPaymentStatusEmailContentForCustomer,
  formatShippingStatusEmailContentForCustomer,
} from '@/lib/messaging/order-customer-notify-i18n'
import {
  notifyPartnerCustomerCancelledWebApp,
  notifyPartnerCustomerDepositConfirmedWebApp,
  notifyPartnerCustomerDeliveredWebApp,
  notifyPartnerCustomerProofReceivedWebApp,
  notifyPartnerCustomerRefundedWebApp,
  notifyPartnerCustomerShipperWebApp,
  notifyPartnerCustomerWebApp,
} from '@/lib/messaging/partner-customer-webapp-notify'
import { fetchConversationUiLocaleFromPg } from '@/lib/db/customer-care-pg'
import {
  partnerAdminAmountDueOnDelivery,
  partnerAdminOrderMerchandiseTotal,
} from '@/lib/messaging/partner-admin-orders-lifecycle'
import { partnerShopEmailBrandName, shopEmailSubject } from '@/lib/messaging/partner-shop-email-brand'
import {
  buildCustomerDepositQrEmailBlock,
  orderNeedsCustomerDepositMail,
  resolveCustomerOrderOpenUrl,
  resolveDepositQrForEmail,
} from '@/lib/messaging/partner-order-deposit-email'
import { type DepositRemindHour } from '@/lib/messaging/fulfillment/deposit-sla'

function trim(s: string, max = 240): string {
  return String(s || '')
    .trim()
    .slice(0, max)
}

function toVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n || 0)))}đ`
}

function customerEmailTo(order: PartnerOrderRow): string | null {
  const em = trim(order.customer_email, 180).toLowerCase()
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(em)) return null
  return em
}

type PartnerEmailMeta = {
  /** Tên hiển thị workspace — dùng cho tiêu đề / chữ ký email. */
  displayName: string
  slug: string | null
}

async function fetchPartnerEmailMeta(partnerId: string): Promise<PartnerEmailMeta> {
  const rows = await fetchMessagingPartnersByIdsFromPg([partnerId])
  const r = rows?.[0]
  const displayName = partnerShopEmailBrandName({
    brand_name: r?.brand_name,
    display_name: r?.display_name,
  })
  const slug = String(r?.slug ?? '').trim() || null
  return {
    displayName: displayName || 'Cửa hàng',
    slug,
  }
}

async function resolveOrderCustomerLocale(
  order: PartnerOrderRow,
  fallback?: string | null
): Promise<WebLocale> {
  const fromArg = normalizeWebLocale(fallback ?? '')
  if (fromArg) return fromArg
  const convId = String(order.conversation_id || '').trim()
  if (convId) {
    try {
      const raw = await fetchConversationUiLocaleFromPg(convId)
      return normalizeWebLocale(raw ?? '') ?? DEFAULT_WEB_LOCALE
    } catch {
      return DEFAULT_WEB_LOCALE
    }
  }
  return DEFAULT_WEB_LOCALE
}

async function notifyCustomerShippingWebApp(
  order: PartnerOrderRow,
  locale: WebLocale
): Promise<void> {
  const status = String(order.shipping_status || '').trim().toLowerCase()
  if (status === 'shipping') {
    await notifyPartnerCustomerShipperWebApp(order, locale)
    return
  }
  if (status === 'delivered') {
    await notifyPartnerCustomerDeliveredWebApp(order, 'ems_auto', locale)
    return
  }
  if (status === 'cancelled') {
    await notifyPartnerCustomerCancelledWebApp(order, { locale })
  }
}

function guestChatOrderUrlFromSlug(slug: string | null, orderId: string): string | null {
  if (!slug || !orderId.trim()) return null
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  return `${origin}/messaging/p/${encodeURIComponent(slug)}?order=${encodeURIComponent(orderId.trim())}`
}

/** Trang chat shop — tham số `order` mở thẳng chi tiết đơn (hosted / embed). */
export async function guestChatOrderDetailUrl(
  order: PartnerOrderRow,
  meta?: PartnerEmailMeta
): Promise<string | null> {
  const m = meta ?? (await fetchPartnerEmailMeta(order.partner_id))
  return guestChatOrderUrlFromSlug(m.slug, order.id)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type CustomerMailCtaOpts = {
  /** Mail Ä‘áº·t hÃ ng / nháº¯c cá»c: nhÃºng QR khi Ä‘Æ¡n cÃ²n cáº§n cá»c. */
  includeDepositQr?: boolean
  /** Shop Ä‘Ã£ xÃ¡c nháº­n cá»c â€” CTA xem Ä‘Æ¡n, khÃ´ng kÃªu Ä‘áº·t cá»c láº¡i. */
  depositAlreadyConfirmed?: boolean
  ctaHeading?: string
  ctaButton?: string
  ctaTextHint?: string
}

async function resolveCustomerMailOpenUrl(
  order: PartnerOrderRow,
  meta: PartnerEmailMeta,
  needsDeposit: boolean
): Promise<string | null> {
  const chatUrl = await guestChatOrderDetailUrl(order, meta)
  return resolveCustomerOrderOpenUrl({
    partnerId: order.partner_id,
    orderId: order.id,
    needsDeposit,
    chatFallback: chatUrl,
  })
}

function wrapCustomerMailHtml(baseText: string, extraHtml: string): string {
  return `<div style="white-space:pre-wrap;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(baseText)}</div>${extraHtml}`
}

function orderOpenCtaHtml(input: {
  url: string
  heading: string
  button: string
}): string {
  return `<p style="margin:16px 0 8px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#111827;">${escapeHtml(input.heading)}</p><p style="margin:0 0 12px;"><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 22px;background:#111827;color:#ffffff !important;text-decoration:none;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:600;">${escapeHtml(input.button)}</a></p><p style="font-size:12px;color:#6b7280;margin:0;font-family:system-ui,sans-serif;">Hoặc mở liên kết: <a href="${escapeHtml(input.url)}">${escapeHtml(input.url)}</a></p>`
}

/** Nội dung text + HTML (nút mở đơn / trang cọc + QR nếu cần) cho email khách. */
async function customerMailBodyWithOrderCta(
  order: PartnerOrderRow,
  linesBeforeCta: string[],
  meta?: PartnerEmailMeta,
  opts?: CustomerMailCtaOpts
): Promise<{ text: string; html: string; attachments?: SmtpInlineAttachment[] }> {
  const m = meta ?? (await fetchPartnerEmailMeta(order.partner_id))
  const needsDeposit = opts?.depositAlreadyConfirmed
    ? false
    : orderNeedsCustomerDepositMail({
        requiredAmount: order.required_amount,
        paidAmount: order.paid_amount,
      })
  const includeQr = Boolean(opts?.includeDepositQr && needsDeposit)
  const openUrl = await resolveCustomerMailOpenUrl(order, m, needsDeposit)
  const ctaHeading =
    opts?.ctaHeading ??
    (needsDeposit ? 'Bấm vào đây để mở đơn và đặt cọc nhanh:' : 'Bấm vào đây để xem chi tiết đơn hàng:')
  const ctaButton = opts?.ctaButton ?? (needsDeposit ? 'Mở đơn đặt cọc' : 'Xem chi tiết đơn hàng')
  const ctaTextHint =
    opts?.ctaTextHint ?? (needsDeposit ? 'Mở đơn nhanh để đặt cọc:' : 'Xem chi tiết đơn hàng:')

  let qrText = ''
  let qrHtml = ''
  let attachments: SmtpInlineAttachment[] | undefined
  if (includeQr) {
    const qr = await resolveDepositQrForEmail({
      qrUrl: order.payment_qr_url,
      orderCode: order.payment_reference,
    })
    if (qr) {
      const block = buildCustomerDepositQrEmailBlock({
        qrImageSrc: qr.htmlSrc,
        amountLabel: toVnd(order.required_amount),
        transferMemo: trim(order.payment_reference, 64),
      })
      qrText = block.text
      qrHtml = block.html
      if (qr.attachment) attachments = [qr.attachment]
    }
  }

  const baseText = linesBeforeCta.join('\n')
  const signIdx = baseText.lastIndexOf('\nTrân trọng,\n')
  const bodyText = signIdx >= 0 ? baseText.slice(0, signIdx).replace(/\n+$/, '') : baseText
  const signText = signIdx >= 0 ? baseText.slice(signIdx + 1) : ''
  const textParts = [bodyText]
  if (qrText) textParts.push('', qrText)
  if (openUrl) textParts.push('', 'â€”', ctaTextHint, openUrl)
  if (signText) textParts.push('', signText)
  const extraHtml =
    qrHtml +
    (openUrl ? orderOpenCtaHtml({ url: openUrl, heading: ctaHeading, button: ctaButton }) : '') +
    (signText
      ? `<div style="white-space:pre-wrap;margin:16px 0 0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(signText)}</div>`
      : '')
  return {
    text: textParts.filter((p) => p.length > 0).join('\n') + (openUrl || qrText || signText ? '\n' : ''),
    html: wrapCustomerMailHtml(bodyText, extraHtml),
    attachments,
  }
}

async function appendShopOrderLinkLines(
  order: PartnerOrderRow,
  lines: string[],
  meta?: PartnerEmailMeta
): Promise<void> {
  const m = meta ?? (await fetchPartnerEmailMeta(order.partner_id))
  const u = await guestChatOrderDetailUrl(order, m)
  if (u) {
    lines.push('', `Mở đơn trên trang chat: ${u}`)
  }
}

/** Đặt hàng thành công — có mã CK / QR (hoặc COD 0đ). */
export async function emailCustomerOrderCheckoutSubmitted(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  const ref = trim(input.order.payment_reference, 64)
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatCheckoutSubmittedEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: ref,
    productName: trim(input.order.product_name, 200),
    quantity: input.order.quantity,
    subtotalLabel: toVnd(input.order.subtotal_amount),
    requiredAmountLabel: toVnd(input.order.required_amount),
    depositPercent: input.order.deposit_percent,
    needsDeposit: input.order.required_amount > 0,
    sepayAutoConfirm: isSepayStyleOrderPayment({
      payment_qr_url: input.order.payment_qr_url,
      payment_reference: input.order.payment_reference,
    }),
    shippingAddress: trim(input.order.shipping_address, 500),
    customerPhone: trim(input.order.customer_phone, 40),
  })
  if (to) {
    const { text, html, attachments } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta, {
      includeDepositQr: true,
    })
    await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel, attachments })
  }
  const shop = trim(input.shopNotifyEmail, 180).toLowerCase()
  if (shop && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(shop)) {
    const shopLines = [
      `Có đơn mới từ chat widget.`,
      `Shop: ${shopLabel}`,
      `Mã: ${ref}`,
      `KH: ${trim(input.order.customer_name)} | ${trim(input.order.customer_phone)} | ${to || '(chưa có email khách)'}`,
      `SP: ${trim(input.order.product_name)}`,
      `Cần thanh toán: ${toVnd(input.order.required_amount)}`,
    ]
    await appendShopOrderLinkLines(input.order, shopLines, meta)
    await sendSmtpMail({
      to: shop,
      subject: `${shopLabel} — [Thông báo shop] Đơn mới ${ref}`,
      text: shopLines.join('\n'),
      fromName: shopLabel,
    })
  }
}

function depositConfirmedNotifyInput(
  order: PartnerOrderRow,
  shopLabel: string,
  locale?: string | null
) {
  const loc = normalizeWebLocale(locale ?? '') ?? DEFAULT_WEB_LOCALE
  const paid = Math.max(0, Math.round(order.paid_amount || 0))
  const remaining = partnerAdminAmountDueOnDelivery(order)
  return {
    locale: loc,
    shopLabel,
    customerName: trim(order.customer_name, 80),
    paymentRef: trim(order.payment_reference, 64),
    productName: trim(order.product_name, 200),
    orderTotalLabel: toVnd(partnerAdminOrderMerchandiseTotal(order)),
    paidAmountLabel: toVnd(paid),
    remainingAmountLabel: toVnd(remaining),
    remainingAmount: remaining,
    shopNote: trim(order.verified_note, 500) || undefined,
  }
}

/** Admin nhập số đã nhận cọc — mail khách ghi rõ đã cọc và còn thu khi nhận hàng. */
export async function emailCustomerOrderDepositConfirmed(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatDepositConfirmedEmailContentForCustomer(
    depositConfirmedNotifyInput(input.order, shopLabel, locale)
  )
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta, {
      depositAlreadyConfirmed: true,
    })
    await sendSmtpMail({
      to,
      subject: copy.subject,
      text,
      html,
      fromName: shopLabel,
    })
  }
  await notifyPartnerCustomerDepositConfirmedWebApp(input.order, locale)
}

/** Cọc / thanh toán đã xác minh (AI hoặc webhook). */
export async function emailCustomerOrderPaymentVerified(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  const ref = trim(input.order.payment_reference, 64)
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const amounts = depositConfirmedNotifyInput(input.order, shopLabel, locale)
  const copy = formatDepositConfirmedEmailContentForCustomer(amounts)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta, {
      depositAlreadyConfirmed: true,
    })
    await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel })
  }
  await notifyPartnerCustomerDepositConfirmedWebApp(input.order, locale)
  const shop = trim(input.shopNotifyEmail, 180).toLowerCase()
  if (shop && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(shop)) {
    const shopLines = [
      `Shop: ${shopLabel}`,
      `Đơn ${ref} đã xác nhận đặt cọc.`,
      `KH: ${trim(input.order.customer_name)} | ${trim(input.order.customer_phone)}`,
      `Tổng đơn: ${amounts.orderTotalLabel}`,
      `Số tiền đã cọc: ${amounts.paidAmountLabel}`,
      `Còn thu khi nhận hàng: ${amounts.remainingAmountLabel}`,
    ]
    await appendShopOrderLinkLines(input.order, shopLines, meta)
    await sendSmtpMail({
      to: shop,
      subject: `${shopLabel} — [Thông báo shop] Đã cọc ${ref}`,
      text: shopLines.join('\n'),
      fromName: shopLabel,
    })
  }
}

/** Chứng từ cần duyệt tay — vẫn báo email cho khách. */
export async function emailCustomerOrderPaymentManualReview(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatPaymentManualReviewEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
  })
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta)
    await sendSmtpMail({
      to,
      subject: copy.subject,
      text,
      html,
      fromName: shopLabel,
    })
  }
  await notifyPartnerCustomerProofReceivedWebApp(input.order, locale)
}

export async function emailCustomerShippingStatusChanged(input: {
  order: PartnerOrderRow
  /** `metadata.ui_locale` trên hội thoại widget — đồng bộ với tin chat. */
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatShippingStatusEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    productName: trim(input.order.product_name, 200),
    shippingStatus: input.order.shipping_status,
  })
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta)
    await sendSmtpMail({
      to,
      subject: copy.subject,
      text,
      html,
      fromName: shopLabel,
    })
  }
  await notifyCustomerShippingWebApp(input.order, locale)
}

export async function emailCustomerOrderPaymentStatusChanged(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  if (input.order.status === 'cancelled') {
    await emailCustomerOrderCancelled({ order: input.order, customerLocale: locale })
    return
  }
  const copy = formatPaymentStatusEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    status: input.order.status,
    shopNote: trim(input.order.verified_note, 500) || undefined,
  })
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta)
    await sendSmtpMail({
      to,
      subject: copy.subject,
      text,
      html,
      fromName: shopLabel,
    })
  }
  if (input.order.status === 'paid_verified') {
    await notifyPartnerCustomerDepositConfirmedWebApp(input.order, locale)
  } else if (input.order.status === 'pending_manual_review') {
    await notifyPartnerCustomerProofReceivedWebApp(input.order, locale)
  }
}

export async function emailCustomerOrderCancelled(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
  reason?: string | null
  byCustomer?: boolean
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatOrderCancelledEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    productName: trim(input.order.product_name, 200),
    reason: input.reason?.trim() || undefined,
  })
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta)
    await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel })
  }
  await notifyPartnerCustomerCancelledWebApp(input.order, {
    locale,
    byCustomer: input.byCustomer,
  })
}

export async function emailCustomerOrderRefunded(input: {
  order: PartnerOrderRow
  refundAmount: number
  customerLocale?: string | null
  shopNote?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatOrderRefundedEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    productName: trim(input.order.product_name, 200),
    refundAmountLabel: toVnd(input.refundAmount),
    shopNote: input.shopNote?.trim() || undefined,
  })
  const to = customerEmailTo(input.order)
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, copy.lines, meta)
    await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel })
  }
  await notifyPartnerCustomerRefundedWebApp(input.order, toVnd(input.refundAmount), locale)
}

function reviewMailCta(locale: WebLocale): Pick<
  CustomerMailCtaOpts,
  'ctaHeading' | 'ctaButton' | 'ctaTextHint'
> {
  if (locale === 'zh') {
    return { ctaHeading: '打开订单并评价商品：', ctaButton: '评价商品', ctaTextHint: '打开订单评价：' }
  }
  if (locale === 'ja') {
    return {
      ctaHeading: '注文を開いて商品をレビュー：',
      ctaButton: '商品をレビュー',
      ctaTextHint: 'レビューする注文を開く：',
    }
  }
  if (locale === 'ko') {
    return { ctaHeading: '주문을 열어 상품을 리뷰하세요:', ctaButton: '상품 리뷰', ctaTextHint: '리뷰할 주문 열기:' }
  }
  if (locale === 'en') {
    return { ctaHeading: 'Open your order to review the product:', ctaButton: 'Review product', ctaTextHint: 'Open order to review:' }
  }
  return {
    ctaHeading: 'Mở đơn hàng để đánh giá sản phẩm:',
    ctaButton: 'Đánh giá sản phẩm',
    ctaTextHint: 'Mở đơn để đánh giá:',
  }
}

export async function emailCustomerOrderDeliveredReview(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
  skipInApp?: boolean
}): Promise<boolean> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatOrderDeliveredReviewEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    productName: trim(input.order.product_name, 200),
  })
  const to = customerEmailTo(input.order)
  let sent = false
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(
      input.order,
      copy.lines,
      meta,
      reviewMailCta(locale)
    )
    const result = await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel })
    sent = result.ok
  }
  if (!input.skipInApp) {
    await notifyPartnerCustomerDeliveredWebApp(input.order, 'ems_auto', locale)
  }
  return sent
}

export async function emailCustomerOrderReviewReminder(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
}): Promise<boolean> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const locale = await resolveOrderCustomerLocale(input.order, input.customerLocale)
  const copy = formatOrderReviewReminderEmailContentForCustomer({
    locale,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: trim(input.order.payment_reference, 64),
    productName: trim(input.order.product_name, 200),
  })
  const to = customerEmailTo(input.order)
  if (!to) return false
  const { text, html } = await customerMailBodyWithOrderCta(
    input.order,
    copy.lines,
    meta,
    reviewMailCta(locale)
  )
  const result = await sendSmtpMail({ to, subject: copy.subject, text, html, fromName: shopLabel })
  return result.ok
}

/** Nhắc cọc 2h / 20h — link mở đơn nhanh + QR. Không gửi cho chủ shop. */
export async function emailCustomerDepositReminder(input: {
  partnerId: string
  orderId: string
  customerEmail: string
  shopName: string
  paymentReference: string
  paymentQrUrl: string
  requiredAmount: number
  paidAmount?: number
  hours: DepositRemindHour
  customerLocale?: string | null
  conversationId?: string | null
}): Promise<void> {
  const to = trim(input.customerEmail, 180).toLowerCase()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(to)) return
  const meta = await fetchPartnerEmailMeta(input.partnerId)
  const shopLabel = meta.displayName || input.shopName.trim() || 'Shop'
  const ref = trim(input.paymentReference, 64)
  let locale = normalizeWebLocale(input.customerLocale ?? '') ?? DEFAULT_WEB_LOCALE
  if (!input.customerLocale && input.conversationId) {
    try {
      const raw = await fetchConversationUiLocaleFromPg(input.conversationId)
      locale = normalizeWebLocale(raw ?? '') ?? DEFAULT_WEB_LOCALE
    } catch {
      /* keep default */
    }
  }
  const needsDeposit = orderNeedsCustomerDepositMail({
    requiredAmount: input.requiredAmount,
    paidAmount: input.paidAmount,
  })
  const openUrl = await resolveCustomerOrderOpenUrl({
    partnerId: input.partnerId,
    orderId: input.orderId,
    needsDeposit: true,
    chatFallback: guestChatOrderUrlFromSlug(meta.slug, input.orderId),
  })
  const copy = formatDepositReminderEmailContentForCustomer({
    locale,
    shopLabel,
    orderCode: ref || input.orderId.slice(0, 8),
    hours: input.hours,
  })
  let qrText = ''
  let qrHtml = ''
  let attachments: SmtpInlineAttachment[] | undefined
  if (needsDeposit) {
    const qr = await resolveDepositQrForEmail({
      qrUrl: input.paymentQrUrl,
      orderCode: ref,
    })
    if (qr) {
      const block = buildCustomerDepositQrEmailBlock({
        qrImageSrc: qr.htmlSrc,
        amountLabel: toVnd(input.requiredAmount),
        transferMemo: ref,
      })
      qrText = block.text
      qrHtml = block.html
      if (qr.attachment) attachments = [qr.attachment]
    }
  }
  const text = [copy.text, qrText, openUrl ? `Mở đơn nhanh: ${openUrl}` : '', `Trân trọng,\n${shopLabel}`]
    .filter(Boolean)
    .join('\n\n') + '\n'
  const extraHtml =
    qrHtml +
    (openUrl
      ? orderOpenCtaHtml({
          url: openUrl,
          heading: 'Bấm vào đây để mở đơn và đặt cọc nhanh:',
          button: 'Mở đơn đặt cọc',
        })
      : '') +
    `<p style="margin:20px 0 0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#111827;">Trân trọng,<br/>${escapeHtml(shopLabel)}</p>`
  await sendSmtpMail({
    to,
    subject: shopEmailSubject(shopLabel, copy.subjectRest),
    text,
    html: wrapCustomerMailHtml(copy.text, extraHtml),
    fromName: shopLabel,
    attachments,
  })
  await notifyPartnerCustomerWebApp({
    partnerId: input.partnerId,
    conversationId: input.conversationId,
    customerEmail: to,
    orderId: input.orderId,
    locale,
    event: { kind: 'deposit_reminder', orderCode: ref || input.orderId.slice(0, 8), hours: input.hours },
  }).catch((e) => console.warn('[emailCustomerDepositReminder] in-app', e))
}
