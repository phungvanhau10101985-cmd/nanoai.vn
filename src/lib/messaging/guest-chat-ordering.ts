import { GoogleGenerativeAI } from '@google/generative-ai'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import type { Json } from '@/types/database.types'
import { ensureConversationPg, fetchPartnerMessagesFromPg, insertMessagePg } from '@/lib/db/customer-care-pg'
import {
  fetchPartnerOrderForThreadFromPg,
  fetchPartnerPaymentSettingsFromPg,
  insertPartnerOrderDraftFromPg,
  insertPartnerOrderEventFromPg,
  insertPartnerPaymentProofFromPg,
  parseVndAmountFromText,
  type PartnerOrderRow,
  updatePartnerOrderCheckoutFromPg,
  updatePartnerOrderPaymentVerificationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchPartnerInventoryDefaultForAiFromPg,
  fetchPartnerInventoryRowByProductUrlFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { guestImageObjectExists } from '@/lib/messaging/guest-chat-image'
import { getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import { sendSmtpMail } from '@/lib/email/smtp'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import {
  fetchPartnerCustomerProfileByEmailFromPg,
  upsertPartnerCustomerProfileByEmailFromPg,
} from '@/lib/db/messaging-partner-customer-profiles-pg'

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
    [/vietinbank|vietin/, '970415'],
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

function stablePaymentRef(orderId: string): string {
  const clean = orderId.replace(/-/g, '').slice(0, 10).toUpperCase()
  return `NANOAI-${clean}`
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

function orderCardPayload(order: PartnerOrderRow): Record<string, unknown> {
  return {
    source: 'system_order',
    order_id: order.id,
    order_status: order.status,
    order_required_amount: order.required_amount,
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
  if (!conv?.conversationId) return { error: 'Khong tao duoc hoi thoai.' }

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
  if (!draft) return { error: 'Khong tao duoc don hang.' }

  await insertMessagePg({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body:
      `Shop da tao don hang cho ban: ${draft.product_name}.\n` +
      `Buoc tiep theo: dien thong tin giao hang va tao QR thanh toan de chot don.`,
    rawPayload: toJson(orderCardPayload(draft)),
  })
  await insertPartnerOrderEventFromPg({
    orderId: draft.id,
    eventType: 'order_created',
    title: 'Tao don tu chat',
    detail: `Khach chon san pham: ${draft.product_name}`,
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
  const conv = await ensureConversationPg({
    partnerId: input.partnerId,
    channel: 'widget',
    externalThreadId: input.externalThreadId,
    customerName: firstLine(input.form.customerName),
    linkedUserId: input.linkedUserId ?? null,
    metadata: { source: 'hosted_chat_page', auth_mode: input.guestAccountId ? 'account' : 'anonymous' },
  })
  if (!conv?.conversationId) return { error: 'Khong tao duoc hoi thoai.' }
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chua cai dat thanh toan.' }

  const oldOrder = await fetchPartnerOrderForThreadFromPg({
    orderId: input.orderId,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
  })
  if (!oldOrder) return { error: 'Khong tim thay don hang.' }
  if (oldOrder.locked_at) return { error: 'Don da khoa sau khi xac nhan, khong the sua.' }

  const paymentReference = stablePaymentRef(oldOrder.id)
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
    const effectiveBankBin = String(settings.bank_bin ?? '').trim() || inferVietQrBankCodeFromName(settings.bank_name ?? '')
    if (!settings.account_number || !effectiveBankBin) {
      return { error: 'Shop chua cai dat thong tin ngan hang nhan coc.' }
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
    if (!qrUrl) return { error: 'Chua xac dinh duoc ma ngan hang de tao QR. Vui long kiem tra ten ngan hang.' }
  }

  const updated = await updatePartnerOrderCheckoutFromPg({
    orderId: oldOrder.id,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
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
  if (!updated) return { error: 'Khong cap nhat duoc don hang.' }
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

  await insertMessagePg({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body:
      updated.required_amount > 0
        ? `Thong tin don da duoc ghi nhan.\n` +
          `Tong tien: ${toVnd(updated.subtotal_amount)} | Can thanh toan: ${toVnd(updated.required_amount)} (${updated.deposit_percent}%).\n` +
          `Noi dung chuyen khoan: ${updated.payment_reference}\n` +
          `${calc.fallbackApplied ? 'Luu y: So tien dat coc vuot gia tri don, he thong da fallback ve 20% gia tri don.\n' : ''}` +
          `Vui long gui anh chung tu sau khi chuyen khoan de shop xac nhan.`
        : `Thong tin don da duoc ghi nhan.\n` +
          `Tong tien: ${toVnd(updated.subtotal_amount)} | Dat coc: 0đ.\n` +
          `Don nay khong yeu cau dat coc. Shop se lien he xac nhan don va giao hang.`,
    rawPayload: toJson(orderCardPayload(updated)),
  })
  await insertPartnerOrderEventFromPg({
    orderId: updated.id,
    eventType: 'checkout_submitted',
    title: 'Khach gui thong tin nhan hang',
    detail: `So luong ${updated.quantity}, can thanh toan ${toVnd(updated.required_amount)}.`,
    source: 'customer',
  })
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
  return {
    sku: row.sku ?? null,
    name: row.name,
    image_url: row.image_url ?? '',
    product_url: row.product_url ?? '',
    price_hint: row.price_hint ?? '',
    sizes: parseSizeJson(row.description),
    colors: parseColorVariantsJson(row.stock_note),
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

type OcrResult = {
  receiverAccount: string
  amount: number
  transactionRef: string
  fullText: string
}

async function runGeminiTransferOcr(imageUrl: string): Promise<OcrResult | null> {
  if (!process.env.GOOGLE_API_KEY?.trim()) return null
  const resp = await fetch(imageUrl)
  if (!resp.ok) return null
  const mime = resp.headers.get('content-type')?.trim() || 'image/jpeg'
  const buf = Buffer.from(await resp.arrayBuffer())
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt =
    'Read this bank transfer receipt image and return strict JSON only with keys: receiverAccount, amount, transactionRef, fullText. ' +
    'amount must be integer VND number.'
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

async function sendOrderEmails(input: {
  order: PartnerOrderRow
  shopNotifyEmail: string
  customerFallbackEmail: string
}): Promise<void> {
  const customerEmail = input.order.customer_email || input.customerFallbackEmail
  const shopEmail = trim(input.shopNotifyEmail || '')
  const toShop = shopEmail || ''

  const subjectCustomer = `[NanoAI] Xac nhan don ${input.order.payment_reference}`
  const textCustomer = [
    `Don hang cua ban da duoc xac nhan thanh toan.`,
    `Ma don: ${input.order.payment_reference}`,
    `San pham: ${input.order.product_name}`,
    `So tien da nhan: ${toVnd(input.order.paid_amount)}`,
    `Shop se lien he theo SĐT: ${input.order.customer_phone}`,
  ].join('\n')

  const subjectShop = `[NanoAI] Don moi da thanh toan ${input.order.payment_reference}`
  const textShop = [
    `Co khach vua chot don va da doi chieu thanh toan thanh cong.`,
    `Ma don: ${input.order.payment_reference}`,
    `San pham: ${input.order.product_name}`,
    `Khach: ${input.order.customer_name} | ${input.order.customer_phone} | ${input.order.customer_email}`,
    `Dia chi: ${input.order.shipping_address}`,
    `So tien: ${toVnd(input.order.paid_amount)}`,
  ].join('\n')

  if (customerEmail) await sendSmtpMail({ to: customerEmail, subject: subjectCustomer, text: textCustomer })
  if (toShop) await sendSmtpMail({ to: toShop, subject: subjectShop, text: textShop })
}

export async function verifyOrderPaymentProof(input: {
  partnerId: string
  externalThreadId: string
  orderId: string
  proofImageStoragePath: string
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<{ ok: true; order: PartnerOrderRow; verification: 'verified' | 'manual_review' | 'failed' } | { error: string }> {
  const conv = await ensureConversationPg({
    partnerId: input.partnerId,
    channel: 'widget',
    externalThreadId: input.externalThreadId,
    linkedUserId: input.linkedUserId ?? null,
    metadata: { source: 'hosted_chat_page', auth_mode: input.guestAccountId ? 'account' : 'anonymous' },
  })
  if (!conv?.conversationId) return { error: 'Khong tao duoc hoi thoai.' }

  const exists = await guestImageObjectExists(input.proofImageStoragePath)
  if (!exists) return { error: 'Khong tim thay anh chung tu.' }

  const order = await fetchPartnerOrderForThreadFromPg({
    orderId: input.orderId,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
  })
  if (!order) return { error: 'Khong tim thay don can doi chieu.' }
  const settings = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  if (!settings) return { error: 'Shop chua cau hinh thanh toan.' }
  const imageUrl = getTryOnPublicUrlFromPath(input.proofImageStoragePath)
  const ocr = await runGeminiTransferOcr(imageUrl)
  if (!ocr) return { error: 'Khong doc duoc anh chuyen khoan.' }

  const expectedAccount = settings.account_number.replace(/[^\d]/g, '')
  const accountMatched = expectedAccount && ocr.receiverAccount.includes(expectedAccount)
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
        : 'AI chua khop du lieu thanh toan.'
  const ok = await updatePartnerOrderPaymentVerificationFromPg({
    orderId: order.id,
    status: nextStatus,
    paidAmount: ocr.amount,
    verifiedNote,
  })
  if (!ok) return { error: 'Khong cap nhat duoc ket qua doi chieu.' }

  const refreshed = await fetchPartnerOrderForThreadFromPg({
    orderId: order.id,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
  })
  if (!refreshed) return { error: 'Khong tai lai duoc don hang.' }

  await insertMessagePg({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body:
      verification === 'verified'
        ? `Shop da xac nhan thanh toan thanh cong cho don ${refreshed.payment_reference}. Cam on ban!`
        : verification === 'manual_review'
          ? `Shop da nhan chung tu. He thong can shop kiem tra thu cong them cho don ${refreshed.payment_reference}.`
          : `He thong chua doi chieu duoc thong tin chuyen khoan. Ban vui long gui lai anh ro hon hoac kiem tra lai so tien/STK.`,
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
    title: verification === 'verified' ? 'Thanh toan xac minh thanh cong' : verification === 'manual_review' ? 'Can duyet tay' : 'Thanh toan chua khop',
    detail: verifiedNote,
    source: 'system',
  })

  if (verification === 'verified') {
    const convRows = await fetchPartnerMessagesFromPg(conv.conversationId)
    const customerFallbackEmail = trim(
      refreshed.customer_email ||
        (convRows ?? [])
          .map((m) => (m.direction === 'inbound' ? m.body : ''))
          .join('\n')
          .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
        ''
    )
    await sendOrderEmails({
      order: refreshed,
      shopNotifyEmail: settings.notify_email || '',
      customerFallbackEmail,
    })
  }
  return { ok: true, order: refreshed, verification }
}
