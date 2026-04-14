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

  if (loc === 'vi') {
    return {
      subject: `${input.shopLabel} — Đơn ${ref} — cập nhật giao hàng: ${label}`,
      lines: [
        `Xin chào ${name},`,
        '',
        `Trạng thái giao hàng đơn của bạn: ${label}.`,
        `Mã đơn: ${ref}`,
        `Sản phẩm: ${sp}`,
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
      '',
      '채팅 또는 «내 주문»에서 자세히 확인할 수 있습니다.',
      '',
      '감사합니다.',
      input.shopLabel,
    ],
  }
}
