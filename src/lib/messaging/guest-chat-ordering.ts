import { GoogleGenerativeAI } from '@google/generative-ai'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import type { Json } from '@/types/database.types'
import {
  ensureConversationPg,
  fetchCustomerCareConversationByIdPg,
  insertMessagePg,
} from '@/lib/db/customer-care-pg'
import {
  fetchLatestAwaitingPaymentOrderForPartnerThreadFromPg,
  fetchPartnerOrderLinesFromPg,
  fetchPartnerOrderByIdForPartnerFromPg,
  fetchPartnerPaymentSettingsFromPg,
  insertPartnerOrderDraftFromPg,
  insertPartnerOrderEventFromPg,
  insertPartnerPaymentProofFromPg,
  parseVndAmountFromText,
  replacePartnerOrderLinesFromPg,
  syncPrimaryPartnerOrderLineFromOrderFromPg,
  type PartnerOrderRow,
  type PartnerOrderLineRow,
  type PartnerOrderLineUpsertInput,
  type PartnerPaymentSettingsRow,
  updatePartnerOrderCartCheckoutFromPg,
  updatePartnerOrderCheckoutFromPg,
  updatePartnerOrderDepositQuoteFromPg,
  updatePartnerOrderPaymentVerificationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { enrichPaymentDisplayFromQrUrl } from '@/lib/messaging/payment-qr-display-enrich'
import { fetchMessagingPartnersByIdsFromPg, fetchPartnerGoogleCustomerReviewsMerchantIdFromPg } from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerInventoryDefaultForAiFromPg,
  fetchPartnerInventoryPurchaseOptionsByProductUrlFromPg,
  fetchPartnerInventoryRowByProductUrlFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  resolveActiveBirthdayDiscountPercentForCustomer,
  resolveActiveBirthdayDiscountPercentForLinkedUser,
} from '@/lib/db/messaging-partner-birthday-promo-pg'
import {
  recordPromotionUsageFromPg,
  validatePromotionCodeFromPg,
} from '@/lib/db/messaging-partner-promotions-pg'
import { sendPartnerMetaPurchaseCapiOnPaymentConfirmed } from '@/lib/tracking/meta-purchase-after-order'
import { notifyPartnerOwnerNewOrder } from '@/lib/messaging/partner-admin-notifications'
import { guestImageObjectExists } from '@/lib/messaging/guest-chat-image'
import { getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import {
  emailCustomerOrderCheckoutSubmitted,
  emailCustomerOrderPaymentManualReview,
  emailCustomerOrderPaymentVerified,
} from '@/lib/messaging/partner-order-customer-email'
import { buildSepayOrderPaymentReference, buildStablePaymentReference } from '@/lib/messaging/shop-payment-reference'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import {
  fetchPartnerCustomerProfileByEmailFromPg,
  upsertPartnerCustomerProfileByEmailFromPg,
} from '@/lib/db/messaging-partner-customer-profiles-pg'
import {
  resolvePartnerCustomerLoyaltyStatusFromPg,
  type PartnerStackedDiscountSnapshot,
} from '@/lib/db/messaging-partner-loyalty-pg'
import { resolvePartnerCheckoutPriceLinesFromPg } from '@/lib/db/messaging-partner-sale-pricing-pg'
import {
  resolvePartnerSaleDiscountBreakdown,
  type PartnerSaleDiscountBreakdown,
} from '@/lib/partner-website/promotions/partner-sale-pricing'
import { createPartnerAffiliateCommissionForOrderFromPg } from '@/lib/db/messaging-partner-affiliate-pg'
import { guestAccountEmailMatchesAuthUserFromPg } from '@/lib/db/messaging-guest-pg'
import { queuePartnerOrderGoogleSheetsSync } from '@/lib/messaging/partner-order-google-sheets-sync'
import {
  emitPartnerOutboundOrderCreated,
  emitPartnerOutboundPaymentPaid,
} from '@/lib/messaging/partner-outbound-webhook-emit'

const ORDER_THREAD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type WidgetOrderThreadForCheckout = {
  externalThreadId: string
  linkedUserId: string | null
  guestAccountId: string | null
  /** Cùng `x-guest-session-id` khi khách đã đăng nhập Google — đơn tạo lúc ẩn danh. */
  anonymousSessionId?: string | null
}

/** Quyền trên đơn nháp khi `external_thread_id` trên đơn không còn trùng phiên (đổi guest ↔ Google). */
async function assertGuestOwnsPartnerOrderForWidgetCheckout(
  partnerId: string,
  order: PartnerOrderRow,
  thread: WidgetOrderThreadForCheckout
): Promise<boolean> {
  if (order.partner_id !== partnerId) return false
  const lc = (s: string) => s.trim().toLowerCase()
  const tid = lc(thread.externalThreadId)
  const oidEt = lc(order.external_thread_id)
  if (tid && oidEt === tid) return true

  const anon = lc(thread.anonymousSessionId ?? '')
  /** Đơn nháp neo phiên ẩn danh; PATCH dùng `user.id` nhưng header vẫn gửi session. */
  if (anon && oidEt === anon) return true

  const conv = await fetchCustomerCareConversationByIdPg(order.conversation_id)
  if (!conv || conv.partner_id !== partnerId) return false
  const convEt = lc(conv.external_thread_id)
  if (anon && convEt === anon) return true
  if (tid && convEt === tid) return true
  const lid = lc(thread.linkedUserId ?? '')
  if (lid && lc(conv.linked_user_id ?? '') === lid) return true
  const gid = lc(thread.guestAccountId ?? '')
  if (gid) {
    if (lc(conv.guest_account_id ?? '') === gid) return true
    if (convEt === gid) return true
  }
  /** Đơn/hội thoại neo `guest_account` sau merge; PATCH dùng `user.id` (Google) — khớp email tài khoản. */
  if (lid) {
    const gaFromConv = lc(conv.guest_account_id ?? '')
    const gaFromOrder = !gaFromConv && ORDER_THREAD_UUID_RE.test(oidEt) ? oidEt : ''
    const guestId = gaFromConv || gaFromOrder
    if (guestId) {
      const ok = await guestAccountEmailMatchesAuthUserFromPg(partnerId, guestId, lid)
      if (ok) return true
    }
  }
  return false
}

/** Chi tiết đơn trong widget nhúng: chỉ trả khi đơn thuộc phiên/thread hiện tại (cùng logic checkout). */
export async function fetchPartnerOrderDetailForGuestWidgetIfAllowed(
  partnerId: string,
  orderId: string,
  thread: WidgetOrderThreadForCheckout
): Promise<PartnerOrderRow | null> {
  const order = await fetchPartnerOrderByIdForPartnerFromPg(partnerId, orderId)
  if (!order) return null
  const allowed = await assertGuestOwnsPartnerOrderForWidgetCheckout(partnerId, order, thread)
  return allowed ? order : null
}

export type CheckoutFormInput = {
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  color: string
  size: string
  quantity: number
  note: string
  /** URL ảnh màu/mẫu (palette) khách đã chọn — lưu JSON vào DB khi checkout. */
  variantLineImages?: string[]
  /** W1.4 — mã voucher khách tự nhập (tự nhập redeem, khác 188: 188 không có bước này). */
  promoCode?: string
  /** W1.7 — chỉ có ý nghĩa lựa chọn thật khi đơn có cọc (required_amount > 0); mặc định 'cod'. */
  paymentMethod?: 'cod' | 'bank_transfer' | 'ewallet'
}

export type CartCheckoutLineInput = {
  card: PartnerAiProductCard
  color?: string
  size?: string
  quantity?: number
  note?: string
  variantLineImages?: string[]
}

export type CartCheckoutFormInput = Omit<CheckoutFormInput, 'color' | 'size' | 'quantity' | 'variantLineImages'> & {
  lines: CartCheckoutLineInput[]
}

function variantLineImagesToStoredJson(urls: string[] | undefined): string {
  if (!urls?.length) return ''
  const cleaned = urls
    .map((u) => String(u ?? '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 24)
  if (!cleaned.length) return ''
  return JSON.stringify(cleaned).slice(0, 8000)
}

export type RelatedBuyProduct = {
  name: string
  image_url: string
  product_url: string
  price_hint: string
  sku: string | null
  /** UUID dòng kho — gửi Meta «Mua ngay» / AddToCart. */
  inventory_id?: string
}

export type ProductPurchaseOptions = {
  sku: string | null
  name: string
  image_url: string
  product_url: string
  price_hint: string
  sizes: string[]
  colors: Array<{ name: string; img: string }>
  deposit_policy: {
    mode: 'none' | 'percent' | 'fixed_amount'
    percent: number
    fixed_amount: number
  }
  /** W1.7 — hiển thị cho khách trước khi checkout (phí ship, ngưỡng miễn ship, ví điện tử có sẵn không). */
  shipping_policy: {
    fee_amount: number
    free_threshold_amount: number | null
  }
  ewallet_available: boolean
}

function trim(s: string, max = 240): string {
  return String(s || '').trim().slice(0, max)
}

function firstLine(s: string): string {
  return trim(s, 500).replace(/\s+/g, ' ')
}

function toVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n || 0)))}đ`
}

/** W1.7 — dòng phí ship trong tin nhắn xác nhận đơn; rỗng nếu đơn được miễn ship hoặc shop không thu phí. */
function orderShippingFeeSummaryLine(order: PartnerOrderRow): string {
  if (order.shipping_fee_amount <= 0) return ''
  return `Phí vận chuyển: **${toVnd(order.shipping_fee_amount)}**\n`
}

function orderDiscountSummaryLine(order: PartnerOrderRow): string {
  const promoAmount = Math.max(0, order.promo_discount_amount || 0)
  const totalDiscount = order.total_discount_amount + promoAmount
  if (totalDiscount <= 0) return ''
  const parts: string[] = []
  if (order.birthday_discount_amount > 0) {
    parts.push(`sinh nhật ${order.birthday_discount_percent}%`)
  }
  if (order.loyalty_discount_amount > 0) {
    const tier = order.loyalty_tier_name || order.loyalty_tier_code || 'thành viên'
    parts.push(`${tier} ${order.loyalty_discount_percent}%`)
  }
  if (promoAmount > 0) {
    parts.push(`mã ${order.promo_code || 'giảm giá'}`)
  }
  const reason = parts.length > 0 ? ` (${parts.join(' + ')})` : ''
  return `Giảm giá${reason}: **-${toVnd(totalDiscount)}**\n` +
    `Tổng sau giảm: **${toVnd(order.amount_after_discount)}**\n`
}

function clampPercent(v: unknown, fallback = 0): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(fallback)))
  return Math.max(0, Math.min(100, n))
}

function normalizeMoney(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function promotionAccountKey(input: {
  guestAccountId?: string | null
  linkedUserId?: string | null
  fallback?: string | null
}): string | null {
  if (input.linkedUserId) return `user:${input.linkedUserId}`
  if (input.guestAccountId) return `guest:${input.guestAccountId}`
  const fallback = input.fallback?.trim()
  return fallback ? `session:${fallback}` : null
}

function saleBreakdownToLegacySnapshot(input: {
  breakdown: PartnerSaleDiscountBreakdown
  loyaltyTierCode: string
  loyaltyTierName: string
  birthdayPercent: number
  loyaltyPercent: number
}): PartnerStackedDiscountSnapshot {
  const base = Math.max(1, input.breakdown.regularEffectiveSubtotal)
  const nonPromoDiscount =
    input.breakdown.birthdayDiscountAmount + input.breakdown.loyaltyDiscountAmount
  return {
    loyaltyTierCode: input.loyaltyTierCode,
    loyaltyTierName: input.loyaltyTierName,
    loyaltyDiscountPercent:
      input.breakdown.loyaltyDiscountAmount > 0 ? input.loyaltyPercent : 0,
    loyaltyDiscountAmount: input.breakdown.loyaltyDiscountAmount,
    birthdayDiscountPercent:
      input.breakdown.birthdayDiscountAmount > 0 ? input.birthdayPercent : 0,
    birthdayDiscountAmount: input.breakdown.birthdayDiscountAmount,
    totalDiscountPercent: Math.round((nonPromoDiscount * 10000) / base) / 100,
    totalDiscountAmount: nonPromoDiscount,
    amountAfterDiscount: input.breakdown.amountAfterDiscount,
  }
}

function resolveRequiredAmountByDepositRule(input: {
  subtotal: number
  mode: 'none' | 'percent' | 'fixed_amount'
  percent: number
  fixedAmount: number
}): { requiredAmount: number; appliedPercent: number; fallbackApplied: boolean } {
  const subtotal = Math.max(0, Math.round(input.subtotal || 0))
  if (subtotal <= 0) return { requiredAmount: 0, appliedPercent: 0, fallbackApplied: false }
  if (input.mode === 'none') return { requiredAmount: 0, appliedPercent: 0, fallbackApplied: false }
  if (input.mode === 'fixed_amount') {
    const fixed = normalizeMoney(input.fixedAmount)
    if (fixed > subtotal) {
      // Guard requested by user: fallback to 20% if fixed amount exceeds order value.
      return { requiredAmount: Math.ceil(subtotal * 0.2), appliedPercent: 20, fallbackApplied: true }
    }
    const pct = subtotal > 0 ? Math.round((fixed / subtotal) * 100) : 0
    return { requiredAmount: fixed, appliedPercent: clampPercent(pct, 0), fallbackApplied: false }
  }
  const p = clampPercent(input.percent, 30)
  return { requiredAmount: Math.ceil((subtotal * p) / 100), appliedPercent: p, fallbackApplied: false }
}

/**
 * W1.7 — phí ship cố định + miễn phí theo ngưỡng. Tính trên `payableSubtotal` (giá trị sản phẩm
 * SAU giảm giá, TRƯỚC khi cộng ship) — không dùng để tính cọc, chỉ cộng thêm lúc hiển thị tổng
 * cuối cho khách (xem comment trong migration `20260806130000_...` để biết lý do không đổi
 * `amount_after_discount`).
 */
function resolveShippingFeeAmount(
  settings: { shipping_fee_amount: number; shipping_free_threshold_amount: number | null },
  payableSubtotal: number
): number {
  const fee = Math.max(0, Math.round(settings.shipping_fee_amount || 0))
  if (fee <= 0) return 0
  const threshold = settings.shipping_free_threshold_amount
  if (threshold != null && payableSubtotal >= threshold) return 0
  return fee
}

/**
 * W1.7 — phương thức thanh toán khách chọn CHỈ có ý nghĩa khi đơn có cọc (`requiredAmount > 0`);
 * không có cọc thì luôn coi là 'cod' (giữ nguyên hành vi cũ — mọi đơn không cọc đều COD).
 */
function resolvePaymentMethodForCheckout(input: {
  requested: string | undefined
  requiredAmount: number
  ewalletEnabled: boolean
}): 'cod' | 'bank_transfer' | 'ewallet' {
  if (input.requiredAmount <= 0) return 'cod'
  if (input.requested === 'ewallet' && input.ewalletEnabled) return 'ewallet'
  return 'bank_transfer'
}

function inferVietQrBankCodeFromName(rawBankName: string): string {
  const s = String(rawBankName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  const map: Array<[RegExp, string]> = [
    [/vietcombank|vcb/, '970436'],
    /** VietinBank — cả lỗi gõ hay gấp đôi chữ t (viettinbank). */
    [/viettinbank|vietinbank|vietin|icb\b/, '970415'],
    [/bidv/, '970418'],
    [/agribank/, '970405'],
    [/acb|a chau/, '970416'],
    [/tpbank|tien phong/, '970423'],
    [/techcombank|techcom/, '970407'],
    [/mbbank|quan doi|military bank|\bmb\b/, '970422'],
    [/vpbank|viet nam thinh vuong/, '970432'],
    [/sacombank|sai gon thuong tin/, '970403'],
    [/hdbank/, '970437'],
    [/seabank/, '970440'],
    [/shb/, '970443'],
    [/ocb/, '970448'],
  ]
  for (const [re, code] of map) {
    if (re.test(s)) return code
  }
  return ''
}

function deriveUnitPriceFromCard(card: PartnerAiProductCard): number {
  const fromHint = parseVndAmountFromText(card.price_hint ?? '')
  return Math.max(0, fromHint)
}

/** Giá hiển thị sau giảm CMSN (đồng bộ với đơn nháp). */
function applyBirthdayDiscountToPriceHint(priceHint: string, pct: number): string {
  const n = parseVndAmountFromText(priceHint)
  if (n <= 0) return priceHint
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  const d = Math.max(0, Math.round((n * (100 - p)) / 100))
  return `${new Intl.NumberFormat('vi-VN').format(d)}đ`
}

function parseSizeJson(raw: string): string[] {
  const t = String(raw ?? '').trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .slice(0, 50)
  } catch {
    return []
  }
}

/**
 * QR chuyen khoan thong thuong (VietQR image endpoint), chi gom:
 * - STK nhan
 * - So tien
 * - Noi dung chuyen khoan
 */
function buildBasicTransferQrImageUrl(input: {
  bankBin: string
  accountNumber: string
  amount: number
  transferContent: string
  accountHolder: string
}): string {
  const bank = input.bankBin.trim()
  const acc = input.accountNumber.trim()
  const style = 'compact2'
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(acc)}-${style}.png`
  const url = new URL(base)
  url.searchParams.set('amount', String(Math.max(0, Math.round(input.amount || 0))))
  url.searchParams.set('addInfo', input.transferContent.trim())
  if (input.accountHolder.trim()) url.searchParams.set('accountName', input.accountHolder.trim())
  return url.toString()
}

function buildOrderPaymentQrBySettings(input: {
  amount: number
  paymentReference: string
  accountHolder: string
  settings: {
    bank_name: string
    sepay_enabled?: boolean
    sepay_bank_code?: string
    sepay_account_number?: string
    sepay_qr_template?: '' | 'compact' | 'qronly'
    bank_bin: string
    account_number: string
  }
}): string {
  if (
    input.settings.sepay_enabled === true &&
    String(input.settings.sepay_bank_code ?? '').trim() &&
    String(input.settings.sepay_account_number ?? '').trim()
  ) {
    return buildSePayQrImgUrl({
      acc: String(input.settings.sepay_account_number ?? '').trim(),
      bank: String(input.settings.sepay_bank_code ?? '').trim(),
      amount: Math.max(0, Math.round(input.amount || 0)),
      des: input.paymentReference,
      template: input.settings.sepay_qr_template === 'qronly' ? 'qronly' : 'compact',
    })
  }
  const fallbackBankBin = String(input.settings.bank_bin ?? '').trim() || inferVietQrBankCodeFromName(input.settings.bank_name)
  if (!fallbackBankBin) return ''
  return buildBasicTransferQrImageUrl({
    bankBin: fallbackBankBin,
    accountNumber: input.settings.account_number,
    amount: input.amount,
    transferContent: input.paymentReference,
    accountHolder: input.accountHolder,
  })
}

/** STK / ngân hàng hiển thị cho khách — khớp với tài khoản dùng để tạo QR (SePay hoặc VietQR). */
function partnerPaymentDisplayFromSettings(settings: PartnerPaymentSettingsRow): {
  bank_name: string
  account_number: string
  account_holder: string
} {
  const sepayOk =
    settings.sepay_enabled === true &&
    String(settings.sepay_bank_code ?? '').trim() &&
    String(settings.sepay_account_number ?? '').trim()
  if (sepayOk) {
    return {
      bank_name: String(settings.bank_name ?? '').trim() || String(settings.sepay_bank_code ?? '').trim(),
      account_number: String(settings.sepay_account_number ?? '').trim(),
      account_holder: String(settings.account_holder ?? '').trim(),
    }
  }
  return {
    bank_name: String(settings.bank_name ?? '').trim(),
    account_number: String(settings.account_number ?? '').trim(),
    account_holder: String(settings.account_holder ?? '').trim(),
  }
}

/** W1.7 — thông tin ví điện tử hiển thị cho khách, chỉ có khi shop bật + đã cấu hình đủ. */
function partnerEwalletDisplayFromSettings(
  settings: PartnerPaymentSettingsRow
): { provider_label: string; account_name: string; account_number: string; qr_url: string } | null {
  if (!settings.ewallet_enabled) return null
  const qrUrl = String(settings.ewallet_qr_url ?? '').trim()
  if (!qrUrl) return null
  return {
    provider_label: String(settings.ewallet_provider_label ?? '').trim(),
    account_name: String(settings.ewallet_account_name ?? '').trim(),
    account_number: String(settings.ewallet_account_number ?? '').trim(),
    qr_url: qrUrl,
  }
}

type PartnerOrderPaymentDisplay =
  | ({ kind: 'bank' } & { bank_name: string; account_number: string; account_holder: string })
  | ({ kind: 'ewallet' } & { provider_label: string; account_name: string; account_number: string; qr_url: string })

/** W1.7 — chọn hiển thị bank hay ewallet theo `order.payment_method`; null nếu không có cọc. */
function resolveOrderPaymentDisplay(
  order: PartnerOrderRow,
  settings: PartnerPaymentSettingsRow
): PartnerOrderPaymentDisplay | null {
  if (order.required_amount <= 0) return null
  if (order.payment_method === 'ewallet') {
    const ew = partnerEwalletDisplayFromSettings(settings)
    return ew ? { kind: 'ewallet', ...ew } : null
  }
  const bankRaw = partnerPaymentDisplayFromSettings(settings)
  const bank = String(order.payment_qr_url ?? '').trim()
    ? enrichPaymentDisplayFromQrUrl(String(order.payment_qr_url).trim(), bankRaw)
    : bankRaw
  return { kind: 'bank', ...bank }
}

function orderCardPayload(
  order: PartnerOrderRow,
  paymentDisplay: PartnerOrderPaymentDisplay | null,
  lines?: PartnerOrderLineRow[]
): Record<string, unknown> {
  const payableAmount = order.amount_after_discount > 0 ? order.amount_after_discount : order.subtotal_amount
  const remaining = Math.max(0, Math.round(payableAmount - order.required_amount))
  const base: Record<string, unknown> = {
    source: 'system_order',
    order_id: order.id,
    order_status: order.status,
    order_subtotal_amount: order.subtotal_amount,
    order_shipping_fee_amount: order.shipping_fee_amount,
    order_payment_method: order.payment_method,
    order_total_discount_amount: order.total_discount_amount,
    order_amount_after_discount: payableAmount,
    order_loyalty_tier_name: order.loyalty_tier_name,
    order_loyalty_discount_percent: order.loyalty_discount_percent,
    order_birthday_discount_percent: order.birthday_discount_percent,
    order_required_amount: order.required_amount,
    order_remaining_amount: remaining,
    order_payment_timing: order.required_amount <= 0 ? 'pay_on_delivery' : 'pay_now',
    order_deposit_percent: order.deposit_percent,
    order_payment_qr_url: order.payment_qr_url,
    order_payment_reference: order.payment_reference,
    order_product: {
      id: order.product_inventory_id,
      name: order.product_name,
      image_url: order.product_image_url,
      product_url: order.product_url,
      price_hint: String(Math.max(0, Math.round(order.unit_price))),
    },
  }
  const orderLines = (lines ?? []).map((line) => ({
    id: line.id,
    product_inventory_id: line.product_inventory_id,
    product_name: line.product_name,
    product_image_url: line.product_image_url,
    product_url: line.product_url,
    unit_price: line.unit_price,
    quantity: line.quantity,
    line_subtotal: line.line_subtotal,
    variant_color: line.variant_color,
    variant_size: line.variant_size,
  }))
  if (orderLines.length > 0) {
    base.order_items = orderLines
    base.order_item_count = orderLines.length
  }
  if (paymentDisplay && order.required_amount > 0) {
    if (paymentDisplay.kind === 'ewallet') {
      base.order_ewallet_provider_label = paymentDisplay.provider_label
      base.order_ewallet_account_name = paymentDisplay.account_name
      base.order_ewallet_account_number = paymentDisplay.account_number
      base.order_ewallet_qr_url = paymentDisplay.qr_url
    } else {
      base.order_bank_name = paymentDisplay.bank_name
      base.order_bank_account = paymentDisplay.account_number
      base.order_bank_holder = paymentDisplay.account_holder
    }
  }
  return base
}

function toJson(v: Record<string, unknown>): Json {
  return v as unknown as Json
}

export async function createOrderDraftFromProductPick(input: {
  partnerId: string
  externalThreadId: string
  customerName: string
  linkedUserId?: string | null
  guestAccountId?: string | null
  card: PartnerAiProductCard
}): Promise<{ ok: true; order: PartnerOrderRow; conversationId: string } | { error: string }> {
  const conv = await ensureConversationPg({
    partnerId: input.partnerId,
    channel: 'widget',
    externalThreadId: input.externalThreadId,
    customerName: firstLine(input.customerName),
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
    metadata: { source: 'hosted_chat_page', auth_mode: input.guestAccountId ? 'account' : 'anonymous' },
  })
  if (!conv?.conversationId) return { error: 'Không tạo được hội thoại.' }

  const inv = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, input.card.product_url)
  let baseUnit = deriveUnitPriceFromCard(input.card)
  const invHint = inv?.price_hint?.trim()
  if (invHint) {
    const fromInv = parseVndAmountFromText(invHint)
    if (fromInv > 0) baseUnit = fromInv
  }
  const unitPrice = Math.max(0, Math.round(baseUnit))

  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const settingsMode = settings?.default_deposit_mode ?? 'percent'
  const depositPercent = clampPercent(settings?.default_deposit_percent ?? 30, 30)
  const depositAmount = normalizeMoney(settings?.default_deposit_amount ?? 0)
  const subtotal = Math.max(0, Math.round(unitPrice))
  const calc = resolveRequiredAmountByDepositRule({
    subtotal,
    mode: settingsMode,
    percent: depositPercent,
    fixedAmount: depositAmount,
  })
  const draft = await insertPartnerOrderDraftFromPg({
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
    productInventoryId: inv?.id ?? null,
    productName: trim(inv?.name || input.card.name, 180),
    productImageUrl: trim(inv?.image_url || input.card.image_url, 600),
    productUrl: trim(inv?.product_url || input.card.product_url, 600),
    unitPrice,
    depositPercent: calc.appliedPercent,
    requiredAmount: calc.requiredAmount,
    customerEmail: '',
  })
  if (!draft) return { error: 'Không tạo được đơn hàng.' }

  // Do not announce "order created" to customer at draft stage.
  // The order is considered successful only after checkout is submitted.
  await insertPartnerOrderEventFromPg({
    orderId: draft.id,
    eventType: 'order_created',
    title: 'Tạo đơn nháp từ chat',
    detail: `Khách chọn sản phẩm để bắt đầu điền thông tin: ${draft.product_name}`,
    source: 'system',
  })
  return { ok: true, order: draft, conversationId: conv.conversationId }
}

export type GuestOrderCheckoutErrorCode = 'ORDER_NOT_FOUND' | 'ORDER_ACCESS_DENIED'

export async function completeOrderCheckout(input: {
  partnerId: string
  externalThreadId: string
  orderId: string
  form: CheckoutFormInput
  linkedUserId?: string | null
  guestAccountId?: string | null
  anonymousSessionId?: string | null
}): Promise<
  | { ok: true; order: PartnerOrderRow }
  | { error: string; code?: GuestOrderCheckoutErrorCode }
> {
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chưa cài đặt thanh toán.' }

  const oldOrder = await fetchPartnerOrderByIdForPartnerFromPg(input.partnerId, input.orderId)
  if (!oldOrder) return { error: 'Không tìm thấy đơn hàng.', code: 'ORDER_NOT_FOUND' }
  const thread: WidgetOrderThreadForCheckout = {
    externalThreadId: input.externalThreadId,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
    anonymousSessionId: input.anonymousSessionId ?? null,
  }
  const allowed = await assertGuestOwnsPartnerOrderForWidgetCheckout(input.partnerId, oldOrder, thread)
  if (!allowed) {
    return {
      error:
        'Không xác thực được đơn (phiên hoặc tài khoản không khớp). Thử tải lại trang chat hoặc đặt lại từ tin nhắn shop.',
      code: 'ORDER_ACCESS_DENIED',
    }
  }
  if (oldOrder.locked_at) return { error: 'Đơn đã khóa sau khi xác nhận, không thể sửa.' }

  const partnerRow = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const shopDisplayName = String(partnerRow?.[0]?.display_name ?? '').trim()
  const useSepayQr =
    settings.sepay_enabled === true &&
    Boolean(String(settings.sepay_bank_code ?? '').trim()) &&
    Boolean(String(settings.sepay_account_number ?? '').trim())
  const paymentReference = useSepayQr
    ? buildSepayOrderPaymentReference(oldOrder.id, shopDisplayName)
    : buildStablePaymentReference(oldOrder.id, shopDisplayName)
  const qty = Math.max(1, Math.floor(input.form.quantity || 1))
  const identity = {
    emailNormalized: input.form.customerEmail,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
  }
  const [priceLines, bdayPct, loyaltyStatus] = await Promise.all([
    resolvePartnerCheckoutPriceLinesFromPg({
      partnerId: input.partnerId,
      accountKey: promotionAccountKey({
        linkedUserId: input.linkedUserId,
        guestAccountId: input.guestAccountId,
        fallback: input.externalThreadId,
      }),
      visitorEmail: input.form.customerEmail,
      lines: [{
        inventoryId: oldOrder.product_inventory_id,
        quantity: qty,
        fallbackUnitPrice: oldOrder.unit_price,
      }],
    }),
    resolveActiveBirthdayDiscountPercentForCustomer({
      partnerId: input.partnerId,
      linkedUserId: input.linkedUserId ?? null,
      emailNormalized: input.form.customerEmail,
    }),
    resolvePartnerCustomerLoyaltyStatusFromPg({
      partnerId: input.partnerId,
      identity,
    }),
  ])
  const priceLine = priceLines[0]
  const subtotal = (priceLine?.effectiveUnitPrice ?? Math.max(0, oldOrder.unit_price)) * qty
  const listSubtotal = (priceLine?.listUnitPrice ?? Math.max(0, oldOrder.unit_price)) * qty
  const loyaltyPct = loyaltyStatus.enabled
    ? Math.max(0, loyaltyStatus.tier?.discount_percent ?? 0)
    : 0
  let validatedPromo: {
    id: string
    code: string
    requestedDiscountAmount: number
  } | null = null
  const rawPromoCode = (input.form.promoCode ?? '').trim()
  if (rawPromoCode) {
    const cartLinesForPromo = oldOrder.product_inventory_id
      ? [{
          inventoryId: oldOrder.product_inventory_id,
          lineSubtotal: subtotal,
          listLineSubtotal: listSubtotal,
          isClearance: priceLine?.isClearance === true,
        }]
      : []
    const validated = await validatePromotionCodeFromPg({
    partnerId: input.partnerId,
      code: rawPromoCode,
      subtotal,
      cartLines: cartLinesForPromo,
      guestAccountId: input.guestAccountId ?? null,
      linkedUserId: input.linkedUserId ?? null,
      emailNormalized: input.form.customerEmail,
    })
    if (!validated.ok) return { error: `promo_invalid:${validated.error}` }
    validatedPromo = {
      id: validated.promotion.id,
      code: validated.promotion.code,
      requestedDiscountAmount: validated.discountAmount,
    }
  }
  const saleBreakdown = resolvePartnerSaleDiscountBreakdown({
    lines: priceLines,
    voucherDiscountAmount: validatedPromo?.requestedDiscountAmount ?? 0,
    birthdayDiscountPercent: validatedPromo ? 0 : (bdayPct ?? 0),
    loyaltyDiscountPercent: loyaltyPct,
  })
  const appliedPromo = validatedPromo
    ? {
        id: validatedPromo.id,
        code: validatedPromo.code,
        discountAmount: saleBreakdown.voucherDiscountAmount,
      }
    : null
  const finalDiscountSnapshot = saleBreakdownToLegacySnapshot({
    breakdown: saleBreakdown,
    loyaltyTierCode: loyaltyStatus.tier?.tier_code ?? '',
    loyaltyTierName: loyaltyStatus.tier?.tier_name ?? '',
    birthdayPercent: bdayPct ?? 0,
    loyaltyPercent: loyaltyPct,
  })
  const payableSubtotal = saleBreakdown.amountAfterDiscount
  // Deposit is controlled entirely by shop settings; customer cannot override.
  const mode = settings.default_deposit_mode ?? 'percent'
  const percent = clampPercent(settings.default_deposit_percent ?? 30, 30)
  const fixedAmount = normalizeMoney(settings.default_deposit_amount ?? 0)
  const calc = resolveRequiredAmountByDepositRule({
    subtotal: payableSubtotal,
    mode,
    percent,
    fixedAmount,
  })
  const expectedAmount = calc.requiredAmount
  const shippingFeeAmount = resolveShippingFeeAmount(settings, payableSubtotal)
  const paymentMethod = resolvePaymentMethodForCheckout({
    requested: input.form.paymentMethod,
    requiredAmount: expectedAmount,
    ewalletEnabled: settings.ewallet_enabled,
  })
  let qrUrl = ''
  if (expectedAmount > 0) {
    if (paymentMethod === 'ewallet') {
      qrUrl = String(settings.ewallet_qr_url ?? '').trim()
      if (!qrUrl) return { error: 'Shop chưa cài đặt QR ví điện tử.' }
    } else {
      if (!useSepayQr) {
        const effectiveBankBin =
          String(settings.bank_bin ?? '').trim() || inferVietQrBankCodeFromName(settings.bank_name ?? '')
        if (!String(settings.account_number ?? '').trim() || !effectiveBankBin) {
          return { error: 'Shop chưa cài đặt thông tin ngân hàng nhận cọc.' }
        }
      }
      qrUrl = buildOrderPaymentQrBySettings({
        amount: expectedAmount,
        paymentReference,
        accountHolder: settings.account_holder,
        settings: {
          sepay_enabled: settings.sepay_enabled,
          sepay_bank_code: settings.sepay_bank_code,
          sepay_account_number: settings.sepay_account_number,
          sepay_qr_template: settings.sepay_qr_template,
          bank_name: settings.bank_name,
          bank_bin: settings.bank_bin,
          account_number: settings.account_number,
        },
      })
      if (!qrUrl) return { error: 'Chưa xác định được mã ngân hàng để tạo QR. Vui lòng kiểm tra tên ngân hàng.' }
    }
  }

  const updated = await updatePartnerOrderCheckoutFromPg({
    orderId: oldOrder.id,
    partnerId: input.partnerId,
    conversationId: oldOrder.conversation_id,
    externalThreadId: oldOrder.external_thread_id,
    customerName: trim(input.form.customerName, 120),
    customerEmail: trim(input.form.customerEmail, 180),
    customerPhone: trim(input.form.customerPhone, 40),
    shippingAddress: trim(input.form.shippingAddress, 280),
    variantColor: trim(input.form.color, 2000),
    variantSize: trim(input.form.size, 2000),
    variantImageUrlsJson: variantLineImagesToStoredJson(input.form.variantLineImages),
    quantity: qty,
    unitPrice: priceLine?.effectiveUnitPrice ?? oldOrder.unit_price,
    note: trim(input.form.note, 800),
    depositPercent: calc.appliedPercent,
    requiredAmount: calc.requiredAmount,
    paymentReference,
    paymentQrUrl: qrUrl,
    discountSnapshot: finalDiscountSnapshot,
    saleBreakdown,
    promo: appliedPromo,
    paymentMethod,
    shippingFeeAmount,
  })
  if (!updated) return { error: 'Không cập nhật được đơn hàng.' }
  if (appliedPromo) {
    await recordPromotionUsageFromPg({
      partnerId: input.partnerId,
      promotionId: appliedPromo.id,
      orderId: updated.id,
      discountAmount: appliedPromo.discountAmount,
      guestAccountId: input.guestAccountId ?? null,
      linkedUserId: input.linkedUserId ?? null,
    })
  }
  await createPartnerAffiliateCommissionForOrderFromPg({
    partnerId: input.partnerId,
    orderId: updated.id,
    accountKey: promotionAccountKey({
      linkedUserId: input.linkedUserId,
      guestAccountId: input.guestAccountId,
      fallback: input.externalThreadId,
    }),
    amountAfterDiscount: updated.amount_after_discount,
  })
  await syncPrimaryPartnerOrderLineFromOrderFromPg(updated)
  const updatedLines = await fetchPartnerOrderLinesFromPg(updated.id)
  const em = trim(input.form.customerEmail, 180).toLowerCase()
  if (em) {
    await upsertPartnerCustomerProfileByEmailFromPg({
      partnerId: input.partnerId,
      emailNormalized: em,
      emailRaw: input.form.customerEmail,
      customerName: trim(input.form.customerName, 120),
      customerPhone: trim(input.form.customerPhone, 40),
      shippingAddress: trim(input.form.shippingAddress, 280),
    })
  }

  const paymentDisplay = resolveOrderPaymentDisplay(updated, settings)
  await insertMessagePg({
    conversationId: oldOrder.conversation_id,
    direction: 'outbound',
    body:
      updated.required_amount > 0
        ? `Đơn hàng đã được tạo thành công.\n` +
          `Tổng đơn: **${toVnd(updated.subtotal_amount)}**\n` +
          orderDiscountSummaryLine(updated) +
          orderShippingFeeSummaryLine(updated) +
          `Cần đặt cọc trước: **${toVnd(updated.required_amount)}** (${updated.deposit_percent}%).\n` +
          `Còn thanh toán khi nhận hàng: **${toVnd(Math.max(0, updated.amount_after_discount - updated.required_amount) + updated.shipping_fee_amount)}**.\n` +
          `${calc.fallbackApplied ? 'Lưu ý: Số tiền đặt cọc vượt giá trị đơn, hệ thống đã fallback về 20% giá trị đơn.\n' : ''}` +
          (updated.payment_method === 'ewallet'
            ? `Quét QR ví điện tử trong khối «Thanh toán» bên dưới, sau đó bấm nút gửi ảnh biên lai.`
            : useSepayQr
              ? `STK, nội dung chuyển khoản và QR nằm trong khối «Thanh toán chuyển khoản» bên dưới (có nút sao chép từng mục).\nSau khi chuyển khoản đúng số tiền và nội dung CK: hệ thống của ${shopDisplayName || 'shop'} xác nhận tự động — không cần gửi ảnh biên lai.`
              : `STK, nội dung chuyển khoản và QR nằm trong khối «Thanh toán chuyển khoản» bên dưới (có nút sao chép từng mục).\nSau khi chuyển khoản: bấm nút gửi ảnh biên lai ngay dưới mã QR.`)
        : `Đơn hàng đã được tạo thành công.\n` +
          `Tổng đơn: **${toVnd(updated.subtotal_amount)}**\n` +
          orderDiscountSummaryLine(updated) +
          orderShippingFeeSummaryLine(updated) +
          `Thanh toán trước: **0đ**.\n` +
          `Thanh toán khi nhận hàng: **${toVnd(updated.amount_after_discount + updated.shipping_fee_amount)}**.\n` +
          `Đơn này không yêu cầu đặt cọc trước. Shop sẽ liên hệ xác nhận đơn và giao hàng.`,
    rawPayload: toJson(orderCardPayload(updated, paymentDisplay, updatedLines)),
  })
  await insertPartnerOrderEventFromPg({
    orderId: updated.id,
    eventType: 'checkout_submitted',
    title: 'Khách gửi thông tin nhận hàng',
    detail: `Số lượng ${updated.quantity}, cần đặt cọc trước ${toVnd(updated.required_amount)}.`,
    source: 'customer',
  })
  try {
    await emailCustomerOrderCheckoutSubmitted({
      order: updated,
      shopNotifyEmail: settings.notify_email || '',
    })
  } catch (e) {
    console.warn('[completeOrderCheckout] email', e)
  }
  queuePartnerOrderGoogleSheetsSync(input.partnerId, updated.id)
  emitPartnerOutboundOrderCreated(input.partnerId, updated)
  notifyPartnerOwnerNewOrder(input.partnerId, updated).catch((e) =>
    console.warn('[completeOrderCheckout] notify owner', e)
  )
  return { ok: true, order: updated }
}

async function cartInputLineToOrderLine(input: {
  partnerId: string
  linkedUserId?: string | null
  line: CartCheckoutLineInput
  sortOrder: number
}): Promise<PartnerOrderLineUpsertInput | null> {
  const productUrl = trim(input.line.card.product_url, 600)
  if (!/^https?:\/\//i.test(productUrl)) return null
  const inv = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, productUrl)
  let baseUnit = deriveUnitPriceFromCard(input.line.card)
  const invHint = inv?.price_hint?.trim()
  if (invHint) {
    const fromInv = parseVndAmountFromText(invHint)
    if (fromInv > 0) baseUnit = fromInv
  }
  // W1.4 — flash sale price wins when window active (backend recalculates; do not trust client).
  if (inv) {
    const { resolvePartnerEffectiveUnitPrice } = await import(
      '@/lib/partner-website/shop/partner-shop-flash-sale'
    )
    const saleUnit = resolvePartnerEffectiveUnitPrice({
      priceAmount: inv.price_amount,
      salePriceAmount: inv.sale_price_amount ?? null,
      saleStartsAt: inv.sale_starts_at ?? null,
      saleEndsAt: inv.sale_ends_at ?? null,
    })
    if (saleUnit != null && saleUnit >= 0) baseUnit = saleUnit
  }
  const unitPrice = Math.max(0, Math.round(baseUnit))
  const variantImageUrlsJson = variantLineImagesToStoredJson(input.line.variantLineImages)
  const firstVariantImage = input.line.variantLineImages?.find((u) => /^https?:\/\//i.test(String(u ?? '').trim()))
  return {
    productInventoryId: inv?.id ?? input.line.card.inventory_id ?? null,
    productName: trim(inv?.name || input.line.card.name, 180),
    productImageUrl: trim(firstVariantImage || inv?.image_url || input.line.card.image_url, 600),
    productUrl: trim(inv?.product_url || productUrl, 600),
    unitPrice,
    quantity: Math.max(1, Math.min(99, Math.floor(Number(input.line.quantity) || 1))),
    variantColor: trim(input.line.color ?? '', 2000),
    variantSize: trim(input.line.size ?? '', 2000),
    variantImageUrlsJson,
    note: trim(input.line.note ?? '', 800),
    sortOrder: input.sortOrder,
  }
}

export async function completeCartCheckout(input: {
  partnerId: string
  externalThreadId: string
  customerName: string
  form: CartCheckoutFormInput
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<{ ok: true; order: PartnerOrderRow } | { error: string }> {
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chưa cài đặt thanh toán.' }

  const conv = await ensureConversationPg({
    partnerId: input.partnerId,
    channel: 'widget',
    externalThreadId: input.externalThreadId,
    customerName: firstLine(input.customerName || input.form.customerEmail || 'Guest'),
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
    metadata: { source: 'hosted_chat_page', auth_mode: input.guestAccountId ? 'account' : 'anonymous' },
  })
  if (!conv?.conversationId) return { error: 'Không tạo được hội thoại.' }

  const lines: PartnerOrderLineUpsertInput[] = []
  for (const line of input.form.lines.slice(0, 20)) {
    const mapped = await cartInputLineToOrderLine({
      partnerId: input.partnerId,
      linkedUserId: input.linkedUserId ?? null,
      line,
      sortOrder: lines.length,
    })
    if (mapped) lines.push(mapped)
  }
  if (lines.length === 0) return { error: 'Giỏ hàng chưa có sản phẩm hợp lệ.' }

  const identity = {
    emailNormalized: input.form.customerEmail,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
  }
  const [priceLines, bdayPct, loyaltyStatus] = await Promise.all([
    resolvePartnerCheckoutPriceLinesFromPg({
      partnerId: input.partnerId,
      accountKey: promotionAccountKey({
        linkedUserId: input.linkedUserId,
        guestAccountId: input.guestAccountId,
        fallback: input.externalThreadId,
      }),
      visitorEmail: input.form.customerEmail,
      lines: lines.map((line) => ({
        inventoryId: line.productInventoryId,
        quantity: line.quantity,
        fallbackUnitPrice: line.unitPrice,
      })),
    }),
    resolveActiveBirthdayDiscountPercentForCustomer({
      partnerId: input.partnerId,
      linkedUserId: input.linkedUserId ?? null,
      emailNormalized: input.form.customerEmail,
    }),
    resolvePartnerCustomerLoyaltyStatusFromPg({
    partnerId: input.partnerId,
      identity,
    }),
  ])
  priceLines.forEach((priceLine, index) => {
    if (lines[index]) lines[index].unitPrice = priceLine.effectiveUnitPrice
  })
  const subtotal = priceLines.reduce(
    (sum, line) => sum + line.effectiveUnitPrice * Math.max(1, Math.floor(line.quantity || 1)),
    0
  )
  const loyaltyPct = loyaltyStatus.enabled
    ? Math.max(0, loyaltyStatus.tier?.discount_percent ?? 0)
    : 0
  let validatedPromo: {
    id: string
    code: string
    requestedDiscountAmount: number
  } | null = null
  const rawPromoCode = (input.form.promoCode ?? '').trim()
  if (rawPromoCode) {
    const cartLinesForPromo = priceLines.flatMap((line) => {
      if (!line.inventoryId) return []
      const quantity = Math.max(1, Math.floor(line.quantity || 1))
      return [{
        inventoryId: line.inventoryId,
        lineSubtotal: line.effectiveUnitPrice * quantity,
        listLineSubtotal: line.listUnitPrice * quantity,
        isClearance: line.isClearance === true,
      }]
    })
    const validated = await validatePromotionCodeFromPg({
      partnerId: input.partnerId,
      code: rawPromoCode,
      subtotal,
      cartLines: cartLinesForPromo,
      guestAccountId: input.guestAccountId ?? null,
      linkedUserId: input.linkedUserId ?? null,
      emailNormalized: input.form.customerEmail,
    })
    if (!validated.ok) return { error: `promo_invalid:${validated.error}` }
    validatedPromo = {
      id: validated.promotion.id,
      code: validated.promotion.code,
      requestedDiscountAmount: validated.discountAmount,
    }
  }
  const saleBreakdown = resolvePartnerSaleDiscountBreakdown({
    lines: priceLines,
    voucherDiscountAmount: validatedPromo?.requestedDiscountAmount ?? 0,
    birthdayDiscountPercent: validatedPromo ? 0 : (bdayPct ?? 0),
    loyaltyDiscountPercent: loyaltyPct,
  })
  const appliedPromo = validatedPromo
    ? {
        id: validatedPromo.id,
        code: validatedPromo.code,
        discountAmount: saleBreakdown.voucherDiscountAmount,
      }
    : null
  const finalDiscountSnapshot = saleBreakdownToLegacySnapshot({
    breakdown: saleBreakdown,
    loyaltyTierCode: loyaltyStatus.tier?.tier_code ?? '',
    loyaltyTierName: loyaltyStatus.tier?.tier_name ?? '',
    birthdayPercent: bdayPct ?? 0,
    loyaltyPercent: loyaltyPct,
  })
  const payableSubtotal = saleBreakdown.amountAfterDiscount
  const mode = settings.default_deposit_mode ?? 'percent'
  const percent = clampPercent(settings.default_deposit_percent ?? 30, 30)
  const fixedAmount = normalizeMoney(settings.default_deposit_amount ?? 0)
  const calc = resolveRequiredAmountByDepositRule({ subtotal: payableSubtotal, mode, percent, fixedAmount })

  const first = lines[0]
  const draft = await insertPartnerOrderDraftFromPg({
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
    productInventoryId: first.productInventoryId,
    productName: first.productName,
    productImageUrl: first.productImageUrl,
    productUrl: first.productUrl,
    unitPrice: first.unitPrice,
    depositPercent: calc.appliedPercent,
    requiredAmount: calc.requiredAmount,
    customerEmail: trim(input.form.customerEmail, 180).toLowerCase(),
  })
  if (!draft) return { error: 'Không tạo được đơn hàng.' }
  const linesOk = await replacePartnerOrderLinesFromPg(draft.id, lines)
  if (!linesOk) return { error: 'Không lưu được sản phẩm trong giỏ hàng.' }

  const partnerRow = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const shopDisplayName = String(partnerRow?.[0]?.display_name ?? '').trim()
  // W1.7 — phí ship (cộng thêm lúc hiển thị, KHÔNG đổi cọc/amount_after_discount) + phương thức
  // thanh toán khách chọn (chỉ có ý nghĩa thật khi có cọc).
  const shippingFeeAmount = resolveShippingFeeAmount(settings, payableSubtotal)
  const paymentMethod = resolvePaymentMethodForCheckout({
    requested: input.form.paymentMethod,
    requiredAmount: calc.requiredAmount,
    ewalletEnabled: settings.ewallet_enabled,
  })
  const useSepayQr =
    settings.sepay_enabled === true &&
    Boolean(String(settings.sepay_bank_code ?? '').trim()) &&
    Boolean(String(settings.sepay_account_number ?? '').trim())
  const paymentReference = useSepayQr
    ? buildSepayOrderPaymentReference(draft.id, shopDisplayName)
    : buildStablePaymentReference(draft.id, shopDisplayName)
  let qrUrl = ''
  if (calc.requiredAmount > 0) {
    if (paymentMethod === 'ewallet') {
      // Giống SePay QR về UX (khách tự quét/chuyển) nhưng đây là ảnh QR TĨNH merchant tự upload —
      // không nhúng số tiền/nội dung như QR ngân hàng.
      qrUrl = String(settings.ewallet_qr_url ?? '').trim()
      if (!qrUrl) return { error: 'Shop chưa cài đặt QR ví điện tử.' }
    } else {
      if (!useSepayQr) {
        const effectiveBankBin =
          String(settings.bank_bin ?? '').trim() || inferVietQrBankCodeFromName(settings.bank_name ?? '')
        if (!String(settings.account_number ?? '').trim() || !effectiveBankBin) {
          return { error: 'Shop chưa cài đặt thông tin ngân hàng nhận cọc.' }
        }
      }
      qrUrl = buildOrderPaymentQrBySettings({
        amount: calc.requiredAmount,
        paymentReference,
        accountHolder: settings.account_holder,
        settings: {
          sepay_enabled: settings.sepay_enabled,
          sepay_bank_code: settings.sepay_bank_code,
          sepay_account_number: settings.sepay_account_number,
          sepay_qr_template: settings.sepay_qr_template,
          bank_name: settings.bank_name,
          bank_bin: settings.bank_bin,
          account_number: settings.account_number,
        },
      })
      if (!qrUrl) return { error: 'Chưa xác định được mã ngân hàng để tạo QR. Vui lòng kiểm tra tên ngân hàng.' }
    }
  }

  const updated = await updatePartnerOrderCartCheckoutFromPg({
    orderId: draft.id,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
    customerName: trim(input.form.customerName, 120),
    customerEmail: trim(input.form.customerEmail, 180).toLowerCase(),
    customerPhone: trim(input.form.customerPhone, 40),
    shippingAddress: trim(input.form.shippingAddress, 280),
    note: trim(input.form.note, 800),
    subtotalAmount: subtotal,
    depositPercent: calc.appliedPercent,
    requiredAmount: calc.requiredAmount,
    paymentReference,
    paymentQrUrl: qrUrl,
    primaryLine: first,
    discountSnapshot: finalDiscountSnapshot,
    saleBreakdown,
    promo: appliedPromo,
    paymentMethod,
    shippingFeeAmount,
  })
  if (updated && appliedPromo) {
    await recordPromotionUsageFromPg({
      partnerId: input.partnerId,
      promotionId: appliedPromo.id,
      orderId: updated.id,
      discountAmount: appliedPromo.discountAmount,
      guestAccountId: input.guestAccountId ?? null,
      linkedUserId: input.linkedUserId ?? null,
    })
  }
  if (!updated) return { error: 'Không cập nhật được đơn hàng.' }
  await createPartnerAffiliateCommissionForOrderFromPg({
    partnerId: input.partnerId,
    orderId: updated.id,
    accountKey: promotionAccountKey({
      linkedUserId: input.linkedUserId,
      guestAccountId: input.guestAccountId,
      fallback: input.externalThreadId,
    }),
    amountAfterDiscount: updated.amount_after_discount,
  })
  const savedLines = await fetchPartnerOrderLinesFromPg(updated.id)
  const em = trim(input.form.customerEmail, 180).toLowerCase()
  if (em) {
    await upsertPartnerCustomerProfileByEmailFromPg({
      partnerId: input.partnerId,
      emailNormalized: em,
      emailRaw: input.form.customerEmail,
      customerName: trim(input.form.customerName, 120),
      customerPhone: trim(input.form.customerPhone, 40),
      shippingAddress: trim(input.form.shippingAddress, 280),
    })
  }

  const paymentDisplay = resolveOrderPaymentDisplay(updated, settings)
  await insertMessagePg({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body:
      updated.required_amount > 0
        ? `Đơn hàng ${savedLines.length} sản phẩm đã được tạo thành công.\n` +
          `Tổng đơn: **${toVnd(updated.subtotal_amount)}**\n` +
          orderDiscountSummaryLine(updated) +
          orderShippingFeeSummaryLine(updated) +
          `Cần đặt cọc trước: **${toVnd(updated.required_amount)}** (${updated.deposit_percent}%).\n` +
          `Còn thanh toán khi nhận hàng: **${toVnd(Math.max(0, updated.amount_after_discount - updated.required_amount) + updated.shipping_fee_amount)}**.\n` +
          (updated.payment_method === 'ewallet'
            ? 'Quét QR ví điện tử trong khối «Thanh toán» bên dưới.'
            : 'STK, nội dung chuyển khoản và QR nằm trong khối «Thanh toán chuyển khoản» bên dưới.')
        : `Đơn hàng ${savedLines.length} sản phẩm đã được tạo thành công.\n` +
          `Tổng đơn: **${toVnd(updated.subtotal_amount)}**\n` +
          orderDiscountSummaryLine(updated) +
          orderShippingFeeSummaryLine(updated) +
          `Thanh toán trước: **0đ**.\n` +
          `Thanh toán khi nhận hàng: **${toVnd(updated.amount_after_discount + updated.shipping_fee_amount)}**.`,
    rawPayload: toJson(orderCardPayload(updated, paymentDisplay, savedLines)),
  })
  await insertPartnerOrderEventFromPg({
    orderId: updated.id,
    eventType: 'checkout_submitted',
    title: 'Khách gửi thông tin nhận hàng',
    detail: `${savedLines.length} sản phẩm, cần đặt cọc trước ${toVnd(updated.required_amount)}.`,
    source: 'customer',
  })
  try {
    await emailCustomerOrderCheckoutSubmitted({
      order: updated,
      shopNotifyEmail: settings.notify_email || '',
    })
  } catch (e) {
    console.warn('[completeCartCheckout] email', e)
  }
  queuePartnerOrderGoogleSheetsSync(input.partnerId, updated.id)
  emitPartnerOutboundOrderCreated(input.partnerId, updated)
  notifyPartnerOwnerNewOrder(input.partnerId, updated).catch((e) =>
    console.warn('[completeCartCheckout] notify owner', e)
  )
  return { ok: true, order: updated }
}

export async function listRelatedBuyProducts(input: {
  partnerId: string
  recentCards: PartnerAiProductCard[]
  limit?: number
  linkedUserId?: string | null
}): Promise<RelatedBuyProduct[]> {
  const lim = Math.max(1, Math.min(20, Math.floor(Number(input.limit) || 20)))
  const bdayPct = await resolveActiveBirthdayDiscountPercentForLinkedUser(
    input.partnerId,
    input.linkedUserId ?? null
  )
  const priceWithBday = (hint: string) =>
    bdayPct != null && bdayPct > 0 && hint.trim() ? applyBirthdayDiscountToPriceHint(hint, bdayPct) : hint
  const recentDedup: PartnerAiProductCard[] = []
  const seenRecent = new Set<string>()
  for (const c of input.recentCards) {
    const u = c.product_url.trim()
    if (!u) continue
    const key = u.toLowerCase()
    if (seenRecent.has(key)) continue
    seenRecent.add(key)
    recentDedup.push(c)
    if (recentDedup.length >= 80) break
  }

  const rows = await fetchPartnerInventoryDefaultForAiFromPg(input.partnerId, 800)
  type InvRow = NonNullable<Awaited<ReturnType<typeof fetchPartnerInventoryDefaultForAiFromPg>>>[number]
  const byUrl = new Map<string, InvRow>()
  for (const row of rows ?? []) {
    const u = String(row.product_url ?? '').trim()
    if (!u) continue
    const key = normalizeProductUrlKey(u)
    if (!key) continue
    if (!byUrl.has(key)) byUrl.set(key, row)
  }

  if (recentDedup.length > 0) {
    const out: RelatedBuyProduct[] = []
    for (const c of recentDedup) {
      const key = normalizeProductUrlKey(c.product_url.trim())
      const row = key ? byUrl.get(key) : undefined
      out.push({
        name: row?.name?.trim() ? row.name : c.name,
        image_url: row?.image_url?.trim() ? row.image_url : c.image_url,
        product_url: row?.product_url?.trim() ? row.product_url : c.product_url,
        price_hint: priceWithBday(row?.price_hint?.trim() ? row.price_hint : c.price_hint ?? ''),
        sku: row?.sku ?? null,
        ...(row?.id && String(row.id).trim() ? { inventory_id: String(row.id).trim() } : {}),
      })
      if (out.length >= lim) break
    }
    return out
  }

  if (!rows || rows.length === 0) return []
  return rows.slice(0, lim).map((x) => ({
    name: x.name,
    image_url: x.image_url ?? '',
    product_url: x.product_url ?? '',
    price_hint: priceWithBday(x.price_hint ?? ''),
    sku: x.sku ?? null,
    ...(x.id && String(x.id).trim() ? { inventory_id: String(x.id).trim() } : {}),
  }))
}

export async function getProductPurchaseOptions(input: {
  partnerId: string
  productUrl: string
  linkedUserId?: string | null
}): Promise<ProductPurchaseOptions | null> {
  const row = await fetchPartnerInventoryPurchaseOptionsByProductUrlFromPg(
    input.partnerId,
    input.productUrl
  )
  if (!row) return null
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const mode = settings?.default_deposit_mode ?? 'percent'
  const percent = clampPercent(settings?.default_deposit_percent ?? 30, 30)
  const fixedAmount = normalizeMoney(settings?.default_deposit_amount ?? 0)
  const bdayPct = await resolveActiveBirthdayDiscountPercentForLinkedUser(
    input.partnerId,
    input.linkedUserId ?? null
  )
  const rawHint = row.price_hint ?? ''
  const priceHint =
    bdayPct != null && bdayPct > 0 && rawHint.trim()
      ? applyBirthdayDiscountToPriceHint(rawHint, bdayPct)
      : rawHint
  return {
    sku: row.sku ?? null,
    name: row.name,
    image_url: row.image_url ?? '',
    product_url: row.product_url ?? '',
    price_hint: priceHint,
    // PS.1 — ưu tiên cột structured mới; fallback quy ước JSON cũ (description/stock_note) khi dòng chưa qua Product Studio.
    sizes: row.sizes_json ?? parseSizeJson(row.description),
    colors: row.colors_json ?? parseColorVariantsJson(row.stock_note),
    deposit_policy: {
      mode,
      percent,
      fixed_amount: fixedAmount,
    },
    shipping_policy: {
      fee_amount: Math.max(0, Math.round(settings?.shipping_fee_amount ?? 0)),
      free_threshold_amount:
        settings?.shipping_free_threshold_amount == null ? null : Math.max(0, Math.round(settings.shipping_free_threshold_amount)),
    },
    ewallet_available: Boolean(settings?.ewallet_enabled && String(settings?.ewallet_qr_url ?? '').trim()),
  }
}

export async function getCustomerDeliveryProfile(input: {
  partnerId: string
  emailNormalized: string
}): Promise<{
  customerName: string
  customerPhone: string
  shippingAddress: string
  gender: 'male' | 'female' | null
  dateOfBirth: string | null
} | null> {
  const row = await fetchPartnerCustomerProfileByEmailFromPg(input)
  if (!row) return null
  return {
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    shippingAddress: row.shipping_address,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
  }
}

export type TransferReceiptOcrResult = {
  receiverAccount: string
  amount: number
  transactionRef: string
  fullText: string
}

async function runGeminiTransferOcr(imageUrl: string): Promise<TransferReceiptOcrResult | null> {
  if (!process.env.GOOGLE_API_KEY?.trim()) return null
  const resp = await fetch(imageUrl)
  if (!resp.ok) return null
  const mime = resp.headers.get('content-type')?.trim() || 'image/jpeg'
  const buf = Buffer.from(await resp.arrayBuffer())
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt =
    'Read this Vietnamese mobile banking screenshot or transfer receipt. Return strict JSON only with keys: receiverAccount (digits of beneficiary account if visible), amount, transactionRef, fullText. ' +
    'amount must be integer VND. fullText must include all readable text especially transfer memo/content (order reference like PREFIX-XXXXXXXXXX), bank name, and success wording.'
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: buf.toString('base64'), mimeType: mime } },
    ] as never)
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      'gemini-2.5-flash',
      'messaging-transfer-receipt-ocr',
      null
    )
    const raw = result.response.text().trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      receiverAccount: trim(String(parsed.receiverAccount ?? ''), 64).replace(/[^\d]/g, ''),
      amount: Math.max(0, parseVndAmountFromText(String(parsed.amount ?? '0'))),
      transactionRef: trim(String(parsed.transactionRef ?? ''), 120),
      fullText: trim(String(parsed.fullText ?? ''), 6000),
    }
  } catch {
    return null
  }
}

/**
 * Gọi trước khi gợi ý SP / LLM: có đơn chờ cọc + ảnh giống biên lai CK thì định tuyến sang đối chiếu thanh toán.
 */
export function shouldTreatGuestImageAsOrderPaymentProof(
  order: PartnerOrderRow,
  ocr: TransferReceiptOcrResult
): boolean {
  if (order.required_amount <= 0 || order.status !== 'awaiting_payment') return false
  const req = Math.round(order.required_amount)
  const low = ocr.fullText.toLowerCase()
  const ref = order.payment_reference.trim().toLowerCase()
  const refOk = ref.length >= 6 && low.includes(ref)
  const amtOk = ocr.amount >= req && ocr.amount <= Math.ceil(req * 1.005)
  const bankCue =
    /vietin|vietcom|techcom|bidv|acb|mbbank|vpbank|shb|hdbank|seabank|sacombank|msb|ocb|vib|giao\s*dịch|giao\s*dich|chuyển\s*khoản|chuyen\s*khoan|thành\s*công|thanh\s*cong|ứng\s*dụng|ung\s*dung|ipay|vnd|số\s*tiền|so\s*tien|nhận\s*tiền|nhan\s*tien/i.test(
      low
    )
  const recvDigits = ocr.receiverAccount.replace(/\D/g, '')
  const hasReceiverDigits = recvDigits.length >= 8

  if (refOk && amtOk) return true
  if (refOk && bankCue) return true
  if (amtOk && bankCue && hasReceiverDigits) return true
  return false
}

/**
 * OCR một lần; nếu khớp đơn chờ thanh toán thì caller gọi `verifyOrderPaymentProof` sau khi đã lưu tin ảnh inbound.
 */
export async function prepareDeferredGuestPaymentVerification(input: {
  partnerId: string
  externalThreadId: string
  imagePublicUrl: string
}): Promise<{ defer: false } | { defer: true; orderId: string; ocr: TransferReceiptOcrResult }> {
  if (!process.env.GOOGLE_API_KEY?.trim()) return { defer: false }
  const pending = await fetchLatestAwaitingPaymentOrderForPartnerThreadFromPg(
    input.partnerId,
    input.externalThreadId
  )
  if (!pending) return { defer: false }
  const ocr = await runGeminiTransferOcr(input.imagePublicUrl)
  if (!ocr) return { defer: false }
  if (!shouldTreatGuestImageAsOrderPaymentProof(pending, ocr)) return { defer: false }
  return { defer: true, orderId: pending.id, ocr }
}

export async function verifyOrderPaymentProof(input: {
  partnerId: string
  externalThreadId: string
  orderId: string
  proofImageStoragePath: string
  linkedUserId?: string | null
  guestAccountId?: string | null
  anonymousSessionId?: string | null
  /** Đã OCR ở bước nhận diện ảnh trong chat — tránh gọi Gemini hai lần. */
  preReadOcr?: TransferReceiptOcrResult | null
}): Promise<{ ok: true; order: PartnerOrderRow; verification: 'verified' | 'manual_review' | 'failed' } | { error: string }> {
  const exists = await guestImageObjectExists(input.proofImageStoragePath)
  if (!exists) return { error: 'Không tìm thấy ảnh chứng từ.' }

  const order = await fetchPartnerOrderByIdForPartnerFromPg(input.partnerId, input.orderId)
  if (!order) return { error: 'Không tìm thấy đơn cần đối chiếu.' }
  const thread: WidgetOrderThreadForCheckout = {
    externalThreadId: input.externalThreadId,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
    anonymousSessionId: input.anonymousSessionId ?? null,
  }
  const allowed = await assertGuestOwnsPartnerOrderForWidgetCheckout(input.partnerId, order, thread)
  if (!allowed) return { error: 'Không tìm thấy đơn cần đối chiếu.' }
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chưa cấu hình thanh toán.' }
  const imageUrl = getTryOnPublicUrlFromPath(input.proofImageStoragePath)
  const ocr = input.preReadOcr ?? (await runGeminiTransferOcr(imageUrl))
  if (!ocr) return { error: 'Không đọc được ảnh chuyển khoản.' }

  const expectedPrimary = settings.account_number.replace(/[^\d]/g, '')
  const expectedSepay =
    settings.sepay_enabled === true && String(settings.sepay_account_number ?? '').trim().length > 0
      ? String(settings.sepay_account_number).replace(/[^\d]/g, '')
      : ''
  const accountMatched =
    (expectedPrimary.length >= 6 && ocr.receiverAccount.includes(expectedPrimary)) ||
    (expectedSepay.length >= 6 && ocr.receiverAccount.includes(expectedSepay))
  const amountMatched = ocr.amount >= Math.round(order.required_amount)
  const transactionHintMatched =
    !order.payment_reference || ocr.fullText.toLowerCase().includes(order.payment_reference.toLowerCase())

  let verification: 'verified' | 'manual_review' | 'failed' = 'failed'
  if (accountMatched && amountMatched) verification = 'verified'
  else if (accountMatched || amountMatched || transactionHintMatched) verification = 'manual_review'

  await insertPartnerPaymentProofFromPg({
    orderId: order.id,
    imageStoragePath: input.proofImageStoragePath,
    imageUrl,
    ocrText: ocr.fullText,
    ocrReceiverAccount: ocr.receiverAccount,
    ocrAmount: ocr.amount,
    ocrTransactionRef: ocr.transactionRef,
    verificationStatus: verification,
    verificationReason:
      verification === 'verified'
        ? 'matched_account_and_amount'
        : `account_matched=${String(accountMatched)} amount_matched=${String(amountMatched)} ref_hint=${String(transactionHintMatched)}`,
  })
  await insertPartnerOrderEventFromPg({
    orderId: order.id,
    eventType: 'payment_proof_uploaded',
    title: 'Khach gui chung tu thanh toan',
    detail: `AI doc so tien ${toVnd(ocr.amount)}; ket qua ${verification}.`,
    source: 'customer',
  })

  const nextStatus =
    verification === 'verified' ? 'paid_verified' : verification === 'manual_review' ? 'pending_manual_review' : 'awaiting_payment'
  const verifiedNote =
    verification === 'verified'
      ? 'AI doi chieu thanh cong STK + so tien.'
      : verification === 'manual_review'
        ? 'AI khuyen nghi shop kiem tra thu cong.'
        : 'AI chưa khớp dữ liệu thanh toán.'
  const ok = await updatePartnerOrderPaymentVerificationFromPg({
    orderId: order.id,
    status: nextStatus,
    paidAmount: ocr.amount,
    verifiedNote,
  })
  if (!ok) return { error: 'Không cập nhật được kết quả đối chiếu.' }

  const refreshed = await fetchPartnerOrderByIdForPartnerFromPg(input.partnerId, order.id)
  if (!refreshed) return { error: 'Không tải lại được đơn hàng.' }

  await insertMessagePg({
    conversationId: order.conversation_id,
    direction: 'outbound',
    body:
      verification === 'verified'
        ? `Shop đã xác nhận thanh toán thành công cho đơn ${refreshed.payment_reference}. Cảm ơn bạn!`
        : verification === 'manual_review'
          ? `Shop đã nhận chứng từ. Hệ thống cần shop kiểm tra thủ công thêm cho đơn ${refreshed.payment_reference}.`
          : `Hệ thống chưa đối chiếu được thông tin chuyển khoản. Bạn vui lòng gửi lại ảnh rõ hơn hoặc kiểm tra lại số tiền/STK.`,
    rawPayload: toJson({
      source: 'system_order',
      order_id: refreshed.id,
      order_status: refreshed.status,
      payment_verification: verification,
      payment_amount_detected: ocr.amount,
      payment_receiver_detected: ocr.receiverAccount,
      payment_proof_image_url: imageUrl,
    }),
  })
  await insertPartnerOrderEventFromPg({
    orderId: refreshed.id,
    eventType: 'payment_verification',
    title: verification === 'verified' ? 'Thanh toán xác minh thành công' : verification === 'manual_review' ? 'Cần duyệt tay' : 'Thanh toán chưa khớp',
    detail: verifiedNote,
    source: 'system',
  })

  if (verification === 'verified') {
    try {
      await emailCustomerOrderPaymentVerified({
        order: refreshed,
        shopNotifyEmail: settings.notify_email || '',
      })
    } catch (e) {
      console.warn('[verifyOrderPaymentProof] email verified', e)
    }
  } else if (verification === 'manual_review') {
    try {
      await emailCustomerOrderPaymentManualReview({
        order: refreshed,
        shopNotifyEmail: settings.notify_email || '',
      })
    } catch (e) {
      console.warn('[verifyOrderPaymentProof] email manual_review', e)
    }
  }
  queuePartnerOrderGoogleSheetsSync(input.partnerId, refreshed.id)
  if (verification === 'verified') {
    emitPartnerOutboundPaymentPaid(input.partnerId, refreshed)
    sendPartnerMetaPurchaseCapiOnPaymentConfirmed({ partnerId: input.partnerId, order: refreshed }).catch((e) =>
      console.warn('[verifyOrderPaymentProof] Meta CAPI Purchase', e)
    )
  }
  return { ok: true, order: refreshed, verification }
}

export async function buildGuestOrderDepositView(input: {
  partnerId: string
  order: PartnerOrderRow
}): Promise<{
  order: PartnerOrderRow
  payment_display: PartnerOrderPaymentDisplay | null
  default_deposit_percent: number
  google_customer_reviews_merchant_id: number | null
}> {
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const payment_display = settings ? resolveOrderPaymentDisplay(input.order, settings) : null
  const gcr = await fetchPartnerGoogleCustomerReviewsMerchantIdFromPg(input.partnerId)
  return {
    order: input.order,
    payment_display,
    default_deposit_percent: Math.max(1, Math.min(99, Math.round(settings?.default_deposit_percent ?? 30))),
    google_customer_reviews_merchant_id: gcr,
  }
}

/** Đổi mức cọc 30% (hoặc % shop) / 100% trên đơn đang chờ CK — tái tạo QR. */
export async function updateCartOrderDepositPercent(input: {
  partnerId: string
  orderId: string
  thread: WidgetOrderThreadForCheckout
  percent: number
}): Promise<{ ok: true; order: PartnerOrderRow; payment_display: PartnerOrderPaymentDisplay | null } | { error: string }> {
  const existing = await fetchPartnerOrderDetailForGuestWidgetIfAllowed(
    input.partnerId,
    input.orderId,
    input.thread
  )
  if (!existing) return { error: 'Forbidden' }
  if (existing.status !== 'awaiting_payment' || existing.required_amount <= 0) {
    return { error: 'Order is not waiting for deposit.' }
  }
  if (existing.payment_method === 'ewallet') {
    return { error: 'E-wallet deposit amount is fixed.' }
  }
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chưa cài đặt thanh toán.' }
  const shopPercent = clampPercent(settings.default_deposit_percent ?? 30, 30)
  const requested = Math.round(Number(input.percent) || shopPercent)
  const percent = requested >= 100 ? 100 : shopPercent
  const payable = Math.max(0, Math.round(existing.amount_after_discount || existing.subtotal_amount || 0))
  const ship = Math.max(0, Math.round(existing.shipping_fee_amount || 0))
  const requiredAmount =
    percent >= 100 ? payable + ship : Math.ceil((payable * percent) / 100)
  const qrUrl = buildOrderPaymentQrBySettings({
    amount: requiredAmount,
    paymentReference: existing.payment_reference,
    accountHolder: settings.account_holder,
    settings: {
      sepay_enabled: settings.sepay_enabled,
      sepay_bank_code: settings.sepay_bank_code,
      sepay_account_number: settings.sepay_account_number,
      sepay_qr_template: settings.sepay_qr_template,
      bank_name: settings.bank_name,
      bank_bin: settings.bank_bin,
      account_number: settings.account_number,
    },
  })
  if (!qrUrl) return { error: 'Không tạo được mã QR mới.' }
  const updated = await updatePartnerOrderDepositQuoteFromPg({
    orderId: existing.id,
    partnerId: input.partnerId,
    depositPercent: percent,
    requiredAmount,
    paymentQrUrl: qrUrl,
  })
  if (!updated) return { error: 'Không cập nhật được mức cọc.' }
  return {
    ok: true,
    order: updated,
    payment_display: resolveOrderPaymentDisplay(updated, settings),
  }
}

