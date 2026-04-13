import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { sendSmtpMail } from '@/lib/email/smtp'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

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
  const displayName = String(r?.display_name ?? '').trim()
  const slug = String(r?.slug ?? '').trim() || null
  return {
    displayName: displayName || 'Cửa hàng',
    slug,
  }
}

/** Trang chat shop — tham số `order` mở thẳng chi tiết đơn (hosted / embed). */
export async function guestChatOrderDetailUrl(
  order: PartnerOrderRow,
  meta?: PartnerEmailMeta
): Promise<string | null> {
  const m = meta ?? (await fetchPartnerEmailMeta(order.partner_id))
  if (!m.slug) return null
  const origin = defaultPublicOrigin()
  return `${origin}/messaging/p/${encodeURIComponent(m.slug)}?order=${encodeURIComponent(order.id)}`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Nội dung text + HTML (nút «Xem chi tiết đơn hàng») cho email khách. */
async function customerMailBodyWithOrderCta(
  order: PartnerOrderRow,
  linesBeforeCta: string[],
  meta?: PartnerEmailMeta
): Promise<{ text: string; html: string }> {
  const m = meta ?? (await fetchPartnerEmailMeta(order.partner_id))
  const detailUrl = await guestChatOrderDetailUrl(order, m)
  const baseText = linesBeforeCta.join('\n')
  if (!detailUrl) {
    const html = `<div style="white-space:pre-wrap;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(baseText)}</div>`
    return { text: baseText, html }
  }
  const text =
    baseText +
    '\n\n—\n' +
    `Xem chi tiết đơn hàng (trang chat ${m.displayName}, mục «Đơn hàng»):\n` +
    detailUrl +
    '\n'
  const html = `<div style="white-space:pre-wrap;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(baseText)}</div><p style="margin:16px 0 8px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#111827;">Bấm vào đây để xem chi tiết đơn hàng:</p><p style="margin:0 0 12px;"><a href="${escapeHtml(detailUrl)}" style="display:inline-block;padding:12px 22px;background:#111827;color:#ffffff !important;text-decoration:none;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:600;">Xem chi tiết đơn hàng</a></p><p style="font-size:12px;color:#6b7280;margin:0;font-family:system-ui,sans-serif;">Hoặc mở liên kết: <a href="${escapeHtml(detailUrl)}">${escapeHtml(detailUrl)}</a></p>`
  return { text, html }
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
        ? 'Vui lòng chuyển khoản đúng số tiền và nội dung CK; xác nhận qua SePay — không cần gửi ảnh biên lai.'
        : 'Vui lòng chuyển khoản đúng số tiền và nội dung trong khung «Thanh toán chuyển khoản» trên chat, rồi gửi ảnh biên lai nếu được yêu cầu.'
      : 'Đơn không yêu cầu cọc trước — shop sẽ liên hệ xác nhận và giao hàng.',
    '',
    `Địa chỉ nhận: ${trim(input.order.shipping_address, 500)}`,
    `SĐT: ${trim(input.order.customer_phone, 40)}`,
    '',
    'Trân trọng,',
    shopLabel,
  ]
  if (to) {
    const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
    await sendSmtpMail({ to, subject: subj, text, html })
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
    await sendSmtpMail({ to, subject: subj, text, html })
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
  })
}

export async function emailCustomerShippingStatusChanged(input: {
  order: PartnerOrderRow
}): Promise<void> {
  const meta = await fetchPartnerEmailMeta(input.order.partner_id)
  const shopLabel = meta.displayName
  const to = customerEmailTo(input.order)
  if (!to) return
  const ref = trim(input.order.payment_reference, 64)
  const label = shipVi[input.order.shipping_status] ?? input.order.shipping_status
  const lines = [
    `Xin chào ${trim(input.order.customer_name, 80) || 'quý khách'},`,
    '',
    `Trạng thái giao hàng đơn của bạn: ${label}.`,
    `Mã đơn: ${ref}`,
    `Sản phẩm: ${trim(input.order.product_name, 200)}`,
    '',
    'Bạn có thể xem lại chi tiết trong khung chat hoặc mục «Đơn hàng» trên trang chat.',
    '',
    'Trân trọng,',
    shopLabel,
  ]
  const { text, html } = await customerMailBodyWithOrderCta(input.order, lines, meta)
  await sendSmtpMail({
    to,
    subject: `${shopLabel} — Đơn ${ref} — cập nhật giao hàng: ${label}`,
    text,
    html,
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
  })
}
