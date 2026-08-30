/**
 * Neo đơn shop từ ảnh CK / tra cứu — giữ đến khi khách đổi chủ đề hoặc nói đơn khác.
 * Không khóa hết hội thoại.
 */

import type { Json } from '@/types/database.types'
import {
  customerMessageOpensNewProductSearch,
  customerMessageWantsSimilarCatalogVersusLastConsulted,
  extractExplicitSkuCandidates,
} from '@/lib/messaging/partner-inventory-ai-search'
import { inboundTextLooksLikeAfterSalesNotCheckout } from '@/lib/messaging/partner-ai-purchase-intent'
import { inboundBodyHasCustomerUploadedImage } from '@/lib/messaging/guest-chat-image'
import type { PartnerShippingLookupHit, PartnerShippingLookupOrderItem } from '@/lib/messaging/partner-shipping-lookup'

function looksLikeQuotedSkuConsult(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (!/quan\s*tâm\s*mẫu|interested\s+in\s+this/i.test(t)) return false
  return /["“”'][A-Za-z0-9][A-Za-z0-9._-]{1,24}["“”']|\b[A-Z]{1,3}\d{3,}\b/.test(t)
}

export type PartnerBoundOrderSource = 'bank_transfer_receipt' | 'shipping_lookup' | 'order_image'

export type PartnerBoundOrderSnapshot = {
  order_code: string
  status: string
  status_label: string
  payment_status_label: string
  items: PartnerShippingLookupOrderItem[]
  source: PartnerBoundOrderSource
  bound_at: string
}

const ORDER_CODE_RE = /\b((?:DH|ĐH|DC|ĐC|dh|đh|dc|đc)\s*[-_]?\s*\d{2,})\b/gi
const SEVQR_ORDER_RE = /SEVQR\s*((?:DH|ĐH|DC|ĐC)?\s*[-_]?\s*\d{2,})/i

function locPrefix(uiLocale: string | null | undefined): string {
  return String(uiLocale ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
}

function compactOrderCode(raw: string): string {
  return raw.replace(/[\s_-]+/g, '').toUpperCase().replace(/^ĐH/, 'DH').replace(/^ĐC/, 'DC')
}

export function extractOrderCodesFromText(text: string): string[] {
  const t = String(text ?? '')
  const out: string[] = []
  const add = (raw: string) => {
    let c = compactOrderCode(raw)
    if (/^\d{2,}$/.test(c)) c = `DH${c}`
    if (!/^D[HC]\d{2,}$/.test(c)) return
    if (out.some((x) => x === c)) return
    out.push(c)
  }
  const sev = t.match(SEVQR_ORDER_RE)
  if (sev?.[1]) add(sev[1])
  for (const m of t.matchAll(ORDER_CODE_RE)) {
    if (m[1]) add(m[1])
  }
  return out
}

export function looksLikeBankTransferReceipt(ocrOrCaption: string): boolean {
  const t = String(ocrOrCaption ?? '')
  if (!t.trim()) return false
  const sevqr = /sevqr/i.test(t)
  const success = /giao\s*dịch\s*thành\s*công|giao\s*dich\s*thanh\s*cong|transaction\s+successful/i.test(t)
  const bankApp =
    /vietcombank|vcb\s*digibank|vietinbank|bidv|mbbank|techcombank|tpbank|acb|chuyển\s*khoản|chuyen\s*khoan|nội\s*dung|noi\s*dung/i.test(
      t
    )
  const hasOrder = extractOrderCodesFromText(t).length > 0
  if (sevqr && hasOrder) return true
  if (success && hasOrder && bankApp) return true
  if (success && sevqr) return true
  return false
}

export function inboundTextLooksLikeDepositConfirmAsk(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return /(?:xác\s*nhận|xac\s*nhan).{0,24}(?:cọc|coc)|đã\s*(?:gửi|goi|gởi|gui).{0,24}(?:cọc|coc|giao\s*dịch|giao\s*dich)|(?:đã|da|em)\s*(?:đặt\s*)?cọc|dat\s*coc|đã\s*cọc|em\s*đã\s*cọc/i.test(
    t
  )
}

export function inboundTextLooksLikeBoundOrderVariantFollowUp(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (looksLikeQuotedSkuConsult(t)) return false
  if (/\bcó\s+màu\s+gì|chat\s*liệu|chất\s*liệu|da\s+gì|gót\s+(?:cao|bao)/i.test(t)) return false
  return /(?:đặt|dat|lấy|lay|chọn|chon)\s*(?:màu|mau|size|sz)|(?:màu|mau)\s*(?:đen|den|nâu|nau|trắng|trang|hồng|hong)|em\s+đặt\s+màu/i.test(
    t
  )
}

function skuKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function boundSkuKeys(bound: PartnerBoundOrderSnapshot): string[] {
  return bound.items.map((it) => skuKey(it.product_sku)).filter((k) => k.length >= 2)
}

export function inboundTextSwitchesOffBoundOrder(text: string, bound: PartnerBoundOrderSnapshot): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  /** Ảnh sản phẩm mới — tư vấn theo ảnh, không giữ mã DH cũ. */
  if (inboundBodyHasCustomerUploadedImage(t)) return true
  const codes = extractOrderCodesFromText(t)
  if (codes.some((c) => c !== bound.order_code)) return true
  if (/(?:đơn|don)\s*(?:khác|khac|mới\s*nhất|moi\s*nhat)/i.test(t)) return true
  if (customerMessageOpensNewProductSearch(t)) return true
  if (customerMessageWantsSimilarCatalogVersusLastConsulted(t)) return true
  const skus = extractExplicitSkuCandidates(t)
  const keys = boundSkuKeys(bound)
  if (skus.length > 0 && keys.length > 0) {
    const overlap = skus.some((s) => {
      const k = skuKey(s)
      return keys.some((b) => b === k || b.startsWith(k) || k.startsWith(b))
    })
    if (!overlap && (looksLikeQuotedSkuConsult(t) || /quan\s*tâm\s*mẫu|interested\s+in/i.test(t))) {
      return true
    }
  }
  return false
}

export function inboundTextFollowsBoundOrder(text: string, bound: PartnerBoundOrderSnapshot): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (inboundTextSwitchesOffBoundOrder(t, bound)) return false
  const codes = extractOrderCodesFromText(t)
  if (codes.length > 0 && codes.every((c) => c === bound.order_code)) return true
  if (inboundTextLooksLikeAfterSalesNotCheckout(t)) return true
  if (inboundTextLooksLikeDepositConfirmAsk(t)) return true
  if (inboundTextLooksLikeBoundOrderVariantFollowUp(t)) return true
  return false
}

export function parseBoundOrderSnapshot(raw: Json | null | undefined): PartnerBoundOrderSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = (raw as { bound_order?: unknown }).bound_order
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  const rec = b as Record<string, unknown>
  const orderCode = compactOrderCode(String(rec.order_code ?? ''))
  if (!/^D[HC]\d{2,}$/.test(orderCode)) return null
  const itemsRaw = Array.isArray(rec.items) ? rec.items : []
  const items: PartnerShippingLookupOrderItem[] = []
  for (const it of itemsRaw.slice(0, 8)) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue
    const row = it as Record<string, unknown>
    items.push({
      product_name: String(row.product_name ?? '').trim().slice(0, 160),
      selected_size: String(row.selected_size ?? '').trim().slice(0, 32),
      selected_color_name: String(row.selected_color_name ?? '').trim().slice(0, 48),
      quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
      product_sku: String(row.product_sku ?? '').trim().slice(0, 64),
    })
  }
  const sourceRaw = String(rec.source ?? 'shipping_lookup')
  const source: PartnerBoundOrderSource =
    sourceRaw === 'bank_transfer_receipt' || sourceRaw === 'order_image' ? sourceRaw : 'shipping_lookup'
  return {
    order_code: orderCode,
    status: String(rec.status ?? '').trim().slice(0, 40),
    status_label: String(rec.status_label ?? '').trim().slice(0, 80),
    payment_status_label: String(rec.payment_status_label ?? '').trim().slice(0, 80),
    items,
    source,
    bound_at: String(rec.bound_at ?? '').trim().slice(0, 40),
  }
}

export function findLatestBoundOrderSnapshot(
  lines: Array<{ raw_payload?: Json | null }>
): PartnerBoundOrderSnapshot | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const snap = parseBoundOrderSnapshot(lines[i]?.raw_payload)
    if (snap) return snap
  }
  return null
}

export function snapshotFromShippingHit(
  hit: PartnerShippingLookupHit,
  source: PartnerBoundOrderSource
): PartnerBoundOrderSnapshot | null {
  const orderCode = compactOrderCode(hit.orderCode || '')
  if (!/^D[HC]\d{2,}$/.test(orderCode)) return null
  return {
    order_code: orderCode,
    status: hit.status,
    status_label: hit.statusLabel,
    payment_status_label: hit.paymentStatusLabel,
    items: hit.items.slice(0, 8),
    source,
    bound_at: new Date().toISOString(),
  }
}

export function firstBoundOrderSku(bound: PartnerBoundOrderSnapshot): string {
  for (const it of bound.items) {
    const sku = it.product_sku.trim()
    if (sku) return sku.split(/[/|_]/)[0]?.trim() || sku
  }
  return ''
}

function formatItemsBrief(items: PartnerShippingLookupOrderItem[], loc: string): string {
  if (!items.length) return ''
  const parts = items.map((it) => {
    const sku = it.product_sku ? ` (${it.product_sku.split(/[/|_]/)[0]})` : ''
    const size = it.selected_size ? ` size ${it.selected_size}` : ''
    const color = it.selected_color_name ? `, ${it.selected_color_name}` : ''
    const qty = it.quantity > 1 ? ` x${it.quantity}` : ''
    return `${it.product_name}${sku}${color}${size}${qty}`
  })
  if (loc.startsWith('en')) return `Items: ${parts.join('; ')}.`
  if (loc.startsWith('zh')) return `商品：${parts.join('；')}。`
  if (loc.startsWith('ja')) return `商品：${parts.join('、')}。`
  if (loc.startsWith('ko')) return `상품: ${parts.join('; ')}.`
  return `Sản phẩm: ${parts.join('; ')}.`
}

function amountBit(amountText: string | null | undefined, loc: string): string {
  const a = String(amountText ?? '').trim()
  if (!a) return ''
  if (loc.startsWith('en')) return ` (${a})`
  if (loc.startsWith('zh')) return `（${a}）`
  if (loc.startsWith('ja')) return `（${a}）`
  if (loc.startsWith('ko')) return ` (${a})`
  return ` ${a}`
}

/** Ảnh CK / hỏi xác nhận cọc — xác nhận đã nhận cọc + tóm tắt đơn, không dump «chờ đặt cọc». */
export function formatBoundOrderDepositConfirmReply(
  hit: PartnerShippingLookupHit,
  opts?: { uiLocale?: string | null; amountText?: string | null }
): string {
  const loc = locPrefix(opts?.uiLocale)
  const code = hit.orderCode || 'DH'
  const items = formatItemsBrief(hit.items, loc)
  const amt = amountBit(opts?.amountText, loc)
  if (loc.startsWith('en')) {
    return [
      `We have received the deposit${amt} for order ${code}.`,
      items,
      'The order is with packing / warehouse. Estimated delivery is about 8–12 days (except unusual delays).',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('zh')) {
    return [
      `已收到订单 ${code} 的定金${amt}。`,
      items,
      '订单已转交打包出库，预计约 8–12 天送达（特殊情况除外）。',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('ja')) {
    return [
      `ご注文 ${code} の手付金${amt}を確認しました。`,
      items,
      '梱包・出荷へ回しました。お届け目安は約8〜12日です。',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('ko')) {
    return [
      `주문 ${code} 계약금${amt}을 확인했습니다.`,
      items,
      '포장·출고로 전달했습니다. 수령 예정은 약 8–12일입니다.',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    `Dạ em đã nhận cọc${amt} cho đơn ${code} ạ.`,
    items,
    'Shop đã lên đơn, chuyển bộ phận đóng hàng xuất kho. Dự kiến khoảng 8–12 ngày chị nhận hàng ạ.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Hỏi màu/size trên đơn đang neo — xác nhận biến thể, không kêu Mua ngay. */
export function formatBoundOrderRecapReply(
  hit: PartnerShippingLookupHit,
  opts?: { uiLocale?: string | null }
): string {
  const loc = locPrefix(opts?.uiLocale)
  const code = hit.orderCode || 'DH'
  const items = formatItemsBrief(hit.items, loc)
  if (loc.startsWith('en')) {
    return [`Confirming order ${code}.`, items, 'No need to place a new order.']
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('zh')) {
    return [`确认订单 ${code}。`, items, '无需重新下单。'].filter(Boolean).join('\n')
  }
  if (loc.startsWith('ja')) {
    return [`ご注文 ${code} を確認しました。`, items, '新規のご注文は不要です。']
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('ko')) {
    return [`주문 ${code}을 확인했습니다.`, items, '새로 주문하실 필요 없습니다.']
      .filter(Boolean)
      .join('\n')
  }
  return [
    `Dạ em xác nhận đơn ${code} ạ.`,
    items,
    'Chị không cần đặt lại đơn mới ạ.',
  ]
    .filter(Boolean)
    .join('\n')
}
