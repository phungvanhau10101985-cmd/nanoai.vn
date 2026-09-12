import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { sendSmtpMail, type SmtpInlineAttachment } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'
import { formatShippingStatusEmailContentForCustomer } from '@/lib/messaging/order-customer-notify-i18n'
import { partnerShopEmailBrandName, shopEmailSubject } from '@/lib/messaging/partner-shop-email-brand'
import {
  buildCustomerDepositQrEmailBlock,
  orderNeedsCustomerDepositMail,
  resolveCustomerOrderOpenUrl,
  resolveDepositQrForEmail,
} from '@/lib/messaging/partner-order-deposit-email'
import { depositReminderCopy, type DepositRemindHour } from '@/lib/messaging/fulfillment/deposit-sla'

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

const shipVi: Record<PartnerOrderRow['shipping_status'], string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao',
  returned: 'Hoàn trả',
  cancelled: 'Đã hủy (giao hàng)',
}

const payVi: Record<PartnerOrderRow['status'], string> = {
  awaiting_payment: 'Chờ thanh toán',
  payment_checking: 'Đang kiểm tra thanh toán',
  paid_verified: 'Đã xác nhận thanh toán',
  pending_manual_review: 'Chờ shop duyệt tay',
  cancelled: 'Đã hủy',
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
  /** Mail đặt hàng / nhắc cọc: nhúng QR khi đơn còn cần cọc. */
  includeDepositQr?: boolean
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
  const needsDeposit = orderNeedsCustomerDepositMail({
    requiredAmount: order.required_amount,
    paidAmount: order.paid_amount,
  })
  const includeQr = Boolean(opts?.includeDepositQr && needsDeposit)
  const openUrl = await resolveCustomerMailOpenUrl(order, m, needsDeposit)
  const ctaHeading = needsDeposit
    ? 'Bấm vào đây để mở đơn và đặt cọc nhanh:'
    : 'Bấm vào đây để xem chi tiết đơn hàng:'
  const ctaButton = needsDeposit ? 'Mở đơn đặt cọc' : 'Xem chi tiết đơn hàng'
  const ctaTextHint = needsDeposit
    ? 'Mở đơn nhanh để đặt cọc:'
    : 'Xem chi tiết đơn hàng:'

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
  if (openUrl) textParts.push('', '—', ctaTextHint, openUrl)
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
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  const ref = trim(input.order.payment_reference, 64)
  const subj = `${shopLabel} — Đơn ${ref} — đã nhận thông tin đặt hàng`
  const lines: string[] = [
    `Xin chào ${trim(input.order.customer_name, 80) || 'quý khách'},`,
    '',
    `Đơn hàng của bạn đã được ghi nhận tại ${shopLabel}.`,
    `Mã đơn / nội dung CK: ${ref}`,
    `Sản phẩm: ${trim(input.order.product_name, 200)}`,
    `Số lượng: ${input.order.quantity}`,
    `Tổng tiền hàng: ${toVnd(input.order.subtotal_amount)}`,
    `Số tiền cần đặt cọc trước: ${toVnd(input.order.required_amount)} (${input.order.deposit_percent}% cọc).`,
    '',
    input.order.required_amount > 0
      ? isSepayStyleOrderPayment({
          payment_qr_url: input.order.payment_qr_url,
          payment_reference: input.order.payment_reference,
        })
        ? `Vui lòng chuyển khoản đúng số tiền và nội dung CK (quét mã QR trong email này hoặc mở đơn nhanh); xác nhận tự động qua hệ thống của ${shopLabel} — không cần gửi ảnh biên lai.`
        : 'Vui lòng chuyển khoản đúng số tiền và nội dung CK. Quét mã QR trong email này hoặc mở đơn nhanh, rồi gửi ảnh biên lai nếu được yêu cầu.'
      : 'Đơn không yêu cầu cọc trước — shop sẽ liên hệ xác nhận và giao hàng.',
    '',
    `Địa chỉ nhận: ${trim(input.order.shipping_address, 500)}`,
    `SĐT: ${trim(input.order.customer_phone, 40)}`,
    '',
    'Trân trọng,',
    shopLabel,
  ]
  if (to) {
    const { text, html, attachments } = await customerMailBodyWithOrderCta(input.order, lines, meta, {
      includeDepositQr: true,
    })
    await sendSmtpMail({ to, subject: subj, text, html, fromName: shopLabel, attachments })
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

/** Cọc / thanh toán đã xác minh (AI hoặc webhook). */
export async function emailCustomerOrderPaymentVerified(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  const ref = trim(input.order.payment_reference, 64)
  const subj = `${shopLabel} — Đơn ${ref} — đã xác nhận thanh toán`
  const lines = [
    `Xin chào ${trim(input.order.customer_name, 80) || 'quý khách'},`,
    '',
    `Shop đã xác nhận thanh toán cho đơn của bạn.`,
    `Mã đơn: ${ref}`,
    `Sản phẩm: ${trim(input.order.product_name, 200)}`,
    `Số tiền ghi nhận: ${toVnd(input.order.paid_amount)}`,
    `Trạng thái giao hàng: ${shipVi[input.order.shipping_status] ?? input.order.shipping_status}`,
    '',
    `Shop sẽ liên hệ theo SĐT: ${trim(input.order.customer_phone, 40)}`,
    '',
    'Trân trọng,',
    shopLabel,
  ]
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
    await sendSmtpMail({ to, subject: subj, text, html, fromName: shopLabel })
  }
  const shop = trim(input.shopNotifyEmail, 180).toLowerCase()
  if (shop && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(shop)) {
    const shopLines = [
      `Shop: ${shopLabel}`,
      `Đơn ${ref} đã chuyển sang trạng thái thanh toán đã xác nhận.`,
      `KH: ${trim(input.order.customer_name)} | ${trim(input.order.customer_phone)}`,
      `Số tiền: ${toVnd(input.order.paid_amount)}`,
    ]
    await appendShopOrderLinkLines(input.order, shopLines, meta)
    await sendSmtpMail({
      to: shop,
      subject: `${shopLabel} — [Thông báo shop] Đã thanh toán ${ref}`,
      text: shopLines.join('\n'),
      fromName: shopLabel,
    })
  }
}

/** Chứng từ cần duyệt tay — vẫn báo email cho khách. */
export async function emailCustomerOrderPaymentManualReview(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  if (!to) return
  const ref = trim(input.order.payment_reference, 64)
  const lines = [
    `Xin chào ${trim(input.order.customer_name, 80) || 'quý khách'},`,
    '',
    'Chúng tôi đã nhận ảnh/ thông tin thanh toán của bạn. Shop sẽ kiểm tra và phản hồi sớm trong chat.',
    `Mã đơn: ${ref}`,
    '',
    'Trân trọng,',
    shopLabel,
  ]
  const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
  await sendSmtpMail({
    to,
    subject: `${shopLabel} — Đơn ${ref} — đã nhận chứng từ, chờ shop xác nhận`,
    text,
    html,
    fromName: shopLabel,
  })
}

export async function emailCustomerShippingStatusChanged(input: {
  order: PartnerOrderRow
  /** `metadata.ui_locale` trên hội thoại widget — đồng bộ với tin chat. */
  customerLocale?: string | null
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  if (!to) return
  const ref = trim(input.order.payment_reference, 64)
  const loc = normalizeWebLocale(input.customerLocale ?? '') ?? DEFAULT_WEB_LOCALE
  const { subject, lines } = formatShippingStatusEmailContentForCustomer({
    locale: loc,
    shopLabel,
    customerName: trim(input.order.customer_name, 80),
    paymentRef: ref,
    productName: trim(input.order.product_name, 200),
    shippingStatus: input.order.shipping_status,
  })
  const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
  await sendSmtpMail({
    to,
    subject,
    text,
    html,
    fromName: shopLabel,
  })
}

export async function emailCustomerOrderPaymentStatusChanged(input: {
  order: PartnerOrderRow
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  if (!to) return
  const ref = trim(input.order.payment_reference, 64)
  const label = payVi[input.order.status] ?? input.order.status
  const note = trim(input.order.verified_note, 500)
  const lines: string[] = [
    `Xin chào ${trim(input.order.customer_name, 80) || 'quý khách'},`,
    '',
    `Trạng thái thanh toán đơn của bạn: ${label}.`,
    `Mã đơn: ${ref}`,
  ]
  if (note) lines.push(`Ghi chú: ${note}`)
  lines.push('', 'Trân trọng,', shopLabel)
  const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
  await sendSmtpMail({
    to,
    subject: `${shopLabel} — Đơn ${ref} — cập nhật: ${label}`,
    text,
    html,
    fromName: shopLabel,
  })
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
}): Promise<void> {
  const to = trim(input.customerEmail, 180).toLowerCase()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(to)) return
  const meta = await fetchPartnerEmailMeta(input.partnerId)
  const shopLabel = meta.displayName || input.shopName.trim() || 'Shop'
  const ref = trim(input.paymentReference, 64)
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
  const copy = depositReminderCopy({
    shopName: shopLabel,
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
}
