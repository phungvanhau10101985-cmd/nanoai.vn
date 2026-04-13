import { GoogleGenerativeAI } from '@google/generative-ai'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import type { Json } from '@/types/database.types'
import {
  ensureConversationPg,
  fetchCustomerCareConversationByIdPg,
  insertMessagePg,
} from '@/lib/db/customer-care-pg'
import {
  fetchLatestAwaitingPaymentOrderForPartnerThreadFromPg,
  fetchPartnerOrderByIdForPartnerFromPg,
  fetchPartnerPaymentSettingsFromPg,
  insertPartnerOrderDraftFromPg,
  insertPartnerOrderEventFromPg,
  insertPartnerPaymentProofFromPg,
  parseVndAmountFromText,
  type PartnerOrderRow,
  type PartnerPaymentSettingsRow,
  updatePartnerOrderCheckoutFromPg,
  updatePartnerOrderPaymentVerificationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { enrichPaymentDisplayFromQrUrl } from '@/lib/messaging/payment-qr-display-enrich'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerInventoryDefaultForAiFromPg,
  fetchPartnerInventoryRowByProductUrlFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
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

/** Quyền trên đơn nháp khi `external_thread_id` trên đơn không còn trùng phiên (đổi guest ↔ Google). */
async function assertGuestOwnsPartnerOrderForWidgetCheckout(
  partnerId: string,
  order: PartnerOrderRow,
  thread: { externalThreadId: string; linkedUserId: string | null; guestAccountId: string | null }
): Promise<boolean> {
  if (order.partner_id !== partnerId) return false
  const tid = thread.externalThreadId.trim()
  const oidEt = order.external_thread_id.trim()
  if (tid && oidEt === tid) return true

  const conv = await fetchCustomerCareConversationByIdPg(order.conversation_id)
  if (!conv || conv.partner_id !== partnerId) return false
  if (tid && conv.external_thread_id.trim() === tid) return true
  const lid = thread.linkedUserId?.trim() ?? ''
  if (lid && conv.linked_user_id?.trim() === lid) return true
  const gid = thread.guestAccountId?.trim() ?? ''
  if (gid) {
    if (conv.guest_account_id?.trim() === gid) return true
    if (conv.external_thread_id.trim() === gid) return true
  }
  return false
}

/** Chi tiết đơn trong widget nhúng: chỉ trả khi đơn thuộc phiên/thread hiện tại (cùng logic checkout). */
export async function fetchPartnerOrderDetailForGuestWidgetIfAllowed(
  partnerId: string,
  orderId: string,
  thread: { externalThreadId: string; linkedUserId: string | null; guestAccountId: string | null }
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
}

export type RelatedBuyProduct = {
  name: string
  image_url: string
  product_url: string
  price_hint: string
  sku: string | null
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

function clampPercent(v: unknown, fallback = 0): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(fallback)))
  return Math.max(0, Math.min(100, n))
}

function normalizeMoney(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(0, n) : 0
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

function parseColorVariantsJson(raw: string): Array<{ name: string; img: string }> {
  const t = String(raw ?? '').trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t) as unknown
    if (!Array.isArray(arr)) return []
    const out: Array<{ name: string; img: string }> = []
    for (const item of arr) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const img = typeof o.img === 'string' ? o.img.trim() : ''
      if (!name || !/^https?:\/\//i.test(img)) continue
      out.push({ name, img })
      if (out.length >= 30) break
    }
    return out
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

function orderCardPayload(
  order: PartnerOrderRow,
  paymentDisplay: { bank_name: string; account_number: string; account_holder: string } | null
): Record<string, unknown> {
  const remaining = Math.max(0, Math.round(order.subtotal_amount - order.required_amount))
  const base: Record<string, unknown> = {
    source: 'system_order',
    order_id: order.id,
    order_status: order.status,
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
  if (paymentDisplay && order.required_amount > 0) {
    base.order_bank_name = paymentDisplay.bank_name
    base.order_bank_account = paymentDisplay.account_number
    base.order_bank_holder = paymentDisplay.account_holder
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
    metadata: { source: 'hosted_chat_page', auth_mode: input.guestAccountId ? 'account' : 'anonymous' },
  })
  if (!conv?.conversationId) return { error: 'Không tạo được hội thoại.' }

  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const settingsMode = settings?.default_deposit_mode ?? 'percent'
  const depositPercent = clampPercent(settings?.default_deposit_percent ?? 30, 30)
  const depositAmount = normalizeMoney(settings?.default_deposit_amount ?? 0)
  const unitPrice = deriveUnitPriceFromCard(input.card)
  const subtotal = Math.max(0, Math.round(unitPrice))
  const calc = resolveRequiredAmountByDepositRule({
    subtotal,
    mode: settingsMode,
    percent: depositPercent,
    fixedAmount: depositAmount,
  })
  const inv = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, input.card.product_url)
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

export async function completeOrderCheckout(input: {
  partnerId: string
  externalThreadId: string
  orderId: string
  form: CheckoutFormInput
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<{ ok: true; order: PartnerOrderRow } | { error: string }> {
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chưa cài đặt thanh toán.' }

  const oldOrder = await fetchPartnerOrderByIdForPartnerFromPg(input.partnerId, input.orderId)
  if (!oldOrder) return { error: 'Không tìm thấy đơn hàng.' }
  const thread = {
    externalThreadId: input.externalThreadId,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
  }
  const allowed = await assertGuestOwnsPartnerOrderForWidgetCheckout(input.partnerId, oldOrder, thread)
  if (!allowed) return { error: 'Không tìm thấy đơn hàng.' }
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
  const subtotal = Math.max(0, oldOrder.unit_price) * qty
  // Deposit is controlled entirely by shop settings; customer cannot override.
  const mode = settings.default_deposit_mode ?? 'percent'
  const percent = clampPercent(settings.default_deposit_percent ?? 30, 30)
  const fixedAmount = normalizeMoney(settings.default_deposit_amount ?? 0)
  const calc = resolveRequiredAmountByDepositRule({
    subtotal,
    mode,
    percent,
    fixedAmount,
  })
  const expectedAmount = calc.requiredAmount
  let qrUrl = ''
  if (expectedAmount > 0) {
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

  const updated = await updatePartnerOrderCheckoutFromPg({
    orderId: oldOrder.id,
    partnerId: input.partnerId,
    conversationId: oldOrder.conversation_id,
    externalThreadId: oldOrder.external_thread_id,
    customerName: trim(input.form.customerName, 120),
    customerEmail: trim(input.form.customerEmail, 180),
    customerPhone: trim(input.form.customerPhone, 40),
    shippingAddress: trim(input.form.shippingAddress, 280),
    variantColor: trim(input.form.color, 80),
    variantSize: trim(input.form.size, 80),
    quantity: qty,
    note: trim(input.form.note, 800),
    depositPercent: calc.appliedPercent,
    requiredAmount: calc.requiredAmount,
    paymentReference,
    paymentQrUrl: qrUrl,
  })
  if (!updated) return { error: 'Không cập nhật được đơn hàng.' }
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

  const paymentDisplayRaw = updated.required_amount > 0 ? partnerPaymentDisplayFromSettings(settings) : null
  const paymentDisplay =
    paymentDisplayRaw && updated.required_amount > 0 && String(updated.payment_qr_url ?? '').trim()
      ? enrichPaymentDisplayFromQrUrl(String(updated.payment_qr_url).trim(), paymentDisplayRaw)
      : paymentDisplayRaw
  await insertMessagePg({
    conversationId: oldOrder.conversation_id,
    direction: 'outbound',
    body:
      updated.required_amount > 0
        ? `Đơn hàng đã được tạo thành công.\n` +
          `Tổng ${toVnd(updated.subtotal_amount)} — cần đặt cọc trước ${toVnd(updated.required_amount)} (${updated.deposit_percent}%).\n` +
          `STK, nội dung chuyển khoản và QR nằm trong khối «Thanh toán chuyển khoản» bên dưới (có nút sao chép từng mục).\n` +
          `${calc.fallbackApplied ? 'Lưu ý: Số tiền đặt cọc vượt giá trị đơn, hệ thống đã fallback về 20% giá trị đơn.\n' : ''}` +
          (useSepayQr
            ? `Sau khi chuyển khoản đúng số tiền và nội dung CK: xác nhận qua SePay — không cần gửi ảnh biên lai.`
            : `Sau khi chuyển khoản: bấm nút gửi ảnh biên lai ngay dưới mã QR.`)
        : `Đơn hàng đã được tạo thành công.\n` +
          `Tổng tiền: ${toVnd(updated.subtotal_amount)} | Thanh toán trước: 0đ.\n` +
          `Thanh toán khi nhận hàng: ${toVnd(updated.subtotal_amount)}.\n` +
          `Đơn này không yêu cầu đặt cọc trước. Shop sẽ liên hệ xác nhận đơn và giao hàng.`,
    rawPayload: toJson(orderCardPayload(updated, paymentDisplay)),
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
  return { ok: true, order: updated }
}

export async function listRelatedBuyProducts(input: {
  partnerId: string
  recentCards: PartnerAiProductCard[]
  limit?: number
}): Promise<RelatedBuyProduct[]> {
  const lim = Math.max(1, Math.min(20, Math.floor(Number(input.limit) || 20)))
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
    const key = u.toLowerCase()
    if (!byUrl.has(key)) byUrl.set(key, row)
  }

  if (recentDedup.length > 0) {
    const out: RelatedBuyProduct[] = []
    for (const c of recentDedup) {
      const key = c.product_url.trim().toLowerCase()
      const row = byUrl.get(key)
      out.push({
        name: row?.name?.trim() ? row.name : c.name,
        image_url: row?.image_url?.trim() ? row.image_url : c.image_url,
        product_url: row?.product_url?.trim() ? row.product_url : c.product_url,
        price_hint: row?.price_hint?.trim() ? row.price_hint : c.price_hint ?? '',
        sku: row?.sku ?? null,
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
    price_hint: x.price_hint ?? '',
    sku: x.sku ?? null,
  }))
}

export async function getProductPurchaseOptions(input: {
  partnerId: string
  productUrl: string
}): Promise<ProductPurchaseOptions | null> {
  const row = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, input.productUrl)
  if (!row) return null
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const mode = settings?.default_deposit_mode ?? 'percent'
  const percent = clampPercent(settings?.default_deposit_percent ?? 30, 30)
  const fixedAmount = normalizeMoney(settings?.default_deposit_amount ?? 0)
  return {
    sku: row.sku ?? null,
    name: row.name,
    image_url: row.image_url ?? '',
    product_url: row.product_url ?? '',
    price_hint: row.price_hint ?? '',
    sizes: parseSizeJson(row.description),
    colors: parseColorVariantsJson(row.stock_note),
    deposit_policy: {
      mode,
      percent,
      fixed_amount: fixedAmount,
    },
  }
}

export async function getCustomerDeliveryProfile(input: {
  partnerId: string
  emailNormalized: string
}): Promise<{ customerName: string; customerPhone: string; shippingAddress: string } | null> {
  const row = await fetchPartnerCustomerProfileByEmailFromPg(input)
  if (!row) return null
  return {
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    shippingAddress: row.shipping_address,
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
  /** Đã OCR ở bước nhận diện ảnh trong chat — tránh gọi Gemini hai lần. */
  preReadOcr?: TransferReceiptOcrResult | null
}): Promise<{ ok: true; order: PartnerOrderRow; verification: 'verified' | 'manual_review' | 'failed' } | { error: string }> {
  const exists = await guestImageObjectExists(input.proofImageStoragePath)
  if (!exists) return { error: 'Không tìm thấy ảnh chứng từ.' }

  const order = await fetchPartnerOrderByIdForPartnerFromPg(input.partnerId, input.orderId)
  if (!order) return { error: 'Không tìm thấy đơn cần đối chiếu.' }
  const thread = {
    externalThreadId: input.externalThreadId,
    linkedUserId: input.linkedUserId ?? null,
    guestAccountId: input.guestAccountId ?? null,
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
  return { ok: true, order: refreshed, verification }
}
