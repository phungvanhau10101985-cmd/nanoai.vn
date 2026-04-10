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
import { guestImageObjectExists } from '@/lib/messaging/guest-chat-image'
import { getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import { sendSmtpMail } from '@/lib/email/smtp'

export type CheckoutFormInput = {
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  color: string
  size: string
  quantity: number
  note: string
  depositPercent?: 30 | 100
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

function deriveUnitPriceFromCard(card: PartnerAiProductCard): number {
  const fromHint = parseVndAmountFromText(card.price_hint ?? '')
  return Math.max(0, fromHint)
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
  const depositPercent = settings?.default_deposit_percent === 100 ? 100 : 30
  const unitPrice = deriveUnitPriceFromCard(input.card)
  const draft = await insertPartnerOrderDraftFromPg({
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
    productInventoryId: null,
    productName: trim(input.card.name, 180),
    productImageUrl: trim(input.card.image_url, 600),
    productUrl: trim(input.card.product_url, 600),
    unitPrice,
    depositPercent,
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
  if (!settings?.account_number || !settings?.bank_bin) {
    return { error: 'Shop chua cai dat thong tin ngan hang nhan coc.' }
  }

  const oldOrder = await fetchPartnerOrderForThreadFromPg({
    orderId: input.orderId,
    partnerId: input.partnerId,
    conversationId: conv.conversationId,
    externalThreadId: input.externalThreadId,
  })
  if (!oldOrder) return { error: 'Khong tim thay don hang.' }

  const paymentReference = stablePaymentRef(oldOrder.id)
  const effectiveDeposit = input.form.depositPercent === 100 ? 100 : settings.default_deposit_percent === 100 ? 100 : 30
  const expectedAmount = Math.ceil((Math.max(0, oldOrder.unit_price) * Math.max(1, Math.floor(input.form.quantity || 1)) * effectiveDeposit) / 100)
  const qrUrl = buildBasicTransferQrImageUrl({
    bankBin: settings.bank_bin,
    accountNumber: settings.account_number,
    amount: expectedAmount,
    transferContent: paymentReference,
    accountHolder: settings.account_holder,
  })

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
    quantity: Math.max(1, Math.min(99, Math.floor(input.form.quantity || 1))),
    note: trim(input.form.note, 800),
    depositPercent: effectiveDeposit,
    paymentReference,
    paymentQrUrl: qrUrl,
  })
  if (!updated) return { error: 'Khong cap nhat duoc don hang.' }

  await insertMessagePg({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body:
      `Thong tin don da duoc ghi nhan.\n` +
      `Tong tien: ${toVnd(updated.subtotal_amount)} | Can thanh toan: ${toVnd(updated.required_amount)} (${updated.deposit_percent}%).\n` +
      `Noi dung chuyen khoan: ${updated.payment_reference}\n` +
      `Vui long gui anh chung tu sau khi chuyen khoan de shop xac nhan.`,
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
