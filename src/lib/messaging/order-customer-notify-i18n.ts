import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import type { Json } from '@/types/database.types'
import { DEFAULT_WEB_LOCALE, type WebLocale, normalizeWebLocale } from '@/lib/i18n/config'

type Ship = PartnerOrderRow['shipping_status']

const SHIP: Record<WebLocale, Record<Ship, string>> = {
  vi: {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận đơn',
    packing: 'Đang đóng gói',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao thành công',
    returned: 'Hoàn / trả hàng',
    cancelled: 'Đã hủy (giao hàng)',
  },
  en: {
    pending: 'Pending',
    confirmed: 'Order confirmed',
    packing: 'Packing',
    shipping: 'Out for delivery',
    delivered: 'Delivered',
    returned: 'Returned',
    cancelled: 'Cancelled (shipping)',
  },
  zh: {
    pending: '待处理',
    confirmed: '已确认订单',
    packing: '打包中',
    shipping: '配送中',
    delivered: '已送达',
    returned: '退货/退款',
    cancelled: '已取消（配送）',
  },
  ja: {
    pending: '処理待ち',
    confirmed: '注文確認済み',
    packing: '梱包中',
    shipping: '配送中',
    delivered: '配達完了',
    returned: '返品',
    cancelled: 'キャンセル（配送）',
  },
  ko: {
    pending: '처리 대기',
    confirmed: '주문 확인됨',
    packing: '포장 중',
    shipping: '배송 중',
    delivered: '배송 완료',
    returned: '반품',
    cancelled: '취소(배송)',
  },
}

const MSG: Record<
  WebLocale,
  (ref: string, shipLabel: string, note?: string) => string
> = {
  vi: (ref, shipLabel, note) => {
    const base = `Cập nhật đơn ${ref}: trạng thái giao hàng là «${shipLabel}».`
    if (note?.trim()) return `${base}\n\nGhi chú từ shop: ${note.trim()}`
    return base
  },
  en: (ref, shipLabel, note) => {
    const base = `Order ${ref} update: shipping status is now «${shipLabel}».`
    if (note?.trim()) return `${base}\n\nNote from the shop: ${note.trim()}`
    return base
  },
  zh: (ref, shipLabel, note) => {
    const base = `订单 ${ref} 更新：配送状态为「${shipLabel}」。`
    if (note?.trim()) return `${base}\n\n店铺备注：${note.trim()}`
    return base
  },
  ja: (ref, shipLabel, note) => {
    const base = `ご注文 ${ref} の配送状況が「${shipLabel}」に更新されました。`
    if (note?.trim()) return `${base}\n\n店舗からのメモ：${note.trim()}`
    return base
  },
  ko: (ref, shipLabel, note) => {
    const base = `주문 ${ref} 안내: 배송 상태가 «${shipLabel}»(으)로 변경되었습니다.`
    if (note?.trim()) return `${base}\n\n샵 메모: ${note.trim()}`
    return base
  },
}

export function resolveCustomerNotifyLocaleFromConversationMetadata(metadata: Json | null | undefined): WebLocale {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return DEFAULT_WEB_LOCALE
  const raw = (metadata as Record<string, unknown>).ui_locale
  if (typeof raw !== 'string') return DEFAULT_WEB_LOCALE
  return normalizeWebLocale(raw) ?? DEFAULT_WEB_LOCALE
}

export function formatShippingUpdateChatBodyForCustomer(input: {
  locale: WebLocale
  paymentReference: string
  shippingStatus: Ship
  shopNote?: string
}): string {
  const loc = SHIP[input.locale] ? input.locale : DEFAULT_WEB_LOCALE
  const ref = String(input.paymentReference || '').trim() || '—'
  const label = SHIP[loc][input.shippingStatus] ?? SHIP[DEFAULT_WEB_LOCALE][input.shippingStatus] ?? input.shippingStatus
  return MSG[loc](ref, label, input.shopNote)
}

export function shippingStatusLabelForCustomerEmail(locale: WebLocale, status: Ship): string {
  const loc = SHIP[locale] ? locale : DEFAULT_WEB_LOCALE
  return SHIP[loc][status] ?? SHIP[DEFAULT_WEB_LOCALE][status] ?? status
}

/** Email khách khi đổi trạng thái giao hàng (SMTP) — cùng ngôn ngữ với chat. */
export function formatShippingStatusEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
  shippingStatus: Ship
}): { subject: string; lines: string[] } {
  const loc = SHIP[input.locale] ? input.locale : DEFAULT_WEB_LOCALE
  const name = input.customerName.trim() || (loc === 'vi' ? 'quý khách' : 'there')
  const label = shippingStatusLabelForCustomerEmail(loc, input.shippingStatus)
  const ref = input.paymentRef.trim()
  const sp = input.productName.trim()

  const reviewVi =
    input.shippingStatus === 'delivered'
      ? ['', 'Nếu hài lòng, rất mong bạn dành chút thời gian đánh giá sản phẩm — ý kiến giúp shop phục vụ tốt hơn.']
      : []
  const reviewEn =
    input.shippingStatus === 'delivered'
      ? ['', 'If you are happy with it, a short product review helps the shop serve customers better.']
      : []
  const reviewZh =
    input.shippingStatus === 'delivered' ? ['', '如果满意，欢迎为商品留下评价，帮助店铺改进服务。'] : []
  const reviewJa =
    input.shippingStatus === 'delivered' ? ['', 'ご満足いただけましたら、商品レビューにご協力ください。'] : []
  const reviewKo =
    input.shippingStatus === 'delivered'
      ? ['', '만족하셨다면 상품 리뷰를 남겨 주세요. 샵 서비스 개선에 도움이 됩니다.']
      : []

  if (loc === 'vi') {
    return {
      subject: `${input.shopLabel} — Đơn ${ref} — cập nhật giao hàng: ${label}`,
      lines: [
        `Xin chào ${name},`,
        '',
        `Trạng thái giao hàng đơn của bạn: ${label}.`,
        `Mã đơn: ${ref}`,
        `Sản phẩm: ${sp}`,
        ...reviewVi,
        '',
        'Bạn có thể xem lại chi tiết trong khung chat hoặc mục «Đơn hàng» trên trang chat.',
        '',
        'Trân trọng,',
        input.shopLabel,
      ],
    }
  }
  if (loc === 'en') {
    return {
      subject: `${input.shopLabel} — Order ${ref} — shipping update: ${label}`,
      lines: [
        `Hello ${name},`,
        '',
        `Your shipping status is now: ${label}.`,
        `Order ID: ${ref}`,
        `Product: ${sp}`,
        ...reviewEn,
        '',
        'You can review details in the chat widget or the «My orders» section.',
        '',
        'Best regards,',
        input.shopLabel,
      ],
    }
  }
  if (loc === 'zh') {
    return {
      subject: `${input.shopLabel} — 订单 ${ref} — 配送更新：${label}`,
      lines: [
        `${name}，您好`,
        '',
        `您的配送状态：${label}。`,
        `订单号：${ref}`,
        `商品：${sp}`,
        ...reviewZh,
        '',
        '请在聊天窗口或「我的订单」中查看详情。',
        '',
        '此致',
        input.shopLabel,
      ],
    }
  }
  if (loc === 'ja') {
    return {
      subject: `${input.shopLabel} — ご注文 ${ref} — 配送の更新：${label}`,
      lines: [
        `${name} 様`,
        '',
        `配送状況：${label}`,
        `注文番号：${ref}`,
        `商品：${sp}`,
        ...reviewJa,
        '',
        '詳細はチャットまたは「注文」からご確認ください。',
        '',
        'よろしくお願いいたします。',
        input.shopLabel,
      ],
    }
  }
  return {
    subject: `${input.shopLabel} — 주문 ${ref} — 배송 업데이트: ${label}`,
    lines: [
      `${name}님, 안녕하세요.`,
      '',
      `배송 상태: ${label}`,
      `주문 번호: ${ref}`,
      `상품: ${sp}`,
      ...reviewKo,
      '',
      '채팅 또는 «내 주문»에서 자세히 확인할 수 있습니다.',
      '',
      '감사합니다.',
      input.shopLabel,
    ],
  }
}

export type DepositConfirmedNotifyAmounts = {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
  orderTotalLabel: string
  paidAmountLabel: string
  remainingAmountLabel: string
  remainingAmount: number
  shopNote?: string
}

function depositGuestName(locale: WebLocale, customerName: string): string {
  const name = customerName.trim()
  if (name) return name
  if (locale === 'vi') return 'quý khách'
  if (locale === 'zh') return '客户'
  if (locale === 'ja') return 'お客様'
  if (locale === 'ko') return '고객님'
  return 'there'
}

const PAY: Record<WebLocale, Record<PartnerOrderRow['status'], string>> = {
  vi: {
    awaiting_payment: 'Chờ thanh toán',
    payment_checking: 'Đang kiểm tra thanh toán',
    paid_verified: 'Đã xác nhận thanh toán',
    pending_manual_review: 'Chờ shop duyệt tay',
    cancelled: 'Đã hủy',
  },
  en: {
    awaiting_payment: 'Awaiting payment',
    payment_checking: 'Checking payment',
    paid_verified: 'Payment confirmed',
    pending_manual_review: 'Awaiting shop review',
    cancelled: 'Cancelled',
  },
  zh: {
    awaiting_payment: '待付款',
    payment_checking: '正在核对付款',
    paid_verified: '已确认付款',
    pending_manual_review: '待店铺人工审核',
    cancelled: '已取消',
  },
  ja: {
    awaiting_payment: '支払い待ち',
    payment_checking: '支払い確認中',
    paid_verified: '支払い確認済み',
    pending_manual_review: '店舗確認待ち',
    cancelled: 'キャンセル',
  },
  ko: {
    awaiting_payment: '결제 대기',
    payment_checking: '결제 확인 중',
    paid_verified: '결제 확인됨',
    pending_manual_review: '샵 검토 대기',
    cancelled: '취소됨',
  },
}

function locOf(locale?: string | null): WebLocale {
  return SHIP[normalizeWebLocale(locale ?? '') ?? DEFAULT_WEB_LOCALE]
    ? (normalizeWebLocale(locale ?? '') ?? DEFAULT_WEB_LOCALE)
    : DEFAULT_WEB_LOCALE
}

export function paymentStatusLabelForCustomerEmail(
  locale: WebLocale,
  status: PartnerOrderRow['status']
): string {
  const loc = PAY[locale] ? locale : DEFAULT_WEB_LOCALE
  return PAY[loc][status] ?? PAY[DEFAULT_WEB_LOCALE][status] ?? status
}

export function formatCheckoutSubmittedEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
  quantity: number
  subtotalLabel: string
  requiredAmountLabel: string
  depositPercent: number
  needsDeposit: boolean
  sepayAutoConfirm: boolean
  shippingAddress: string
  customerPhone: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  const depositHint = input.needsDeposit
    ? input.sepayAutoConfirm
      ? loc === 'vi'
        ? `Vui lòng chuyển khoản đúng số tiền và nội dung CK (quét mã QR trong email này hoặc mở đơn nhanh); xác nhận tự động qua hệ thống của ${shop} — không cần gửi ảnh biên lai.`
        : loc === 'zh'
          ? `请按金额与转账备注付款（扫描邮件中的二维码或打开订单）；${shop} 系统会自动确认，无需上传回单。`
          : loc === 'ja'
            ? `金額と振込メモを正確に入力し、メールのQRまたは注文ページからお支払いください。${shop} が自動確認します（領収書の送信は不要）。`
            : loc === 'ko'
              ? `금액과 이체 메모를 정확히 입력한 뒤 메일의 QR 또는 주문을 열어 결제하세요. ${shop} 시스템이 자동 확인하므로 영수증을 보낼 필요가 없습니다.`
              : `Please transfer the exact amount and memo (scan the QR in this email or open the order). ${shop} confirms automatically — no receipt photo needed.`
      : loc === 'vi'
        ? 'Vui lòng chuyển khoản đúng số tiền và nội dung CK. Quét mã QR trong email này hoặc mở đơn nhanh, rồi gửi ảnh biên lai nếu được yêu cầu.'
        : loc === 'zh'
          ? '请按金额与转账备注付款。扫描邮件中的二维码或打开订单；如需请发送回单。'
          : loc === 'ja'
            ? '金額と振込メモを正確に入力してください。メールのQRまたは注文ページから支払い、必要なら領収書を送ってください。'
            : loc === 'ko'
              ? '금액과 이체 메모를 정확히 입력하세요. 메일의 QR 또는 주문을 연 뒤, 요청되면 영수증을 보내 주세요.'
              : 'Please transfer the exact amount and memo. Scan the QR in this email or open the order, then send a receipt if asked.'
    : loc === 'vi'
      ? 'Đơn không yêu cầu cọc trước — shop sẽ liên hệ xác nhận và giao hàng.'
      : loc === 'zh'
        ? '本单无需预付定金 — 店铺会联系确认并安排发货。'
        : loc === 'ja'
          ? 'デポジットは不要です。店舗が確認のうえ発送します。'
          : loc === 'ko'
            ? '계약금이 필요 없습니다. 샵이 확인 후 배송합니다.'
            : 'No deposit is required — the shop will confirm and ship.'
  if (loc === 'vi') {
    return {
      subject: `${shop} — Đơn ${ref} — đã nhận thông tin đặt hàng`,
      lines: [
        `Xin chào ${name},`,
        '',
        `Đơn hàng của bạn đã được ghi nhận tại ${shop}.`,
        `Mã đơn / nội dung CK: ${ref}`,
        `Sản phẩm: ${input.productName}`,
        `Số lượng: ${input.quantity}`,
        `Tổng tiền hàng: ${input.subtotalLabel}`,
        `Số tiền cần đặt cọc trước: ${input.requiredAmountLabel} (${input.depositPercent}% cọc).`,
        '',
        depositHint,
        '',
        `Địa chỉ nhận: ${input.shippingAddress}`,
        `SĐT: ${input.customerPhone}`,
        '',
        'Trân trọng,',
        shop,
      ],
    }
  }
  if (loc === 'zh') {
    return {
      subject: `${shop} — 订单 ${ref} — 已收到下单信息`,
      lines: [
        `${name}，您好`,
        '',
        `您的订单已在 ${shop} 登记。`,
        `订单号 / 转账备注：${ref}`,
        `商品：${input.productName}`,
        `数量：${input.quantity}`,
        `商品合计：${input.subtotalLabel}`,
        `需预付定金：${input.requiredAmountLabel}（${input.depositPercent}%）。`,
        '',
        depositHint,
        '',
        `收货地址：${input.shippingAddress}`,
        `电话：${input.customerPhone}`,
        '',
        '此致',
        shop,
      ],
    }
  }
  if (loc === 'ja') {
    return {
      subject: `${shop} — ご注文 ${ref} — 注文情報を受け付けました`,
      lines: [
        `${name} 様`,
        '',
        `${shop} でご注文を受け付けました。`,
        `注文番号 / 振込メモ：${ref}`,
        `商品：${input.productName}`,
        `数量：${input.quantity}`,
        `商品合計：${input.subtotalLabel}`,
        `デポジット：${input.requiredAmountLabel}（${input.depositPercent}%）。`,
        '',
        depositHint,
        '',
        `お届け先：${input.shippingAddress}`,
        `電話：${input.customerPhone}`,
        '',
        'よろしくお願いいたします。',
        shop,
      ],
    }
  }
  if (loc === 'ko') {
    return {
      subject: `${shop} — 주문 ${ref} — 주문 정보를 받았습니다`,
      lines: [
        `${name}님, 안녕하세요.`,
        '',
        `${shop}에서 주문을 접수했습니다.`,
        `주문 번호 / 이체 메모: ${ref}`,
        `상품: ${input.productName}`,
        `수량: ${input.quantity}`,
        `상품 합계: ${input.subtotalLabel}`,
        `계약금: ${input.requiredAmountLabel} (${input.depositPercent}%).`,
        '',
        depositHint,
        '',
        `배송지: ${input.shippingAddress}`,
        `전화: ${input.customerPhone}`,
        '',
        '감사합니다.',
        shop,
      ],
    }
  }
  return {
    subject: `${shop} — Order ${ref} — we received your order`,
    lines: [
      `Hello ${name},`,
      '',
      `Your order was recorded at ${shop}.`,
      `Order / transfer memo: ${ref}`,
      `Product: ${input.productName}`,
      `Quantity: ${input.quantity}`,
      `Merchandise total: ${input.subtotalLabel}`,
      `Deposit due: ${input.requiredAmountLabel} (${input.depositPercent}%).`,
      '',
      depositHint,
      '',
      `Shipping address: ${input.shippingAddress}`,
      `Phone: ${input.customerPhone}`,
      '',
      'Best regards,',
      shop,
    ],
  }
}

export function formatPaymentStatusEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  status: PartnerOrderRow['status']
  shopNote?: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const label = paymentStatusLabelForCustomerEmail(loc, input.status)
  const note = input.shopNote?.trim()
  if (loc === 'vi') {
    const lines = [
      `Xin chào ${name},`,
      '',
      `Trạng thái thanh toán đơn của bạn: ${label}.`,
      `Mã đơn: ${ref}`,
    ]
    if (note) lines.push(`Ghi chú: ${note}`)
    lines.push('', 'Trân trọng,', input.shopLabel)
    return { subject: `${input.shopLabel} — Đơn ${ref} — cập nhật: ${label}`, lines }
  }
  if (loc === 'zh') {
    const lines = [`${name}，您好`, '', `付款状态：${label}。`, `订单号：${ref}`]
    if (note) lines.push(`备注：${note}`)
    lines.push('', '此致', input.shopLabel)
    return { subject: `${input.shopLabel} — 订单 ${ref} — 更新：${label}`, lines }
  }
  if (loc === 'ja') {
    const lines = [`${name} 様`, '', `支払い状況：${label}`, `注文番号：${ref}`]
    if (note) lines.push(`メモ：${note}`)
    lines.push('', 'よろしくお願いいたします。', input.shopLabel)
    return { subject: `${input.shopLabel} — ご注文 ${ref} — 更新：${label}`, lines }
  }
  if (loc === 'ko') {
    const lines = [`${name}님, 안녕하세요.`, '', `결제 상태: ${label}`, `주문 번호: ${ref}`]
    if (note) lines.push(`메모: ${note}`)
    lines.push('', '감사합니다.', input.shopLabel)
    return { subject: `${input.shopLabel} — 주문 ${ref} — 업데이트: ${label}`, lines }
  }
  const lines = [`Hello ${name},`, '', `Your payment status is now: ${label}.`, `Order ID: ${ref}`]
  if (note) lines.push(`Note: ${note}`)
  lines.push('', 'Best regards,', input.shopLabel)
  return { subject: `${input.shopLabel} — Order ${ref} — update: ${label}`, lines }
}

export function formatPaymentManualReviewEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  if (loc === 'vi') {
    return {
      subject: `${shop} — Đơn ${ref} — đã nhận chứng từ, chờ shop xác nhận`,
      lines: [
        `Xin chào ${name},`,
        '',
        'Chúng tôi đã nhận ảnh/ thông tin thanh toán của bạn. Shop sẽ kiểm tra và phản hồi sớm trong chat.',
        `Mã đơn: ${ref}`,
        '',
        'Trân trọng,',
        shop,
      ],
    }
  }
  if (loc === 'zh') {
    return {
      subject: `${shop} — 订单 ${ref} — 已收到凭证，待店铺确认`,
      lines: [
        `${name}，您好`,
        '',
        '我们已收到您的付款凭证。店铺将尽快在聊天中确认。',
        `订单号：${ref}`,
        '',
        '此致',
        shop,
      ],
    }
  }
  if (loc === 'ja') {
    return {
      subject: `${shop} — ご注文 ${ref} — 証明書を受領、店舗確認待ち`,
      lines: [
        `${name} 様`,
        '',
        'お支払いの証明書を受領しました。店舗がチャットで確認します。',
        `注文番号：${ref}`,
        '',
        'よろしくお願いいたします。',
        shop,
      ],
    }
  }
  if (loc === 'ko') {
    return {
      subject: `${shop} — 주문 ${ref} — 증빙 수령, 샵 확인 대기`,
      lines: [
        `${name}님, 안녕하세요.`,
        '',
        '결제 증빙을 받았습니다. 샵이 채팅으로 곧 확인합니다.',
        `주문 번호: ${ref}`,
        '',
        '감사합니다.',
        shop,
      ],
    }
  }
  return {
    subject: `${shop} — Order ${ref} — receipt received, awaiting shop confirmation`,
    lines: [
      `Hello ${name},`,
      '',
      'We received your payment details. The shop will review and reply in chat soon.',
      `Order ID: ${ref}`,
      '',
      'Best regards,',
      shop,
    ],
  }
}

export function formatOrderCancelledEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
  reason?: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  const reason = input.reason?.trim()
  if (loc === 'vi') {
    const lines = [
      `Xin chào ${name},`,
      '',
      `Đơn ${ref} đã được hủy.`,
      `Sản phẩm: ${input.productName}`,
    ]
    if (reason) lines.push(`Lý do: ${reason}`)
    lines.push('', 'Nếu cần hỗ trợ, hãy nhắn shop trên chat hoặc mục Đơn hàng.', '', 'Trân trọng,', shop)
    return { subject: `${shop} — Đơn ${ref} — đã hủy`, lines }
  }
  if (loc === 'zh') {
    const lines = [`${name}，您好`, '', `订单 ${ref} 已取消。`, `商品：${input.productName}`]
    if (reason) lines.push(`原因：${reason}`)
    lines.push('', '如需帮助，请在聊天或「我的订单」联系店铺。', '', '此致', shop)
    return { subject: `${shop} — 订单 ${ref} — 已取消`, lines }
  }
  if (loc === 'ja') {
    const lines = [`${name} 様`, '', `ご注文 ${ref} はキャンセルされました。`, `商品：${input.productName}`]
    if (reason) lines.push(`理由：${reason}`)
    lines.push('', 'サポートが必要な場合はチャットまたは「注文」からご連絡ください。', '', 'よろしくお願いいたします。', shop)
    return { subject: `${shop} — ご注文 ${ref} — キャンセル`, lines }
  }
  if (loc === 'ko') {
    const lines = [`${name}님, 안녕하세요.`, '', `주문 ${ref}이(가) 취소되었습니다.`, `상품: ${input.productName}`]
    if (reason) lines.push(`사유: ${reason}`)
    lines.push('', '도움이 필요하면 채팅 또는 «내 주문»에서 샵에 문의하세요.', '', '감사합니다.', shop)
    return { subject: `${shop} — 주문 ${ref} — 취소됨`, lines }
  }
  const lines = [`Hello ${name},`, '', `Order ${ref} has been cancelled.`, `Product: ${input.productName}`]
  if (reason) lines.push(`Reason: ${reason}`)
  lines.push('', 'If you need help, message the shop in chat or My orders.', '', 'Best regards,', shop)
  return { subject: `${shop} — Order ${ref} — cancelled`, lines }
}

export function formatOrderRefundedEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
  refundAmountLabel: string
  shopNote?: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  const note = input.shopNote?.trim()
  if (loc === 'vi') {
    const lines = [
      `Xin chào ${name},`,
      '',
      `Shop đã hoàn tiền cho đơn ${ref}.`,
      `Sản phẩm: ${input.productName}`,
      `Số tiền hoàn: ${input.refundAmountLabel}`,
    ]
    if (note) lines.push(`Ghi chú: ${note}`)
    lines.push('', 'Trân trọng,', shop)
    return { subject: `${shop} — Đơn ${ref} — đã hoàn tiền ${input.refundAmountLabel}`, lines }
  }
  if (loc === 'zh') {
    const lines = [
      `${name}，您好`,
      '',
      `店铺已为订单 ${ref} 退款。`,
      `商品：${input.productName}`,
      `退款金额：${input.refundAmountLabel}`,
    ]
    if (note) lines.push(`备注：${note}`)
    lines.push('', '此致', shop)
    return { subject: `${shop} — 订单 ${ref} — 已退款 ${input.refundAmountLabel}`, lines }
  }
  if (loc === 'ja') {
    const lines = [
      `${name} 様`,
      '',
      `ご注文 ${ref} の返金が完了しました。`,
      `商品：${input.productName}`,
      `返金額：${input.refundAmountLabel}`,
    ]
    if (note) lines.push(`メモ：${note}`)
    lines.push('', 'よろしくお願いいたします。', shop)
    return { subject: `${shop} — ご注文 ${ref} — 返金 ${input.refundAmountLabel}`, lines }
  }
  if (loc === 'ko') {
    const lines = [
      `${name}님, 안녕하세요.`,
      '',
      `주문 ${ref} 환불이 완료되었습니다.`,
      `상품: ${input.productName}`,
      `환불 금액: ${input.refundAmountLabel}`,
    ]
    if (note) lines.push(`메모: ${note}`)
    lines.push('', '감사합니다.', shop)
    return { subject: `${shop} — 주문 ${ref} — 환불 ${input.refundAmountLabel}`, lines }
  }
  const lines = [
    `Hello ${name},`,
    '',
    `The shop refunded order ${ref}.`,
    `Product: ${input.productName}`,
    `Refund amount: ${input.refundAmountLabel}`,
  ]
  if (note) lines.push(`Note: ${note}`)
  lines.push('', 'Best regards,', shop)
  return { subject: `${shop} — Order ${ref} — refunded ${input.refundAmountLabel}`, lines }
}

export function formatDepositReminderEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  orderCode: string
  hours: 2 | 20
}): { title: string; detail: string; subject: string; subjectRest: string; text: string } {
  const loc = locOf(input.locale)
  const shop = input.shopLabel.trim() || 'Shop'
  const code = input.orderCode.trim() || (loc === 'en' ? 'order' : 'đơn')
  if (loc === 'vi') {
    const title = `Nhắc đặt cọc sau ${input.hours} giờ`
    const detail = `Đơn ${code} đang chờ đặt cọc. Đây là lời nhắc sau ${input.hours} giờ.`
    const subjectRest = `Nhắc đặt cọc đơn ${code}`
    const text = [
      `Đơn ${code} tại ${shop} đang chờ đặt cọc.`,
      'Vui lòng hoàn tất chuyển khoản để shop xử lý đơn.',
      `Đây là lời nhắc sau ${input.hours} giờ; nếu đã chuyển khoản, bạn có thể bỏ qua email này.`,
      'Quét mã QR trong email này để đặt cọc, hoặc bấm nút mở đơn nhanh.',
    ].join('\n')
    return { title, detail, subject: `${shop} — ${subjectRest}`, subjectRest, text }
  }
  if (loc === 'zh') {
    const title = `${input.hours} 小时后提醒定金`
    const detail = `订单 ${code} 仍待支付定金。这是 ${input.hours} 小时后的提醒。`
    const subjectRest = `提醒支付订单 ${code} 定金`
    const text = [
      `${shop} 的订单 ${code} 仍待支付定金。`,
      '请完成转账以便店铺处理订单。',
      `这是 ${input.hours} 小时后的提醒；若已付款可忽略本邮件。`,
      '请扫描邮件中的二维码，或打开订单完成定金。',
    ].join('\n')
    return { title, detail, subject: `${shop} — ${subjectRest}`, subjectRest, text }
  }
  if (loc === 'ja') {
    const title = `${input.hours}時間後のデポジット案内`
    const detail = `ご注文 ${code} はデポジット待ちです。${input.hours}時間後のリマインダーです。`
    const subjectRest = `ご注文 ${code} のデポジット案内`
    const text = [
      `${shop} のご注文 ${code} はデポジット待ちです。`,
      '店舗が処理できるよう、お振込みをお願いします。',
      `これは ${input.hours} 時間後のご案内です。お支払い済みの場合は無視してください。`,
      'メールのQRをスキャンするか、注文ページからデポジットしてください。',
    ].join('\n')
    return { title, detail, subject: `${shop} — ${subjectRest}`, subjectRest, text }
  }
  if (loc === 'ko') {
    const title = `${input.hours}시간 후 계약금 안내`
    const detail = `주문 ${code}이(가) 계약금을 기다리고 있습니다. ${input.hours}시간 후 알림입니다.`
    const subjectRest = `주문 ${code} 계약금 안내`
    const text = [
      `${shop}의 주문 ${code}이(가) 계약금을 기다리고 있습니다.`,
      '샵이 처리할 수 있도록 이체를 완료해 주세요.',
      `이는 ${input.hours}시간 후 알림입니다. 이미 이체했다면 이 메일을 무시하세요.`,
      '메일의 QR을 스캔하거나 주문을 열어 계약금을 완료하세요.',
    ].join('\n')
    return { title, detail, subject: `${shop} — ${subjectRest}`, subjectRest, text }
  }
  const title = `Deposit reminder after ${input.hours} hours`
  const detail = `Order ${code} is still awaiting a deposit. This is the ${input.hours}-hour reminder.`
  const subjectRest = `Deposit reminder for order ${code}`
  const text = [
    `Order ${code} at ${shop} is still awaiting a deposit.`,
    'Please complete the transfer so the shop can process the order.',
    `This is the ${input.hours}-hour reminder; ignore this email if you already paid.`,
    'Scan the QR in this email or open the order to pay the deposit.',
  ].join('\n')
  return { title, detail, subject: `${shop} — ${subjectRest}`, subjectRest, text }
}

export function formatOrderDeliveredReviewEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  if (loc === 'vi') {
    return {
      subject: `${shop} — Đơn ${ref} — đã giao hàng, mời đánh giá`,
      lines: [
        `Xin chào ${name},`,
        '',
        'Đơn hàng của bạn đã được giao thành công.',
        `Mã đơn: ${ref}`,
        `Sản phẩm: ${input.productName}`,
        '',
        'Nếu hài lòng, rất mong bạn dành chút thời gian đánh giá sản phẩm — ý kiến giúp shop phục vụ tốt hơn.',
        '',
        'Trân trọng,',
        shop,
      ],
    }
  }
  if (loc === 'zh') {
    return {
      subject: `${shop} — 订单 ${ref} — 已送达，欢迎评价`,
      lines: [
        `${name}，您好`,
        '',
        '您的订单已成功送达。',
        `订单号：${ref}`,
        `商品：${input.productName}`,
        '',
        '如果满意，欢迎为商品留下评价，帮助店铺改进服务。',
        '',
        '此致',
        shop,
      ],
    }
  }
  if (loc === 'ja') {
    return {
      subject: `${shop} — ご注文 ${ref} — 配達完了、レビューのお願い`,
      lines: [
        `${name} 様`,
        '',
        'ご注文のお届けが完了しました。',
        `注文番号：${ref}`,
        `商品：${input.productName}`,
        '',
        'ご満足いただけましたら、商品レビューにご協力ください。',
        '',
        'よろしくお願いいたします。',
        shop,
      ],
    }
  }
  if (loc === 'ko') {
    return {
      subject: `${shop} — 주문 ${ref} — 배송 완료, 리뷰 부탁`,
      lines: [
        `${name}님, 안녕하세요.`,
        '',
        '주문이 성공적으로 배송되었습니다.',
        `주문 번호: ${ref}`,
        `상품: ${input.productName}`,
        '',
        '만족하셨다면 상품 리뷰를 남겨 주세요. 샵 서비스 개선에 도움이 됩니다.',
        '',
        '감사합니다.',
        shop,
      ],
    }
  }
  return {
    subject: `${shop} — Order ${ref} — delivered, please review`,
    lines: [
      `Hello ${name},`,
      '',
      'Your order was delivered successfully.',
      `Order ID: ${ref}`,
      `Product: ${input.productName}`,
      '',
      'If you are happy with it, a short product review helps the shop serve customers better.',
      '',
      'Best regards,',
      shop,
    ],
  }
}

export function formatOrderReviewReminderEmailContentForCustomer(input: {
  locale: WebLocale
  shopLabel: string
  customerName: string
  paymentRef: string
  productName: string
}): { subject: string; lines: string[] } {
  const loc = locOf(input.locale)
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const shop = input.shopLabel
  if (loc === 'vi') {
    return {
      subject: `${shop} — Nhắc đánh giá đơn ${ref}`,
      lines: [
        `Xin chào ${name},`,
        '',
        `Bạn đã nhận đơn ${ref} gồm ${input.productName}.`,
        'Nếu chưa đánh giá, bạn có thể chia sẻ trải nghiệm thực tế để giúp khách khác chọn hàng và giúp shop phục vụ tốt hơn.',
        '',
        'Trân trọng,',
        shop,
      ],
    }
  }
  if (loc === 'zh') {
    return {
      subject: `${shop} — 提醒评价订单 ${ref}`,
      lines: [
        `${name}，您好`,
        '',
        `您已收到订单 ${ref}（${input.productName}）。`,
        '如果尚未评价，欢迎分享真实体验，帮助其他顾客和店铺。',
        '',
        '此致',
        shop,
      ],
    }
  }
  if (loc === 'ja') {
    return {
      subject: `${shop} — ご注文 ${ref} のレビューのお願い`,
      lines: [
        `${name} 様`,
        '',
        `ご注文 ${ref}（${input.productName}）はお届け済みです。`,
        'まだレビューがお済みでなければ、実際のご感想をお聞かせください。',
        '',
        'よろしくお願いいたします。',
        shop,
      ],
    }
  }
  if (loc === 'ko') {
    return {
      subject: `${shop} — 주문 ${ref} 리뷰 알림`,
      lines: [
        `${name}님, 안녕하세요.`,
        '',
        `주문 ${ref} (${input.productName})을 받으셨습니다.`,
        '아직 리뷰를 남기지 않으셨다면 실제 사용 경험을 공유해 주세요.',
        '',
        '감사합니다.',
        shop,
      ],
    }
  }
  return {
    subject: `${shop} — Reminder to review order ${ref}`,
    lines: [
      `Hello ${name},`,
      '',
      `You received order ${ref} (${input.productName}).`,
      'If you have not reviewed it yet, please share your experience to help other shoppers and the shop.',
      '',
      'Best regards,',
      shop,
    ],
  }
}

/** Chat + email khi shop xác nhận cọc: số đã cọc và còn thu khi nhận hàng. */
export function formatDepositConfirmedChatBodyForCustomer(input: DepositConfirmedNotifyAmounts): string {
  const loc = SHIP[input.locale] ? input.locale : DEFAULT_WEB_LOCALE
  const ref = input.paymentRef.trim() || '—'
  const remainingHint =
    input.remainingAmount > 0
      ? ''
      : loc === 'vi'
        ? ' (đã thanh toán đủ)'
        : loc === 'zh'
          ? '（已付清）'
          : loc === 'ja'
            ? '（完済）'
            : loc === 'ko'
              ? ' (완납)'
              : ' (paid in full)'
  if (loc === 'vi') {
    const lines = [
      `Shop đã xác nhận đặt cọc cho đơn ${ref}.`,
      `Tổng đơn: ${input.orderTotalLabel}`,
      `Số tiền đã cọc: ${input.paidAmountLabel}`,
      `Số tiền cần thanh toán khi nhận hàng: ${input.remainingAmountLabel}${remainingHint}`,
    ]
    const note = input.shopNote?.trim()
    if (note) lines.push(`Ghi chú từ shop: ${note}`)
    return lines.join('\n')
  }
  if (loc === 'zh') {
    const lines = [
      `店铺已确认订单 ${ref} 的定金。`,
      `订单总额：${input.orderTotalLabel}`,
      `已收定金：${input.paidAmountLabel}`,
      `货到应付：${input.remainingAmountLabel}${remainingHint}`,
    ]
    const note = input.shopNote?.trim()
    if (note) lines.push(`店铺备注：${note}`)
    return lines.join('\n')
  }
  if (loc === 'ja') {
    const lines = [
      `ご注文 ${ref} のデポジットを確認しました。`,
      `合計：${input.orderTotalLabel}`,
      `受領したデポジット：${input.paidAmountLabel}`,
      `受取時の残額：${input.remainingAmountLabel}${remainingHint}`,
    ]
    const note = input.shopNote?.trim()
    if (note) lines.push(`店舗からのメモ：${note}`)
    return lines.join('\n')
  }
  if (loc === 'ko') {
    const lines = [
      `주문 ${ref} 계약금을 확인했습니다.`,
      `주문 합계: ${input.orderTotalLabel}`,
      `받은 계약금: ${input.paidAmountLabel}`,
      `수령 시 잔액: ${input.remainingAmountLabel}${remainingHint}`,
    ]
    const note = input.shopNote?.trim()
    if (note) lines.push(`샵 메모: ${note}`)
    return lines.join('\n')
  }
  const lines = [
    `The shop confirmed the deposit for order ${ref}.`,
    `Order total: ${input.orderTotalLabel}`,
    `Deposit received: ${input.paidAmountLabel}`,
    `Amount due on delivery: ${input.remainingAmountLabel}${remainingHint}`,
  ]
  const note = input.shopNote?.trim()
  if (note) lines.push(`Note from the shop: ${note}`)
  return lines.join('\n')
}

export function formatDepositConfirmedEmailContentForCustomer(
  input: DepositConfirmedNotifyAmounts
): { subject: string; lines: string[] } {
  const loc = SHIP[input.locale] ? input.locale : DEFAULT_WEB_LOCALE
  const name = depositGuestName(loc, input.customerName)
  const ref = input.paymentRef.trim()
  const sp = input.productName.trim()
  const note = input.shopNote?.trim()
  const paidFull = input.remainingAmount <= 0

  if (loc === 'vi') {
    const lines = [
      `Xin chào ${name},`,
      '',
      paidFull
        ? 'Shop đã xác nhận thanh toán đủ cho đơn hàng của bạn.'
        : 'Shop đã xác nhận đặt cọc cho đơn hàng của bạn.',
      `Mã đơn: ${ref}`,
      `Sản phẩm: ${sp}`,
      `Tổng đơn: ${input.orderTotalLabel}`,
      `Số tiền đã cọc: ${input.paidAmountLabel}`,
      paidFull
        ? `Số tiền cần thanh toán khi nhận hàng: ${input.remainingAmountLabel} (đã thanh toán đủ).`
        : `Số tiền cần thanh toán khi nhận hàng: ${input.remainingAmountLabel}`,
      '',
      paidFull
        ? 'Đơn không còn số phải thu khi nhận hàng.'
        : 'Quý khách thanh toán số còn lại khi nhận hàng.',
    ]
    if (note) lines.push('', `Ghi chú từ shop: ${note}`)
    lines.push('', 'Trân trọng,', input.shopLabel)
    return {
      subject: paidFull
        ? `${input.shopLabel} — Đơn ${ref} — đã thanh toán đủ ${input.paidAmountLabel}`
        : `${input.shopLabel} — Đơn ${ref} — đã xác nhận đặt cọc ${input.paidAmountLabel}`,
      lines,
    }
  }
  if (loc === 'zh') {
    const lines = [
      `${name}，您好`,
      '',
      paidFull ? '店铺已确认您的订单已付清。' : '店铺已确认您的订单定金。',
      `订单号：${ref}`,
      `商品：${sp}`,
      `订单总额：${input.orderTotalLabel}`,
      `已收定金：${input.paidAmountLabel}`,
      paidFull
        ? `货到应付：${input.remainingAmountLabel}（已付清）。`
        : `货到应付：${input.remainingAmountLabel}`,
      '',
      paidFull ? '收货时无需再付款。' : '请在收货时支付剩余金额。',
    ]
    if (note) lines.push('', `店铺备注：${note}`)
    lines.push('', '此致', input.shopLabel)
    return {
      subject: paidFull
        ? `${input.shopLabel} — 订单 ${ref} — 已付清 ${input.paidAmountLabel}`
        : `${input.shopLabel} — 订单 ${ref} — 已确认定金 ${input.paidAmountLabel}`,
      lines,
    }
  }
  if (loc === 'ja') {
    const lines = [
      `${name} 様`,
      '',
      paidFull ? 'ご注文の支払い完了を確認しました。' : 'ご注文のデポジットを確認しました。',
      `注文番号：${ref}`,
      `商品：${sp}`,
      `合計：${input.orderTotalLabel}`,
      `受領したデポジット：${input.paidAmountLabel}`,
      paidFull
        ? `受取時の残額：${input.remainingAmountLabel}（完済）。`
        : `受取時の残額：${input.remainingAmountLabel}`,
      '',
      paidFull ? '受取時の追加お支払いはありません。' : '残額は商品受取時にお支払いください。',
    ]
    if (note) lines.push('', `店舗からのメモ：${note}`)
    lines.push('', 'よろしくお願いいたします。', input.shopLabel)
    return {
      subject: paidFull
        ? `${input.shopLabel} — ご注文 ${ref} — 完済 ${input.paidAmountLabel}`
        : `${input.shopLabel} — ご注文 ${ref} — デポジット確認 ${input.paidAmountLabel}`,
      lines,
    }
  }
  if (loc === 'ko') {
    const lines = [
      `${name}님, 안녕하세요.`,
      '',
      paidFull ? '주문이 완납되었음을 확인했습니다.' : '주문 계약금을 확인했습니다.',
      `주문 번호: ${ref}`,
      `상품: ${sp}`,
      `주문 합계: ${input.orderTotalLabel}`,
      `받은 계약금: ${input.paidAmountLabel}`,
      paidFull
        ? `수령 시 잔액: ${input.remainingAmountLabel} (완납).`
        : `수령 시 잔액: ${input.remainingAmountLabel}`,
      '',
      paidFull ? '수령 시 추가로 내실 금액이 없습니다.' : '남은 금액은 수령 시 결제해 주세요.',
    ]
    if (note) lines.push('', `샵 메모: ${note}`)
    lines.push('', '감사합니다.', input.shopLabel)
    return {
      subject: paidFull
        ? `${input.shopLabel} — 주문 ${ref} — 완납 ${input.paidAmountLabel}`
        : `${input.shopLabel} — 주문 ${ref} — 계약금 확인 ${input.paidAmountLabel}`,
      lines,
    }
  }
  const lines = [
    `Hello ${name},`,
    '',
    paidFull
      ? 'The shop confirmed that your order is paid in full.'
      : 'The shop confirmed the deposit for your order.',
    `Order ID: ${ref}`,
    `Product: ${sp}`,
    `Order total: ${input.orderTotalLabel}`,
    `Deposit received: ${input.paidAmountLabel}`,
    paidFull
      ? `Amount due on delivery: ${input.remainingAmountLabel} (paid in full).`
      : `Amount due on delivery: ${input.remainingAmountLabel}`,
    '',
    paidFull
      ? 'Nothing further is due when you receive the order.'
      : 'Please pay the remaining amount when you receive the order.',
  ]
  if (note) lines.push('', `Note from the shop: ${note}`)
  lines.push('', 'Best regards,', input.shopLabel)
  return {
    subject: paidFull
      ? `${input.shopLabel} — Order ${ref} — paid in full ${input.paidAmountLabel}`
      : `${input.shopLabel} — Order ${ref} — deposit confirmed ${input.paidAmountLabel}`,
    lines,
  }
}
