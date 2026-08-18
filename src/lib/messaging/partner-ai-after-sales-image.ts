import { GoogleGenerativeAI } from '@google/generative-ai'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import {
  fetchGuestWidgetConversationIdFromPg,
  fetchGuestWidgetMessagesWindowFromPg,
  mergeCustomerCareMessageRawPayloadPatchPg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchPartnerOrdersForConversationFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { inboundTextLooksLikeAfterSalesNotCheckout } from '@/lib/messaging/partner-ai-purchase-intent'
import { extractExplicitSkuCandidates } from '@/lib/messaging/partner-inventory-ai-search'
import {
  formatBoundOrderDepositConfirmReply,
  looksLikeBankTransferReceipt,
  snapshotFromShippingHit,
} from '@/lib/messaging/partner-ai-bound-order'
import {
  extractShippingLookupQuery,
  formatShippingLookupCustomerReply,
  lookupPartnerShippingFromPg,
} from '@/lib/messaging/partner-shipping-lookup'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/** Ảnh 1–6 shop chốt + tư vấn SP (giữ vision). */
export type AfterSalesImageKind =
  | 'shipping_status_notice'
  | 'order_chat_screenshot'
  | 'return_waybill'
  | 'deposit_notice'
  | 'fit_issue_product_photo'
  | 'product_consult'

export type AfterSalesImageDetection = {
  kind: Exclude<AfterSalesImageKind, 'product_consult'>
  ocrText: string
}

const SKU_CONSULT_CAPTION_RE =
  /quan\s*t[aàáảãạâầấẩẫậ]m\s*m[aàáảãạâầấẩẫậ]u\s*n[aàáảãạâầấẩẫậ]y|interested\s+in\s+this\s+(?:item|style|sku)|关注.{0,8}款/i

const ORDER_CODE_RE = /\b(?:DH|ĐH|dh|đh)\s*[-_]?\s*(\d{2,})\b/i
const VNPOST_TRACK_RE = /\b(CL\d{8,}VN)\b/i
const HO_TRACK_RE = /\b(HO\d{6,})\b/i
const AMOUNT_RE = /(\d{1,3}(?:[.,]\d{3}){1,3})\s*(?:đ|d|vnd)?/i

const SIZE_EXCHANGE_RE = new RegExp(
  [
    String.raw`đổi\s*size`,
    String.raw`doi\s*size`,
    String.raw`sai\s*size`,
    String.raw`gửi\s*nhầm`,
    String.raw`gui\s*nham`,
    String.raw`không\s*đúng`,
    String.raw`khong\s*dung`,
    String.raw`ko\s*đúng`,
    String.raw`ko\s*dung`,
    String.raw`không\s*vừa`,
    String.raw`khong\s*vua`,
    String.raw`bị\s*rộng`,
    String.raw`bi\s*rong`,
    String.raw`quá\s*rộng`,
    String.raw`qua\s*rong`,
    String.raw`bị\s*chật`,
    String.raw`bi\s*chat`,
    String.raw`quá\s*chật`,
    String.raw`qua\s*chat`,
    String.raw`rộng\s*(?:quá|qua|muốn|muon|muốn\s*đổi)`,
    String.raw`chật\s*(?:quá|qua|muốn|muon)`,
    String.raw`want\s+to\s+exchange`,
    String.raw`wrong\s+size`,
    String.raw`too\s+(?:big|small|tight|loose)`,
  ].join('|'),
  'i'
)

const FIT_ISSUE_RE =
  /(?:rộng|chật|đổi\s*size|doi\s*size|sai\s*size|không\s*vừa|khong\s*vua|bị\s*rong|quá\s*rong|qua\s*rong|bi\s*chat|qua\s*chat|too\s+(?:big|small|tight|loose))/i

function norm(s: string): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

function locPrefix(uiLocale: string | null | undefined): string {
  return String(uiLocale ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
}

export function captionLooksLikeSkuProductConsult(caption: string): boolean {
  const c = norm(caption)
  if (!c) return false
  if (!SKU_CONSULT_CAPTION_RE.test(c)) return false
  return /["“”'][A-Za-z0-9][A-Za-z0-9._-]{1,24}["“”']|\b[A-Z]{1,3}\d{3,}\b/.test(c)
}

const ORDER_PRODUCT_CONSULT_CAPTION_RE = new RegExp(
  [
    String.raw`(?:áo|ao|quần|quan|túi|tui|giày|giay|váy|vay|đầm|dam|balo|ví|vi)\s*này`,
    String.raw`mẫu\s*này`,
    String.raw`sp\s*này`,
    String.raw`sản\s*phẩm\s*này`,
    String.raw`em\s*muốn\s*mua`,
    String.raw`muốn\s*mua`,
    String.raw`tư\s*vấn`,
    String.raw`tu\s*van`,
    String.raw`đặt\s*(?:áo|mẫu|cái)\s*này`,
    String.raw`this\s+(?:one|item|shirt|jacket|bag)`,
  ].join('|'),
  'i'
)

const TRACKING_ONLY_CAPTION_RE =
  /(?:hàng\s*(?:đâu|gửi|gui)|gửi\s*chưa|gui\s*chua|check\s*đơn|check\s*don|đơn\s*(?:đâu|gửi)|ship\s*(?:đâu|chưa)|tracking|vận\s*đơn)/i

/** Caption kiểu «áo này» / «muốn mua» — ảnh đơn thì tư vấn SKU trong đơn, không dump trạng thái. */
export function captionLooksLikeConsultProductInOrder(caption: string): boolean {
  const c = norm(caption).replace(/^📷\s*/u, '').trim()
  if (!c) return false
  if (TRACKING_ONLY_CAPTION_RE.test(c) && !ORDER_PRODUCT_CONSULT_CAPTION_RE.test(c)) return false
  if (ORDER_PRODUCT_CONSULT_CAPTION_RE.test(c)) return true
  return /^(?:áo|ao|quần|quan|túi|tui|giày|giay|váy|vay|đầm|dam|balo|ví|vi)(?:\s*này)?$/i.test(c)
}

export function afterSalesKindAllowsOrderProductConsult(kind: AfterSalesImageKind): boolean {
  return kind === 'shipping_status_notice' || kind === 'order_chat_screenshot'
}

/** `C0156/XL` → thử cả mã gốc trước dấu `/`. */
export function skuCandidatesFromOrderProductSku(raw: string): string[] {
  const s = String(raw ?? '').trim()
  if (!s) return []
  const out: string[] = []
  const add = (x: string) => {
    const t = x.trim()
    if (!t) return
    if (out.some((y) => y.toLowerCase() === t.toLowerCase())) return
    out.push(t)
  }
  add(s)
  const base = s.split(/[/|_]/)[0]?.trim() ?? ''
  if (base) add(base)
  for (const tok of extractExplicitSkuCandidates(s)) add(tok)
  return out.slice(0, 8)
}

export type OrderProductConsultAnchor = {
  inventoryId: string
  sku: string
  orderCode: string | null
}

async function resolveInventoryFromOrderCodeOnConversation(input: {
  partnerId: string
  conversationId: string
  orderCode: string | null
  lookupText: string
}): Promise<OrderProductConsultAnchor | null> {
  const partnerId = input.partnerId.trim()
  if (!partnerId) return null
  const orderCode = input.orderCode?.trim() || null

  if (orderCode) {
    const orders = await fetchPartnerOrdersForConversationFromPg(partnerId, input.conversationId, 40)
    if (orders?.length) {
      const needle = orderCode.replace(/\s+/g, '').toLowerCase()
      const compact = needle.replace(/^dh/, '')
      const local = orders.find((o) => {
        const blob = `${o.payment_reference} ${o.note} ${o.product_name}`.toLowerCase()
        return blob.includes(needle) || (compact.length >= 2 && blob.includes(compact))
      })
      const invId = local?.product_inventory_id?.trim() ?? ''
      if (invId) {
        const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, invId)
        if (row) {
          return {
            inventoryId: row.id,
            sku: (row.sku ?? '').trim().slice(0, 128),
            orderCode,
          }
        }
      }
    }
  }

  const query =
    extractShippingLookupQuery(input.lookupText, { allowPhone: false }) ||
    (orderCode ? extractShippingLookupQuery(orderCode, { allowPhone: false }) : null)
  if (!query) return null
  try {
    const live = await lookupPartnerShippingFromPg(partnerId, query)
    if (!live?.ok) return null
    const liveOrderCode = live.hit.orderCode?.trim() || orderCode
    for (const it of live.hit.items) {
      const skuBits = [
        ...skuCandidatesFromOrderProductSku(it.product_sku),
        ...extractExplicitSkuCandidates(it.product_name),
      ]
      for (const sku of skuBits) {
        const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
        if (row) {
          return {
            inventoryId: row.id,
            sku: (row.sku ?? sku).trim().slice(0, 128),
            orderCode: liveOrderCode,
          }
        }
      }
    }
  } catch (e) {
    console.warn('[after-sales-image] order product sku lookup', e)
  }
  return null
}

/**
 * Ảnh đơn + caption tư vấn SP («áo này»): neo đúng SKU trong đơn, để job đi nhánh thẻ / một dòng kho.
 */
export async function tryResolveOrderProductConsultFromAfterSalesImage(input: {
  partnerId: string
  conversationId: string
  caption: string
  detection: AfterSalesImageDetection
}): Promise<OrderProductConsultAnchor | null> {
  if (!afterSalesKindAllowsOrderProductConsult(input.detection.kind)) return null
  if (!captionLooksLikeConsultProductInOrder(input.caption)) return null
  const codes = extractAfterSalesCodes(`${input.detection.ocrText}\n${input.caption}`)
  return resolveInventoryFromOrderCodeOnConversation({
    partnerId: input.partnerId,
    conversationId: input.conversationId,
    orderCode: codes.orderCode,
    lookupText: `${input.detection.ocrText}\n${input.caption}`,
  })
}

export function conversationHasSizeExchangeIntent(text: string): boolean {
  return SIZE_EXCHANGE_RE.test(norm(text))
}

export function extractAfterSalesCodes(ocrText: string): {
  orderCode: string | null
  trackingCode: string | null
  amountText: string | null
} {
  const t = String(ocrText ?? '')
  const order = t.match(ORDER_CODE_RE)
  const vnpost = t.match(VNPOST_TRACK_RE)
  const ho = t.match(HO_TRACK_RE)
  const amt = t.match(AMOUNT_RE)
  return {
    orderCode: order ? `DH${order[1]}` : null,
    trackingCode: vnpost?.[1] ?? ho?.[1] ?? null,
    amountText: amt?.[1] ? `${amt[1]}đ` : null,
  }
}

function looksLikeReturnWaybill(ocr: string): boolean {
  const t = ocr.toLowerCase()
  if (VNPOST_TRACK_RE.test(ocr)) return true
  if (/(?:vnpost|bưu\s*điện|buu\s*dien|vietnam\s*post|phiếu\s*gửi|phieu\s*gui)/i.test(ocr)) {
    return /người\s*gửi|nguoi\s*gui|người\s*nhận|nguoi\s*nhan|đã\s*gửi|da\s*gui|ems|ghtk/i.test(ocr)
  }
  return /người\s*gửi/.test(t) && /người\s*nhận/.test(t) && /đã\s*gửi|mã\s*vận/.test(t)
}

function looksLikeShippingStatusNotice(ocr: string): boolean {
  if (/hàng\s*đang\s*được\s*(?:giao|gửi)|hang\s*dang\s*duoc\s*(?:giao|gui)/i.test(ocr)) return true
  if (HO_TRACK_RE.test(ocr) && ORDER_CODE_RE.test(ocr)) return true
  if (ORDER_CODE_RE.test(ocr) && /mã\s*vận\s*đơn|ma\s*van\s*don|tracking/i.test(ocr)) return true
  return /đang\s*(?:được\s*)?(?:giao|gửi)|dang\s*(?:duoc\s*)?(?:giao|gui)/i.test(ocr) && ORDER_CODE_RE.test(ocr)
}

function looksLikeDepositNotice(ocr: string): boolean {
  if (/đã\s*nhận\s*đặt\s*cọc|da\s*nhan\s*dat\s*coc|đã\s*nhận\s*cọc/i.test(ocr)) return true
  if (/đặt\s*cọc|dat\s*coc|đặt cọc/.test(ocr.toLowerCase()) && ORDER_CODE_RE.test(ocr)) return true
  return /xác\s*nhận.{0,24}(?:cọc|coc|thanh\s*toán)|deposit\s+received/i.test(ocr)
}

function looksLikeOrderChatScreenshot(ocr: string): boolean {
  if (/chị\s*đặt\s*áo|chi\s*dat\s*ao|đặt\s*áo\s*trên\s*size/i.test(ocr)) return true
  if (/bạn\s*đang\s*chat\s*với|ban\s*dang\s*chat\s*voi/i.test(ocr) && /size/i.test(ocr)) return true
  return /mua\s*ngay/i.test(ocr) && /tư\s*vấn|tu\s*van/i.test(ocr) && /size/i.test(ocr)
}

/**
 * Phân loại ảnh hậu mãi từ caption + OCR + ngữ cảnh hội thoại.
 * Ưu tiên loại chứng từ (vận đơn / trạng thái / cọc) trước ảnh sản phẩm.
 */
export function classifyAfterSalesImage(input: {
  caption: string
  ocrText: string
  conversationContext: string
}): AfterSalesImageKind {
  const caption = norm(input.caption)
  const ocr = String(input.ocrText ?? '')
  const ctx = String(input.conversationContext ?? '')
  const combined = `${caption}\n${ctx}`

  if (captionLooksLikeSkuProductConsult(caption)) return 'product_consult'

  if (looksLikeBankTransferReceipt(ocr) || looksLikeBankTransferReceipt(caption)) return 'deposit_notice'

  if (looksLikeReturnWaybill(ocr)) return 'return_waybill'
  if (looksLikeShippingStatusNotice(ocr)) return 'shipping_status_notice'
  if (looksLikeDepositNotice(ocr) || looksLikeDepositNotice(caption)) return 'deposit_notice'
  if (looksLikeOrderChatScreenshot(ocr)) return 'order_chat_screenshot'

  if (FIT_ISSUE_RE.test(combined) && !looksLikeShippingStatusNotice(ocr) && !looksLikeDepositNotice(ocr)) {
    return 'fit_issue_product_photo'
  }

  if (
    ORDER_CODE_RE.test(ocr) &&
    /(?:hàng\s*đang|đang\s*(?:được\s*)?(?:giao|gửi)|mã\s*vận|ma\s*van|tracking|in\s*transit)/i.test(ocr)
  ) {
    return 'shipping_status_notice'
  }
  if (inboundTextLooksLikeAfterSalesNotCheckout(combined) && ocr.trim().length >= 40) {
    if (looksLikeReturnWaybill(ocr)) return 'return_waybill'
    if (looksLikeDepositNotice(ocr)) return 'deposit_notice'
    if (looksLikeShippingStatusNotice(ocr) || ORDER_CODE_RE.test(ocr)) return 'shipping_status_notice'
  }

  return 'product_consult'
}

export function shouldOcrGuestImageForAfterSales(caption: string, conversationContext: string): boolean {
  if (captionLooksLikeSkuProductConsult(caption)) return false
  const cap = norm(caption)
  const combined = `${cap}\n${conversationContext}`
  if (inboundTextLooksLikeAfterSalesNotCheckout(combined) || FIT_ISSUE_RE.test(combined)) return true
  if (cap.length <= 24) return true
  if (/\b(?:dh|đh|size|sz|cọc|coc|vận|van\s*đơn)\b/i.test(cap)) return true
  return false
}

function appendReturnAddress(body: string, address: string, uiLocale: string | null | undefined): string {
  const loc = locPrefix(uiLocale)
  const trimmed = address.trim()
  if (trimmed) {
    if (loc.startsWith('en')) return `${body}\n\nReturn / size-exchange address:\n${trimmed}`
    if (loc.startsWith('zh')) return `${body}\n\n退换货收件地址：\n${trimmed}`
    if (loc.startsWith('ja')) return `${body}\n\n返品・サイズ交換の送付先：\n${trimmed}`
    if (loc.startsWith('ko')) return `${body}\n\n반품/사이즈 교환 수령 주소:\n${trimmed}`
    return `${body}\n\nĐịa chỉ nhận hàng hoàn / đổi size:\n${trimmed}`
  }
  if (loc.startsWith('en')) {
    return `${body}\n\nPlease keep the item for now — the shop will send the return address shortly.`
  }
  if (loc.startsWith('zh')) {
    return `${body}\n\n请先保留商品，店铺会马上发送退换货收件地址。`
  }
  if (loc.startsWith('ja')) {
    return `${body}\n\n商品はしばらくお手元に保管ください。店舗から返送先住所をすぐご案内します。`
  }
  if (loc.startsWith('ko')) {
    return `${body}\n\n상품은 잠시 보관해 주세요. 매장에서 반송 주소를 바로 보내 드리겠습니다.`
  }
  return `${body}\n\nChị giữ hàng giúp em, shop sẽ gửi địa chỉ nhận hàng hoàn/đổi size ngay ạ.`
}

function shippingStatusLabel(
  dbStatus: string | null | undefined,
  ocrText: string,
  uiLocale: string | null | undefined
): string {
  const loc = locPrefix(uiLocale)
  const ocr = ocrText.toLowerCase()
  const fromOcrShipping = /đang\s*(?:được\s*)?(?:giao|gửi)|dang\s*(?:duoc\s*)?(?:giao|gui)|in\s*transit|out\s*for\s*delivery/i.test(
    ocr
  )
  const key = fromOcrShipping ? 'shipping' : dbStatus || 'shipping'
  const map: Record<string, Record<string, string>> = {
    vi: {
      pending: 'đơn đang được xác nhận',
      confirmed: 'shop đã xác nhận đơn',
      packing: 'shop đang đóng hàng xuất kho',
      shipping: 'hàng đang được gửi',
      delivered: 'đơn đã giao',
      returned: 'đơn đang hoàn hàng',
      cancelled: 'đơn đã hủy',
    },
    en: {
      pending: 'the order is being confirmed',
      confirmed: 'the shop has confirmed the order',
      packing: 'the shop is packing the order',
      shipping: 'the parcel is on the way',
      delivered: 'the order has been delivered',
      returned: 'the order is being returned',
      cancelled: 'the order was cancelled',
    },
    zh: {
      pending: '订单正在确认',
      confirmed: '店铺已确认订单',
      packing: '店铺正在打包出库',
      shipping: '商品正在配送中',
      delivered: '订单已送达',
      returned: '订单正在退回',
      cancelled: '订单已取消',
    },
    ja: {
      pending: 'ご注文を確認中です',
      confirmed: '店舗がご注文を確認しました',
      packing: '店舗が梱包・出荷準備中です',
      shipping: '商品は発送済みです',
      delivered: 'お届け済みです',
      returned: '返送手続き中です',
      cancelled: 'キャンセル済みです',
    },
    ko: {
      pending: '주문을 확인 중입니다',
      confirmed: '매장이 주문을 확인했습니다',
      packing: '매장이 포장·출고 중입니다',
      shipping: '상품이 배송 중입니다',
      delivered: '배송이 완료되었습니다',
      returned: '반송 처리 중입니다',
      cancelled: '주문이 취소되었습니다',
    },
  }
  const lang = loc.startsWith('en')
    ? 'en'
    : loc.startsWith('zh')
      ? 'zh'
      : loc.startsWith('ja')
        ? 'ja'
        : loc.startsWith('ko')
          ? 'ko'
          : 'vi'
  return map[lang][key] ?? map[lang].shipping
}

export function buildAfterSalesImageReply(input: {
  kind: Exclude<AfterSalesImageKind, 'product_consult'>
  caption: string
  ocrText: string
  conversationContext: string
  uiLocale?: string | null
  returnAddress?: string | null
  localShippingStatus?: string | null
}): string {
  const loc = locPrefix(input.uiLocale)
  const codes = extractAfterSalesCodes(`${input.ocrText}\n${input.caption}`)
  const address = String(input.returnAddress ?? '').trim()
  const wantsExchange = conversationHasSizeExchangeIntent(
    `${input.caption}\n${input.conversationContext}\n${input.ocrText}`
  )
  const orderBit = codes.orderCode ? ` ${codes.orderCode}` : ''
  const trackBit = codes.trackingCode ? codes.trackingCode : ''
  const amountBit = codes.amountText ? ` ${codes.amountText}` : ''
  const status = shippingStatusLabel(input.localShippingStatus, input.ocrText, input.uiLocale)

  if (input.kind === 'shipping_status_notice') {
    if (loc.startsWith('en')) {
      return [
        `Thank you — we received your order screenshot${orderBit ? ` (${codes.orderCode})` : ''}.`,
        `Current status: ${status}. Please rest assured and wait for delivery.`,
        trackBit ? `Tracking code: ${trackBit}.` : '',
        'Message us if you need anything else.',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (loc.startsWith('zh')) {
      return [
        `已收到您的订单截图${orderBit ? `（${codes.orderCode}）` : ''}。`,
        `当前状态：${status}。请放心等待收货。`,
        trackBit ? `运单号：${trackBit}。` : '',
        '如需帮助请再联系我们。',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (loc.startsWith('ja')) {
      return [
        `ご注文のスクリーンショットを確認しました${orderBit ? `（${codes.orderCode}）` : ''}。`,
        `現在の状況：${status}。安心してお待ちください。`,
        trackBit ? `追跡番号：${trackBit}。` : '',
        'ご不明点があればご連絡ください。',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (loc.startsWith('ko')) {
      return [
        `주문 화면을 확인했습니다${orderBit ? ` (${codes.orderCode})` : ''}.`,
        `현재 상태: ${status}. 안심하고 수령을 기다려 주세요.`,
        trackBit ? `운송장 번호: ${trackBit}.` : '',
        '도움이 더 필요하시면 말씀해 주세요.',
      ]
        .filter(Boolean)
        .join('\n')
    }
    return [
      `Dạ em đã nhận ảnh mã đơn${orderBit} ạ.`,
      `Tình trạng hiện tại: ${status}. Chị yên tâm chờ nhận hàng giúp em nhé.`,
      trackBit ? `Mã vận đơn: ${trackBit}.` : '',
      'Nếu cần em hỗ trợ thêm cứ nhắn ạ.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (input.kind === 'return_waybill') {
    if (loc.startsWith('en')) {
      return [
        `We received the return shipment info${trackBit ? ` (${trackBit})` : ''}.`,
        'When the shop receives the parcel, we will message you right away.',
      ].join('\n')
    }
    if (loc.startsWith('zh')) {
      return [
        `已收到您寄回商品的运单信息${trackBit ? `（${trackBit}）` : ''}。`,
        '店铺收到货后会马上通知您。',
      ].join('\n')
    }
    if (loc.startsWith('ja')) {
      return [
        `返送の伝票情報を確認しました${trackBit ? `（${trackBit}）` : ''}。`,
        '店舗が商品を受け取り次第、すぐご連絡します。',
      ].join('\n')
    }
    if (loc.startsWith('ko')) {
      return [
        `반송 운송장 정보를 확인했습니다${trackBit ? ` (${trackBit})` : ''}.`,
        '매장이 상품을 받으면 바로 알려 드리겠습니다.',
      ].join('\n')
    }
    return [
      `Dạ em đã nhận thông tin vận đơn chị gửi hàng hoàn${trackBit ? ` ${trackBit}` : ''} ạ.`,
      'Khi shop nhận được hàng, em sẽ báo lại chị ngay.',
    ].join('\n')
  }

  if (input.kind === 'deposit_notice') {
    if (loc.startsWith('en')) {
      return [
        `Thank you for trusting us with the deposit${orderBit}${amountBit}.`,
        'We have sent the order to packing / warehouse for shipment.',
        'Estimated delivery is about 8–12 days (except unusual delays).',
      ].join('\n')
    }
    if (loc.startsWith('zh')) {
      return [
        `感谢您信任并支付定金${orderBit}${amountBit}。`,
        '订单已转交打包出库部门。',
        '预计约 8–12 天送达（特殊情况除外）。',
      ].join('\n')
    }
    if (loc.startsWith('ja')) {
      return [
        `手付金のご入金ありがとうございます${orderBit}${amountBit}。`,
        'ご注文を梱包・出荷担当へ回しました。',
        'お届け目安は約8〜12日です（イレギュラーを除く）。',
      ].join('\n')
    }
    if (loc.startsWith('ko')) {
      return [
        `계약금을 믿고 맡겨 주셔서 감사합니다${orderBit}${amountBit}.`,
        '주문을 포장·출고 담당으로 전달했습니다.',
        '수령 예정은 약 8–12일입니다(예외 상황 제외).',
      ].join('\n')
    }
    return [
      `Dạ em cảm ơn chị đã tin tưởng đặt cọc${orderBit}${amountBit} ạ.`,
      'Em đã chuyển đơn sang bộ phận đóng hàng xuất kho.',
      'Thời gian dự kiến chị nhận được hàng khoảng 8–12 ngày (trừ trường hợp bất thường).',
    ].join('\n')
  }

  if (input.kind === 'fit_issue_product_photo') {
    const vi = [
      'Dạ em hỗ trợ chị đổi size 1 lần ạ.',
      'Chị vui lòng gửi hàng về shop để em đối chiếu; đúng hàng shop sẽ xử lý đổi size theo quy định hậu mãi.',
    ].join('\n')
    const en = [
      'We can support a one-time size exchange.',
      'Please ship the item back so we can verify it; if it matches, we will process the exchange per after-sales policy.',
    ].join('\n')
    const zh = [
      '我们可以支持一次换码。',
      '请先把商品寄回店铺核对；核对无误后按售后规定办理换码。',
    ].join('\n')
    const ja = [
      'サイズ交換は1回まで対応できます。',
      '商品を店舗へご返送ください。照合でき次第、規定に沿って交換します。',
    ].join('\n')
    const ko = [
      '사이즈 교환은 1회 지원해 드립니다.',
      '상품을 매장으로 보내 주시면 대조 후 규정에 따라 교환 처리하겠습니다.',
    ].join('\n')
    const base = loc.startsWith('en')
      ? en
      : loc.startsWith('zh')
        ? zh
        : loc.startsWith('ja')
          ? ja
          : loc.startsWith('ko')
            ? ko
            : vi
    return appendReturnAddress(base, address, input.uiLocale)
  }

  // order_chat_screenshot
  if (wantsExchange) {
    const vi = [
      'Dạ em thấy chị đã nhắc size M lúc đặt ạ.',
      'Nếu chị muốn đổi size, chị vui lòng gửi hàng về shop để em đối chiếu. Đúng hàng shop sẽ xử lý đổi size theo quy định hậu mãi (đổi size 1 lần).',
    ].join('\n')
    const en = [
      'We can see you originally wanted size M.',
      'If you want a size exchange, please ship the item back for verification. If it matches, we will process a one-time size exchange per policy.',
    ].join('\n')
    const zh = [
      '我们看到您下单时要的是 M 码。',
      '如需换码，请先把商品寄回核对；核对无误后按售后规定办理一次换码。',
    ].join('\n')
    const ja = [
      'ご注文時はサイズMをご希望だった旨を確認しました。',
      'サイズ交換をご希望の場合は商品を店舗へご返送ください。照合でき次第、規定どおり1回交換します。',
    ].join('\n')
    const ko = [
      '주문하실 때 M 사이즈를 원하신 내용을 확인했습니다.',
      '사이즈 교환을 원하시면 상품을 매장으로 보내 주세요. 대조가 맞으면 규정에 따라 1회 교환 처리합니다.',
    ].join('\n')
    const base = loc.startsWith('en')
      ? en
      : loc.startsWith('zh')
        ? zh
        : loc.startsWith('ja')
          ? ja
          : loc.startsWith('ko')
            ? ko
            : vi
    return appendReturnAddress(base, address, input.uiLocale)
  }

  if (loc.startsWith('en')) {
    return 'We received the chat screenshot (size M). If the item was sent wrong or you want a size exchange, tell us and we will guide you to ship it back for verification.'
  }
  if (loc.startsWith('zh')) {
    return '已看到您当时要 M 码的聊天截图。如果发错码或需要换码，请告诉我们，我们会指导您寄回核对。'
  }
  if (loc.startsWith('ja')) {
    return 'サイズMでご注文されたチャット画面を確認しました。誤送やサイズ交換の場合はご連絡ください。返送照合のご案内をします。'
  }
  if (loc.startsWith('ko')) {
    return 'M 사이즈로 주문하신 채팅 화면을 확인했습니다. 잘못 보냈거나 사이즈 교환이 필요하시면 말씀해 주세요. 반송 대조 안내를 드리겠습니다.'
  }
  return 'Dạ em đã xem ảnh ạ. Em ghi nhận chị đặt size M. Nếu hàng gửi chưa đúng hoặc chị muốn đổi size, nhắn em để hướng dẫn gửi hàng về shop đối chiếu và xử lý theo quy định hậu mãi ạ.'
}

async function fetchConversationContextText(
  partnerId: string,
  externalThreadId: string
): Promise<{ conversationId: string | null; context: string }> {
  const conversationId = await fetchGuestWidgetConversationIdFromPg(partnerId, externalThreadId)
  if (!conversationId) return { conversationId: null, context: '' }
  const win = await fetchGuestWidgetMessagesWindowFromPg(conversationId, { limit: 16 })
  if (!win?.rows?.length) return { conversationId, context: '' }
  const context = win.rows
    .slice(-12)
    .map((m) => `${m.direction}: ${String(m.body ?? '').slice(0, 280)}`)
    .join('\n')
  return { conversationId, context }
}

async function ocrImageFullText(imageUrl: string): Promise<string> {
  if (!process.env.GOOGLE_API_KEY?.trim()) return ''
  const resp = await fetch(imageUrl)
  if (!resp.ok) return ''
  const mime = resp.headers.get('content-type')?.trim() || 'image/jpeg'
  const buf = Buffer.from(await resp.arrayBuffer())
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt =
    'Read all visible text in this customer photo or screenshot (Vietnamese or English). Return strict JSON only: {"fullText":"..."}. ' +
    'Include order codes (DH…), tracking codes, amounts, status lines, and chat bubbles. Do not invent text. ' +
    'If it is a product photo with little text, return only the small text you see (e.g. Size L).'
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: buf.toString('base64'), mimeType: mime } },
    ] as never)
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      'gemini-2.5-flash',
      'messaging-after-sales-ocr',
      null
    )
    const raw = result.response
      .text()
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return String(parsed.fullText ?? '').trim().slice(0, 8000)
  } catch {
    return ''
  }
}

async function lookupLocalShippingStatus(
  partnerId: string,
  conversationId: string | null,
  orderCode: string | null
): Promise<string | null> {
  if (!conversationId || !orderCode) return null
  const orders = await fetchPartnerOrdersForConversationFromPg(partnerId, conversationId, 40)
  if (!orders?.length) return null
  const needle = orderCode.replace(/\s+/g, '').toLowerCase()
  const hit = orders.find((o) => {
    const blob = `${o.payment_reference} ${o.note} ${o.product_name}`.toLowerCase()
    return blob.includes(needle) || blob.includes(needle.replace('dh', ''))
  })
  return hit?.shipping_status ?? null
}

/**
 * OCR + ngữ cảnh — gọi **trước** vision search để không dump «chọn 1 mẫu» lên ảnh đơn/vận đơn.
 */
export async function detectAfterSalesGuestImage(input: {
  partnerId: string
  externalThreadId: string
  caption: string
  imagePublicUrl: string
}): Promise<AfterSalesImageDetection | null> {
  const caption = norm(input.caption)
  if (captionLooksLikeSkuProductConsult(caption)) return null
  const { context } = await fetchConversationContextText(input.partnerId, input.externalThreadId)
  let ocrText = ''
  if (shouldOcrGuestImageForAfterSales(caption, context)) {
    ocrText = await ocrImageFullText(input.imagePublicUrl)
  }
  const kind = classifyAfterSalesImage({
    caption,
    ocrText,
    conversationContext: context,
  })
  if (kind === 'product_consult') return null
  return { kind, ocrText }
}

export async function sendAfterSalesGuestImageReply(input: {
  partnerId: string
  conversationId: string
  triggerMessageId: string
  caption: string
  detection: AfterSalesImageDetection
  uiLocale?: string | null
  externalThreadId: string
}): Promise<boolean> {
  const { context } = await fetchConversationContextText(input.partnerId, input.externalThreadId)
  const settings = await fetchMessagingPartnerAiSettingsFullFromPg(input.partnerId)
  const codes = extractAfterSalesCodes(`${input.detection.ocrText}\n${input.caption}`)
  const localShippingStatus = await lookupLocalShippingStatus(
    input.partnerId,
    input.conversationId,
    codes.orderCode
  )
  const isDepositKind = input.detection.kind === 'deposit_notice'
  const isBankReceipt = looksLikeBankTransferReceipt(
    `${input.detection.ocrText}\n${input.caption}`
  )
  const lookupQuery =
    extractShippingLookupQuery(`${input.detection.ocrText}\n${input.caption}`, { allowPhone: false }) ||
    (isDepositKind
      ? null
      : extractShippingLookupQuery(`${input.caption}\n${context}`, { allowPhone: true }))
  let liveBody = ''
  let boundOrderPayload: Record<string, unknown> | null = null
  if (
    lookupQuery &&
    (input.detection.kind === 'shipping_status_notice' ||
      isDepositKind ||
      input.detection.kind === 'return_waybill')
  ) {
    try {
      const live = await lookupPartnerShippingFromPg(input.partnerId, lookupQuery)
      if (live?.ok) {
        const source = isBankReceipt || isDepositKind ? 'bank_transfer_receipt' : 'shipping_lookup'
        const snap = snapshotFromShippingHit(live.hit, source)
        if (snap) boundOrderPayload = snap
        liveBody =
          isDepositKind || isBankReceipt
            ? formatBoundOrderDepositConfirmReply(live.hit, {
                uiLocale: input.uiLocale,
                amountText: codes.amountText,
              })
            : formatShippingLookupCustomerReply(live.hit, input.uiLocale)
      }
    } catch (e) {
      console.warn('[after-sales-image] shipping lookup', e)
    }
  }
  const templateBody = buildAfterSalesImageReply({
    kind: input.detection.kind,
    caption: input.caption,
    ocrText: input.detection.ocrText,
    conversationContext: context,
    uiLocale: input.uiLocale,
    returnAddress: settings?.after_sales_return_address ?? '',
    localShippingStatus,
  })
  const body = liveBody || templateBody
  if (boundOrderPayload && input.triggerMessageId) {
    try {
      await mergeCustomerCareMessageRawPayloadPatchPg(input.triggerMessageId, {
        bound_order: boundOrderPayload,
      })
    } catch (e) {
      console.warn('[after-sales-image] bind order payload', e)
    }
  }
  const ins = await insertMessage({
    conversationId: input.conversationId,
    direction: 'outbound',
    body,
    rawPayload: {
      source: 'guest_after_sales_image_reply',
      after_sales_kind: input.detection.kind,
      trigger_message_id: input.triggerMessageId,
      ...(liveBody ? { shipping_lookup: true } : {}),
      ...(boundOrderPayload ? { bound_order: boundOrderPayload } : {}),
    },
  })
  return !('error' in ins)
}
