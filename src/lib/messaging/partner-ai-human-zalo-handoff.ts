import { extractCustomerVnMobiles } from '@/lib/messaging/partner-ai-phone-lead'
import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-message-normalize'

export { HUMAN_ZALO_HANDOFF_SOURCE, humanZaloButtonFromPayload } from '@/lib/messaging/partner-ai-human-zalo-button'
export type { HumanZaloOpenButton } from '@/lib/messaging/partner-ai-human-zalo-button'

export type HumanZaloHandoffReason =
  | 'human_requested'
  | 'checkout_stuck'
  | 'deposit_incomplete'
  | 'order_unreachable'
  | 'spec_needs_human'
  | 'purchase_restated'
  | 'order_lookup_repeated'
  | 'photo_not_similar'

function foldVi(raw: string): string {
  return normalizeCustomerMessageForInventorySearch(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

function shopPuntedToBuyButton(body: string | null): boolean {
  const text = foldVi(body ?? '')
  return /vui long bam/.test(text) && /\bmua\b/.test(text)
}

function shopAskedOrderCode(body: string | null): boolean {
  const text = foldVi(body ?? '')
  return /ma don/.test(text) && /(so dien thoai|\bsdt\b)/.test(text)
}

function priorHasOrderIdentity(priorInbound: string[]): boolean {
  return priorInbound.some((line) => {
    if (extractCustomerVnMobiles(line).length > 0) return true
    const text = foldVi(line)
    return /^(ten|sdt|so dien thoai)\b/.test(text) || /\bsdt\b/.test(text)
  })
}

function currentRetriesOrderIdentity(current: string): boolean {
  if (extractCustomerVnMobiles(current).length > 0) return true
  const text = foldVi(current)
  return /^(ten|sdt|so dien thoai|kiem tra)\b/.test(text) || /da (gui|dua|cho|nhan)/.test(text)
}

function restatesPurchase(current: string): boolean {
  const text = foldVi(current)
  return (
    /(lay|chot|mua)\b.{0,48}(mau|size|co)\b/.test(text) ||
    /mau\s+\S+.{0,24}\bsize\b/.test(text) ||
    /(lay|chot)\s*(di|thoi|nhe|nha)\b/.test(text)
  )
}

/**
 * Tám trường hợp chuyển người shop trên Zalo cá nhân.
 * Size theo đại đa số, khuyến mại và «giao trong ngày» không vào đây.
 */
export function classifyHumanZaloHandoff(input: {
  inbound: string
  priorInbound?: string[]
  lastOutboundBody?: string | null
}): HumanZaloHandoffReason | null {
  const text = foldVi(input.inbound)
  if (!text) return null
  const prior = input.priorInbound ?? []
  const lastOutbound = input.lastOutboundBody ?? null

  if (
    /khong thich.{0,40}(ai|bot|tro ly)/.test(text) ||
    /co nguoi (chat|noi|tu van).{0,30}(khong|ko)\b/.test(text) ||
    /gap nguoi that/.test(text) ||
    /noi chuyen voi nguoi that/.test(text) ||
    /nhan vien (that|truc|tu van)/.test(text)
  ) {
    return 'human_requested'
  }

  if (
    /mua ngay.{0,80}(khong duoc|ko duoc|mai khong|lam mai)/.test(text) ||
    /(thu tuc|dang ky).{0,40}(lang nhang|rac roi|phuc tap|khong lam duoc|ko lam duoc)/.test(text) ||
    /(co tuoi|lon tuoi).{0,50}(khong thao|ko thao)/.test(text) ||
    /(khong|ko) (dat|mua) duoc/.test(text) ||
    /nho (shop )?dat ho/.test(text)
  ) {
    return 'checkout_stuck'
  }

  if (
    /(coc|chuyen khoan).{0,60}(chua hoan thanh|chua xong|chua cap nhat|quen (ghi )?noi dung|app chua)/.test(text) ||
    /quen ghi noi dung/.test(text) ||
    /hoan thanh don/.test(text) ||
    /da coc.{0,40}(chua thay|chua co don)/.test(text)
  ) {
    return 'deposit_incomplete'
  }

  if (
    /lua dao/.test(text) ||
    /(khong|ko|chua) lien lac duoc/.test(text) ||
    /(khong|ko) bat may/.test(text) ||
    /khong nghe may/.test(text) ||
    /(nhan|nt).{0,24}khong tra loi/.test(text) ||
    /khong ai tra loi/.test(text)
  ) {
    return 'order_unreachable'
  }

  const promoOrSameDay = /giam\s*10|khuyen mai|giao trong ngay/.test(text)
  if (
    !promoOrSameDay &&
    (/thanh phan/.test(text) ||
      /do day/.test(text) ||
      /xuat xu|nguon goc|nha san xuat/.test(text) ||
      (/(giu am|chiu lanh).{0,40}(do|nhiet)/.test(text) || /bao nhieu do/.test(text) || /\bam\s*\d+/.test(text)) ||
      /(may|bao nhieu) ngan/.test(text) ||
      /\bgiat\b/.test(text))
  ) {
    return 'spec_needs_human'
  }

  if (shopPuntedToBuyButton(lastOutbound) && restatesPurchase(text)) return 'purchase_restated'

  if (shopAskedOrderCode(lastOutbound) && priorHasOrderIdentity(prior) && currentRetriesOrderIdentity(input.inbound)) {
    return 'order_lookup_repeated'
  }

  if (
    lastOutbound &&
    foldVi(lastOutbound).length > 0 &&
    (/khong giong/.test(text) ||
      /khong co cai nao giong/.test(text) ||
      /mau (minh|em) gui khong co/.test(text))
  ) {
    return 'photo_not_similar'
  }

  return null
}

/** Câu nhắc giờ hành chính kèm link, và chữ trên nút. Nút mở đúng href. */
export function humanZaloHandoffCopy(
  locale: string | null | undefined,
  href: string
): { body: string; buttonLabel: string } {
  const loc = String(locale ?? '').trim().toLowerCase()
  if (loc.startsWith('en')) {
    return {
      body: `Please message the shop on Zalo during business hours so a person can help you directly: ${href}`,
      buttonLabel: 'Message on Zalo',
    }
  }
  if (loc.startsWith('zh')) {
    return {
      body: `请在工作时间通过 Zalo 联系店员，由人直接帮您看：${href}`,
      buttonLabel: '发 Zalo',
    }
  }
  if (loc.startsWith('ja')) {
    return {
      body: `営業時間内にショップの Zalo へメッセージください。担当者が直接ご案内します：${href}`,
      buttonLabel: 'Zaloで連絡',
    }
  }
  if (loc.startsWith('ko')) {
    return {
      body: `영업시간에 샵 Zalo로 메시지 주시면 직원이 직접 안내해 드려요: ${href}`,
      buttonLabel: 'Zalo 문의',
    }
  }
  return {
    body: `Dạ anh/chị nhắn người shop trong giờ hành chính qua Zalo để được tư vấn trực tiếp ạ: ${href}`,
    buttonLabel: 'Nhắn Zalo',
  }
}
