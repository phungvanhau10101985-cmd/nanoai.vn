import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { PartnerStackedDiscountSnapshot } from '@/lib/db/messaging-partner-loyalty-pg'

export type PartnerPaymentSettingsRow = {
  partner_id: string
  bank_name: string
  bank_bin: string
  account_number: string
  account_holder: string
  default_deposit_percent: number
  default_deposit_mode: 'none' | 'percent' | 'fixed_amount'
  default_deposit_amount: number
  notify_email: string
  require_payment_proof: boolean
  sepay_enabled: boolean
  sepay_bank_code: string
  sepay_account_number: string
  sepay_qr_template: '' | 'compact' | 'qronly'
  sepay_webhook_token: string
  sepay_secret_key: string
  updated_at: string
}

export type PartnerOrderRow = {
  id: string
  partner_id: string
  conversation_id: string
  external_thread_id: string
  status: 'awaiting_payment' | 'payment_checking' | 'paid_verified' | 'pending_manual_review' | 'cancelled'
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  variant_color: string
  variant_size: string
  /** JSON string `string[]` — URL ảnh màu/mẫu (palette) khách đã chọn; rỗng nếu không có. */
  variant_image_urls: string
  quantity: number
  note: string
  product_inventory_id: string | null
  product_name: string
  product_image_url: string
  product_url: string
  unit_price: number
  subtotal_amount: number
  loyalty_tier_code: string
  loyalty_tier_name: string
  loyalty_discount_percent: number
  loyalty_discount_amount: number
  birthday_discount_percent: number
  birthday_discount_amount: number
  total_discount_percent: number
  total_discount_amount: number
  amount_after_discount: number
  deposit_percent: number
  required_amount: number
  paid_amount: number
  currency: string
  payment_reference: string
  payment_qr_url: string
  verified_note: string
  shipping_status: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'returned' | 'cancelled'
  created_at: string
  updated_at: string
  verified_at: string | null
  locked_at: string | null
  /** Dòng trong Google Sheet (tab shop) khi đã đồng bộ; null nếu chưa ghi. */
  google_sheet_row: number | null
  /** Số hàng liên tiếp trên Sheet (mỗi mẫu một hàng); null = legacy (1 hàng). */
  google_sheet_row_count: number | null
}

export type PartnerOrderLineRow = {
  id: string
  order_id: string
  product_inventory_id: string | null
  product_name: string
  product_image_url: string
  product_url: string
  unit_price: number
  quantity: number
  line_subtotal: number
  variant_color: string
  variant_size: string
  variant_image_urls: string
  note: string
  sort_order: number
  created_at: string
  updated_at: string
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clampPercent(v: unknown, fallback = 0): number {
  const n = Math.round(num(v, fallback))
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(fallback)))
  return Math.max(0, Math.min(100, n))
}

function isMissingPaymentSettingsTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42P01') return false
  const msg = String(err.message ?? '').toLowerCase()
  return msg.includes('messaging_partner_payment_settings')
}

function isLegacyDepositPercentConstraintError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string; constraint?: string }
  if (String(err.code ?? '') !== '23514') return false
  const msg = String(err.message ?? '').toLowerCase()
  const constraint = String(err.constraint ?? '').toLowerCase()
  return msg.includes('deposit_percent') || constraint.includes('deposit_percent')
}

function mapOrderRow(r: Record<string, unknown>): PartnerOrderRow {
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    conversation_id: String(r.conversation_id),
    external_thread_id: String(r.external_thread_id ?? ''),
    status: String(r.status) as PartnerOrderRow['status'],
    customer_name: String(r.customer_name ?? ''),
    customer_email: String(r.customer_email ?? ''),
    customer_phone: String(r.customer_phone ?? ''),
    shipping_address: String(r.shipping_address ?? ''),
    variant_color: String(r.variant_color ?? ''),
    variant_size: String(r.variant_size ?? ''),
    variant_image_urls: String(r.variant_image_urls ?? ''),
    quantity: Math.max(1, Math.floor(num(r.quantity, 1))),
    note: String(r.note ?? ''),
    product_inventory_id: r.product_inventory_id ? String(r.product_inventory_id) : null,
    product_name: String(r.product_name ?? ''),
    product_image_url: String(r.product_image_url ?? ''),
    product_url: String(r.product_url ?? ''),
    unit_price: num(r.unit_price, 0),
    subtotal_amount: num(r.subtotal_amount, 0),
    loyalty_tier_code: String(r.loyalty_tier_code ?? ''),
    loyalty_tier_name: String(r.loyalty_tier_name ?? ''),
    loyalty_discount_percent: num(r.loyalty_discount_percent, 0),
    loyalty_discount_amount: num(r.loyalty_discount_amount, 0),
    birthday_discount_percent: num(r.birthday_discount_percent, 0),
    birthday_discount_amount: num(r.birthday_discount_amount, 0),
    total_discount_percent: num(r.total_discount_percent, 0),
    total_discount_amount: num(r.total_discount_amount, 0),
    amount_after_discount: (() => {
      const raw = num(r.amount_after_discount, 0)
      const subtotal = num(r.subtotal_amount, 0)
      const discount = num(r.total_discount_amount, 0)
      return raw > 0 || subtotal <= 0 ? raw : Math.max(0, subtotal - discount)
    })(),
    deposit_percent: clampPercent(r.deposit_percent, 30),
    required_amount: num(r.required_amount, 0),
    paid_amount: num(r.paid_amount, 0),
    currency: String(r.currency ?? 'VND'),
    payment_reference: String(r.payment_reference ?? ''),
    payment_qr_url: String(r.payment_qr_url ?? ''),
    verified_note: String(r.verified_note ?? ''),
    shipping_status: String(r.shipping_status ?? 'pending') as PartnerOrderRow['shipping_status'],
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    verified_at: r.verified_at ? String(r.verified_at) : null,
    locked_at: r.locked_at ? String(r.locked_at) : null,
    google_sheet_row: (() => {
      const n = Math.floor(num(r.google_sheet_row, 0))
      return n > 0 ? n : null
    })(),
    google_sheet_row_count: (() => {
      const raw = r.google_sheet_row_count
      if (raw == null) return null
      const n = Math.floor(num(raw, 0))
      return n > 0 ? n : null
    })(),
  }
}

function mapOrderLineRow(r: Record<string, unknown>): PartnerOrderLineRow {
  return {
    id: String(r.id),
    order_id: String(r.order_id),
    product_inventory_id: r.product_inventory_id ? String(r.product_inventory_id) : null,
    product_name: String(r.product_name ?? ''),
    product_image_url: String(r.product_image_url ?? ''),
    product_url: String(r.product_url ?? ''),
    unit_price: num(r.unit_price, 0),
    quantity: Math.max(1, Math.min(99, Math.floor(num(r.quantity, 1)))),
    line_subtotal: num(r.line_subtotal, 0),
    variant_color: String(r.variant_color ?? ''),
    variant_size: String(r.variant_size ?? ''),
    variant_image_urls: String(r.variant_image_urls ?? ''),
    note: String(r.note ?? ''),
    sort_order: Math.max(0, Math.floor(num(r.sort_order, 0))),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export type PartnerOrderLineUpsertInput = {
  productInventoryId: string | null
  productName: string
  productImageUrl: string
  productUrl: string
  unitPrice: number
  quantity: number
  variantColor: string
  variantSize: string
  variantImageUrlsJson: string
  note: string
  sortOrder: number
}

export function parseVndAmountFromText(raw: string): number {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

export async function fetchPartnerPaymentSettingsFromPg(partnerId: string): Promise<PartnerPaymentSettingsRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select partner_id::text, bank_name, bank_bin, account_number, account_holder,
              default_deposit_percent,
              coalesce(default_deposit_mode, 'percent') as default_deposit_mode,
              coalesce(default_deposit_amount, 0) as default_deposit_amount,
              notify_email, require_payment_proof,
              coalesce(sepay_enabled, false) as sepay_enabled,
              coalesce(sepay_bank_code, '') as sepay_bank_code,
              coalesce(sepay_account_number, '') as sepay_account_number,
              coalesce(sepay_qr_template, 'compact') as sepay_qr_template,
              coalesce(sepay_webhook_token, '') as sepay_webhook_token,
              coalesce(sepay_secret_key, '') as sepay_secret_key,
              updated_at
       from public.messaging_partner_payment_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return null
    return {
      partner_id: String(row.partner_id),
      bank_name: String(row.bank_name ?? ''),
      bank_bin: String(row.bank_bin ?? ''),
      account_number: String(row.account_number ?? ''),
      account_holder: String(row.account_holder ?? ''),
      default_deposit_percent: clampPercent(row.default_deposit_percent, 30),
      default_deposit_mode:
        String(row.default_deposit_mode ?? 'percent') === 'none'
          ? 'none'
          : String(row.default_deposit_mode ?? 'percent') === 'fixed_amount'
            ? 'fixed_amount'
            : 'percent',
      default_deposit_amount: Math.max(0, num(row.default_deposit_amount, 0)),
      notify_email: String(row.notify_email ?? ''),
      require_payment_proof: row.require_payment_proof !== false,
      sepay_enabled: row.sepay_enabled === true,
      sepay_bank_code: String(row.sepay_bank_code ?? ''),
      sepay_account_number: String(row.sepay_account_number ?? ''),
      sepay_qr_template:
        String(row.sepay_qr_template ?? 'compact') === 'qronly'
          ? 'qronly'
          : String(row.sepay_qr_template ?? 'compact') === ''
            ? ''
            : 'compact',
      sepay_webhook_token: String(row.sepay_webhook_token ?? ''),
      sepay_secret_key: String(row.sepay_secret_key ?? ''),
      updated_at: String(row.updated_at ?? ''),
    }
  } catch (e) {
    if (isMissingPaymentSettingsTableError(e)) return null
    console.warn('[fetchPartnerPaymentSettingsFromPg]', e)
    return null
  }
}

export async function upsertPartnerPaymentSettingsFromPg(input: {
  partnerId: string
  bankName: string
  bankBin: string
  accountNumber: string
  accountHolder: string
  defaultDepositPercent: number
  defaultDepositMode?: 'none' | 'percent' | 'fixed_amount'
  defaultDepositAmount?: number
  notifyEmail: string
  requirePaymentProof: boolean
  sepayEnabled?: boolean
  sepayBankCode?: string
  sepayAccountNumber?: string
  sepayQrTemplate?: '' | 'compact' | 'qronly'
  sepayWebhookToken?: string
  sepaySecretKey?: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_payment_settings (
         partner_id, bank_name, bank_bin, account_number, account_holder,
         default_deposit_percent, default_deposit_mode, default_deposit_amount, notify_email, require_payment_proof,
         sepay_enabled, sepay_bank_code, sepay_account_number, sepay_qr_template, sepay_webhook_token, sepay_secret_key,
         updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16,
         now()
       )
       on conflict (partner_id) do update set
         bank_name = excluded.bank_name,
         bank_bin = excluded.bank_bin,
         account_number = excluded.account_number,
         account_holder = excluded.account_holder,
         default_deposit_percent = excluded.default_deposit_percent,
         default_deposit_mode = excluded.default_deposit_mode,
         default_deposit_amount = excluded.default_deposit_amount,
         notify_email = excluded.notify_email,
         require_payment_proof = excluded.require_payment_proof,
         sepay_enabled = excluded.sepay_enabled,
         sepay_bank_code = excluded.sepay_bank_code,
         sepay_account_number = excluded.sepay_account_number,
         sepay_qr_template = excluded.sepay_qr_template,
         sepay_webhook_token = excluded.sepay_webhook_token,
         sepay_secret_key = excluded.sepay_secret_key,
         updated_at = now()`,
      [
        input.partnerId,
        input.bankName,
        input.bankBin,
        input.accountNumber,
        input.accountHolder,
        clampPercent(input.defaultDepositPercent, 30),
        input.defaultDepositMode === 'none' ? 'none' : input.defaultDepositMode === 'fixed_amount' ? 'fixed_amount' : 'percent',
        Math.max(0, Math.round(num(input.defaultDepositAmount, 0))),
        input.notifyEmail,
        input.requirePaymentProof,
        input.sepayEnabled === true,
        String(input.sepayBankCode ?? '').trim().slice(0, 40),
        String(input.sepayAccountNumber ?? '').trim().slice(0, 40),
        input.sepayQrTemplate === 'qronly' ? 'qronly' : input.sepayQrTemplate === '' ? '' : 'compact',
        String(input.sepayWebhookToken ?? '').trim().slice(0, 120),
        String(input.sepaySecretKey ?? '').trim().slice(0, 180),
      ]
    )
    return true
  } catch (e) {
    if (isMissingPaymentSettingsTableError(e)) return false
    console.warn('[upsertPartnerPaymentSettingsFromPg]', e)
    return false
  }
}

const ORDER_LINE_RETURNING = `id::text, order_id::text, product_inventory_id::text, product_name, product_image_url,
       product_url, unit_price, quantity, line_subtotal, variant_color, variant_size, variant_image_urls,
       note, sort_order, created_at, updated_at`

export async function fetchPartnerOrderLinesFromPg(orderId: string): Promise<PartnerOrderLineRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select ${ORDER_LINE_RETURNING}
       from public.messaging_partner_order_lines
       where order_id = $1::uuid
       order by sort_order asc, created_at asc, id asc`,
      [orderId]
    )
    return rows.map(mapOrderLineRow)
  } catch (e) {
    console.warn('[fetchPartnerOrderLinesFromPg]', e)
    return []
  }
}

export async function replacePartnerOrderLinesFromPg(
  orderId: string,
  lines: PartnerOrderLineUpsertInput[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const cleaned = lines
    .map((line, idx) => {
      const qty = Math.max(1, Math.min(99, Math.floor(num(line.quantity, 1))))
      const unit = Math.max(0, Math.round(num(line.unitPrice, 0)))
      return {
        ...line,
        quantity: qty,
        unitPrice: unit,
        sortOrder: Math.max(0, Math.floor(num(line.sortOrder, idx))),
        lineSubtotal: unit * qty,
      }
    })
    .filter((line) => line.productName.trim() && line.productImageUrl.trim() && line.productUrl.trim())
  if (cleaned.length === 0) return false
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query('delete from public.messaging_partner_order_lines where order_id = $1::uuid', [orderId])
    for (const line of cleaned) {
      await client.query(
        `insert into public.messaging_partner_order_lines (
           order_id, product_inventory_id, product_name, product_image_url, product_url,
           unit_price, quantity, line_subtotal, variant_color, variant_size, variant_image_urls,
           note, sort_order, created_at, updated_at
         ) values (
           $1::uuid, $2::uuid, $3, $4, $5,
           $6::numeric, $7::integer, $8::numeric, $9, $10, $11,
           $12, $13::integer, now(), now()
         )`,
        [
          orderId,
          line.productInventoryId,
          line.productName,
          line.productImageUrl,
          line.productUrl,
          line.unitPrice,
          line.quantity,
          line.lineSubtotal,
          line.variantColor,
          line.variantSize,
          line.variantImageUrlsJson.trim().slice(0, 8000),
          line.note,
          line.sortOrder,
        ]
      )
    }
    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[replacePartnerOrderLinesFromPg]', e)
    return false
  } finally {
    client.release()
  }
}

export async function syncPrimaryPartnerOrderLineFromOrderFromPg(order: PartnerOrderRow): Promise<boolean> {
  return replacePartnerOrderLinesFromPg(order.id, [
    {
      productInventoryId: order.product_inventory_id,
      productName: order.product_name,
      productImageUrl: order.product_image_url,
      productUrl: order.product_url,
      unitPrice: order.unit_price,
      quantity: order.quantity,
      variantColor: order.variant_color,
      variantSize: order.variant_size,
      variantImageUrlsJson: order.variant_image_urls,
      note: order.note,
      sortOrder: 0,
    },
  ])
}

export async function insertPartnerOrderDraftFromPg(input: {
  partnerId: string
  conversationId: string
  externalThreadId: string
  productInventoryId: string | null
  productName: string
  productImageUrl: string
  productUrl: string
  unitPrice: number
  depositPercent: number
  requiredAmount?: number
  customerEmail?: string
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const qty = 1
  const subtotal = Math.max(0, Math.floor(input.unitPrice || 0)) * qty
  const required = Math.max(0, Math.round(num(input.requiredAmount, Math.ceil((subtotal * input.depositPercent) / 100))))
  const runInsert = async (depositPercentValue: number): Promise<PartnerOrderRow | null> => {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_orders (
         partner_id, conversation_id, external_thread_id, status,
         product_inventory_id, product_name, product_image_url, product_url,
         quantity, unit_price, subtotal_amount, deposit_percent, required_amount,
         customer_email, created_at, updated_at
       ) values (
         $1::uuid, $2::uuid, $3, 'awaiting_payment',
         $4::uuid, $5, $6, $7,
         $8, $9::numeric, $10::numeric, $11, $12::numeric,
         $13, now(), now()
       )
       returning id::text, partner_id::text, conversation_id::text, external_thread_id, status,
                 customer_name, customer_email, customer_phone, shipping_address,
                 variant_color, variant_size, variant_image_urls, quantity, note,
                 product_inventory_id::text, product_name, product_image_url, product_url,
                 unit_price, subtotal_amount, deposit_percent, required_amount, paid_amount,
                 currency, payment_reference, payment_qr_url, verified_note, shipping_status,
                 created_at, updated_at, verified_at, locked_at, google_sheet_row, google_sheet_row_count`,
      [
        input.partnerId,
        input.conversationId,
        input.externalThreadId,
        input.productInventoryId,
        input.productName,
        input.productImageUrl,
        input.productUrl,
        qty,
        Math.max(0, input.unitPrice || 0),
        subtotal,
        Math.max(0, Math.min(100, Math.round(num(depositPercentValue, 0)))),
        required,
        String(input.customerEmail ?? '').trim(),
      ]
    )
    const mapped = row ? mapOrderRow(row) : null
    if (mapped) {
      await syncPrimaryPartnerOrderLineFromOrderFromPg(mapped)
    }
    return mapped
  }
  try {
    return await runInsert(input.depositPercent)
  } catch (e) {
    if (isLegacyDepositPercentConstraintError(e)) {
      try {
        const fallbackPercent = Math.round(num(input.depositPercent, 30)) === 100 ? 100 : 30
        return await runInsert(fallbackPercent)
      } catch (e2) {
        console.warn('[insertPartnerOrderDraftFromPg:legacy-retry]', e2)
      }
    }
    console.warn('[insertPartnerOrderDraftFromPg]', e)
    return null
  }
}

export async function updatePartnerOrderCheckoutFromPg(input: {
  orderId: string
  partnerId: string
  conversationId: string
  externalThreadId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  variantColor: string
  variantSize: string
  /** JSON `string[]` — URL ảnh màu/mẫu đã chọn (tối đa ~8k ký tự). */
  variantImageUrlsJson: string
  quantity: number
  note: string
  depositPercent: number
  requiredAmount: number
  paymentReference: string
  paymentQrUrl: string
  discountSnapshot?: PartnerStackedDiscountSnapshot
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const qty = Math.max(1, Math.min(99, Math.floor(input.quantity || 1)))
  const runUpdate = async (depositPercentValue: number): Promise<PartnerOrderRow | null> => {
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_orders
       set customer_name = $5,
           customer_email = $6,
           customer_phone = $7,
           shipping_address = $8,
           variant_color = $9,
           variant_size = $10,
           quantity = $11::integer,
           note = $12,
           variant_image_urls = $13,
           deposit_percent = $14,
           subtotal_amount = coalesce(unit_price, 0::numeric) * $15::numeric,
           required_amount = $16::numeric,
           payment_reference = $17,
           payment_qr_url = $18,
           loyalty_tier_code = $19,
           loyalty_tier_name = $20,
           loyalty_discount_percent = $21::numeric,
           loyalty_discount_amount = $22::numeric,
           birthday_discount_percent = $23::numeric,
           birthday_discount_amount = $24::numeric,
           total_discount_percent = $25::numeric,
           total_discount_amount = $26::numeric,
           amount_after_discount = $27::numeric,
           status = 'awaiting_payment',
           updated_at = now()
       where id = $1::uuid
         and partner_id = $2::uuid
         and conversation_id = $3::uuid
         and external_thread_id = $4
         and locked_at is null
       returning id::text, partner_id::text, conversation_id::text, external_thread_id, status,
                 customer_name, customer_email, customer_phone, shipping_address,
                 variant_color, variant_size, variant_image_urls, quantity, note,
                 product_inventory_id::text, product_name, product_image_url, product_url,
                 unit_price, subtotal_amount,
                 loyalty_tier_code, loyalty_tier_name, loyalty_discount_percent, loyalty_discount_amount,
                 birthday_discount_percent, birthday_discount_amount, total_discount_percent, total_discount_amount,
                 amount_after_discount, deposit_percent, required_amount, paid_amount,
                 currency, payment_reference, payment_qr_url, verified_note, shipping_status,
                 created_at, updated_at, verified_at, locked_at, google_sheet_row, google_sheet_row_count`,
      [
        input.orderId,
        input.partnerId,
        input.conversationId,
        input.externalThreadId,
        input.customerName,
        input.customerEmail,
        input.customerPhone,
        input.shippingAddress,
        input.variantColor,
        input.variantSize,
        qty,
        input.note,
        input.variantImageUrlsJson.trim().slice(0, 8000),
        Math.max(0, Math.min(100, Math.round(num(depositPercentValue, 0)))),
        qty,
        Math.max(0, Math.round(num(input.requiredAmount, 0))),
        input.paymentReference,
        input.paymentQrUrl,
        input.discountSnapshot?.loyaltyTierCode ?? '',
        input.discountSnapshot?.loyaltyTierName ?? '',
        num(input.discountSnapshot?.loyaltyDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.loyaltyDiscountAmount, 0))),
        num(input.discountSnapshot?.birthdayDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.birthdayDiscountAmount, 0))),
        num(input.discountSnapshot?.totalDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.totalDiscountAmount, 0))),
        Math.max(0, Math.round(num(input.discountSnapshot?.amountAfterDiscount, 0))),
      ]
    )
    return row ? mapOrderRow(row) : null
  }
  try {
    return await runUpdate(input.depositPercent)
  } catch (e) {
    if (isLegacyDepositPercentConstraintError(e)) {
      try {
        const fallbackPercent = Math.round(num(input.depositPercent, 30)) === 100 ? 100 : 30
        return await runUpdate(fallbackPercent)
      } catch (e2) {
        console.warn('[updatePartnerOrderCheckoutFromPg:legacy-retry]', e2)
      }
    }
    console.warn('[updatePartnerOrderCheckoutFromPg]', e)
    return null
  }
}

export async function updatePartnerOrderCartCheckoutFromPg(input: {
  orderId: string
  partnerId: string
  conversationId: string
  externalThreadId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  note: string
  subtotalAmount: number
  depositPercent: number
  requiredAmount: number
  paymentReference: string
  paymentQrUrl: string
  primaryLine: PartnerOrderLineUpsertInput
  discountSnapshot?: PartnerStackedDiscountSnapshot
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const subtotal = Math.max(0, Math.round(num(input.subtotalAmount, 0)))
  const runUpdate = async (depositPercentValue: number): Promise<PartnerOrderRow | null> => {
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_orders
       set customer_name = $5,
           customer_email = $6,
           customer_phone = $7,
           shipping_address = $8,
           variant_color = '',
           variant_size = '',
           quantity = $9::integer,
           note = $10,
           variant_image_urls = '',
           product_inventory_id = $11::uuid,
           product_name = $12,
           product_image_url = $13,
           product_url = $14,
           unit_price = $15::numeric,
           deposit_percent = $16,
           subtotal_amount = $17::numeric,
           required_amount = $18::numeric,
           payment_reference = $19,
           payment_qr_url = $20,
           loyalty_tier_code = $21,
           loyalty_tier_name = $22,
           loyalty_discount_percent = $23::numeric,
           loyalty_discount_amount = $24::numeric,
           birthday_discount_percent = $25::numeric,
           birthday_discount_amount = $26::numeric,
           total_discount_percent = $27::numeric,
           total_discount_amount = $28::numeric,
           amount_after_discount = $29::numeric,
           status = 'awaiting_payment',
           updated_at = now()
       where id = $1::uuid
         and partner_id = $2::uuid
         and conversation_id = $3::uuid
         and external_thread_id = $4
         and locked_at is null
       returning id::text, partner_id::text, conversation_id::text, external_thread_id, status,
                 customer_name, customer_email, customer_phone, shipping_address,
                 variant_color, variant_size, variant_image_urls, quantity, note,
                 product_inventory_id::text, product_name, product_image_url, product_url,
                 unit_price, subtotal_amount,
                 loyalty_tier_code, loyalty_tier_name, loyalty_discount_percent, loyalty_discount_amount,
                 birthday_discount_percent, birthday_discount_amount, total_discount_percent, total_discount_amount,
                 amount_after_discount, deposit_percent, required_amount, paid_amount,
                 currency, payment_reference, payment_qr_url, verified_note, shipping_status,
                 created_at, updated_at, verified_at, locked_at, google_sheet_row, google_sheet_row_count`,
      [
        input.orderId,
        input.partnerId,
        input.conversationId,
        input.externalThreadId,
        input.customerName,
        input.customerEmail,
        input.customerPhone,
        input.shippingAddress,
        Math.max(1, Math.min(99, Math.floor(num(input.primaryLine.quantity, 1)))),
        input.note,
        input.primaryLine.productInventoryId,
        input.primaryLine.productName,
        input.primaryLine.productImageUrl,
        input.primaryLine.productUrl,
        Math.max(0, Math.round(num(input.primaryLine.unitPrice, 0))),
        Math.max(0, Math.min(100, Math.round(num(depositPercentValue, 0)))),
        subtotal,
        Math.max(0, Math.round(num(input.requiredAmount, 0))),
        input.paymentReference,
        input.paymentQrUrl,
        input.discountSnapshot?.loyaltyTierCode ?? '',
        input.discountSnapshot?.loyaltyTierName ?? '',
        num(input.discountSnapshot?.loyaltyDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.loyaltyDiscountAmount, 0))),
        num(input.discountSnapshot?.birthdayDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.birthdayDiscountAmount, 0))),
        num(input.discountSnapshot?.totalDiscountPercent, 0),
        Math.max(0, Math.round(num(input.discountSnapshot?.totalDiscountAmount, 0))),
        Math.max(0, Math.round(num(input.discountSnapshot?.amountAfterDiscount, 0))),
      ]
    )
    return row ? mapOrderRow(row) : null
  }
  try {
    return await runUpdate(input.depositPercent)
  } catch (e) {
    if (isLegacyDepositPercentConstraintError(e)) {
      try {
        const fallbackPercent = Math.round(num(input.depositPercent, 30)) === 100 ? 100 : 30
        return await runUpdate(fallbackPercent)
      } catch (e2) {
        console.warn('[updatePartnerOrderCartCheckoutFromPg:legacy-retry]', e2)
      }
    }
    console.warn('[updatePartnerOrderCartCheckoutFromPg]', e)
    return null
  }
}

const ORDER_ROW_SELECT = `select id::text, partner_id::text, conversation_id::text, external_thread_id, status,
              customer_name, customer_email, customer_phone, shipping_address,
              variant_color, variant_size, variant_image_urls, quantity, note,
              product_inventory_id::text, product_name, product_image_url, product_url,
              unit_price, subtotal_amount,
              loyalty_tier_code, loyalty_tier_name, loyalty_discount_percent, loyalty_discount_amount,
              birthday_discount_percent, birthday_discount_amount, total_discount_percent, total_discount_amount,
              amount_after_discount, deposit_percent, required_amount, paid_amount,
              currency, payment_reference, payment_qr_url, verified_note, shipping_status,
              created_at, updated_at, verified_at, locked_at, google_sheet_row, google_sheet_row_count
       from public.messaging_partner_orders`

/** Đọc đơn theo id + shop — dùng khi khách đổi phiên (guest ↔ đăng nhập) vẫn phải khớp đơn nháp. */
export async function fetchPartnerOrderByIdForPartnerFromPg(
  partnerId: string,
  orderId: string
): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const oid = String(orderId ?? '').trim()
  const pid = String(partnerId ?? '').trim()
  if (!oid || !pid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where id = $1::uuid and partner_id = $2::uuid
       limit 1`,
      [oid, pid]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerOrderByIdForPartnerFromPg]', e)
    return null
  }
}

/** Đơn thuộc shop của owner (dashboard). */
export async function fetchPartnerOrderForOwnerFromPg(
  ownerUserId: string,
  orderId: string
): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const oid = String(orderId ?? '').trim()
  const uid = String(ownerUserId ?? '').trim()
  if (!oid || !uid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
              o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
              o.variant_color, o.variant_size, o.variant_image_urls, o.quantity, o.note,
              o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
              o.unit_price, o.subtotal_amount,
              o.loyalty_tier_code, o.loyalty_tier_name, o.loyalty_discount_percent, o.loyalty_discount_amount,
              o.birthday_discount_percent, o.birthday_discount_amount, o.total_discount_percent, o.total_discount_amount,
              o.amount_after_discount, o.deposit_percent, o.required_amount, o.paid_amount,
              o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
              o.created_at, o.updated_at, o.verified_at, o.locked_at, o.google_sheet_row, o.google_sheet_row_count
       from public.messaging_partner_orders o
       inner join public.messaging_partners mp on mp.id = o.partner_id
       where o.id = $1::uuid and ${sqlPartnerMpActorHasPerm(2, 'orders')}
       limit 1`,
      [oid, uid]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerOrderForOwnerFromPg]', e)
    return null
  }
}

/** Danh sách đơn headless API — lọc theo external_thread_id (headless:…) và/hoặc status. */
export async function fetchPartnerOrdersHeadlessPageFromPg(input: {
  partnerId: string
  externalThreadId?: string | null
  status?: PartnerOrderRow['status'] | null
  offset: number
  limit: number
}): Promise<{ rows: PartnerOrderRow[]; count: number } | null> {
  if (!isPgConfigured()) return null
  const pid = String(input.partnerId ?? '').trim()
  if (!pid) return null
  const offset = Math.max(0, Math.floor(input.offset) || 0)
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit) || 24))

  const conditions = ['partner_id = $1::uuid']
  const params: unknown[] = [pid]
  let paramIdx = 2

  const externalThreadId = String(input.externalThreadId ?? '').trim()
  if (externalThreadId) {
    conditions.push(`external_thread_id = $${paramIdx}`)
    params.push(externalThreadId)
    paramIdx += 1
  }

  if (input.status) {
    conditions.push(`status = $${paramIdx}`)
    params.push(input.status)
    paramIdx += 1
  }

  const where = conditions.join(' and ')

  try {
    const countRow = await pgQueryOne<{ count: string }>(
      `select count(*)::text as count
       from public.messaging_partner_orders
       where ${where}`,
      params
    )
    const count = Math.max(0, parseInt(String(countRow?.count ?? '0'), 10) || 0)

    const rows = await pgQuery<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where ${where}
       order by created_at desc
       limit $${paramIdx} offset $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    return { rows: rows.map(mapOrderRow), count }
  } catch (e) {
    console.warn('[fetchPartnerOrdersHeadlessPageFromPg]', e)
    return null
  }
}

/** Đơn theo mã tham chiếu chuyển khoản (uppercase trim). */
export async function fetchPartnerOrderByPaymentReferenceForPartnerFromPg(
  partnerId: string,
  paymentReference: string
): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  const ref = String(paymentReference ?? '').trim().toUpperCase()
  if (!pid || !ref) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where partner_id = $1::uuid
         and upper(trim(payment_reference)) = $2
       order by created_at desc
       limit 1`,
      [pid, ref]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerOrderByPaymentReferenceForPartnerFromPg]', e)
    return null
  }
}

/** Đơn trong cùng hội thoại widget (khách + shop). */
export async function fetchPartnerOrdersForConversationFromPg(
  partnerId: string,
  conversationId: string,
  limit = 80
): Promise<PartnerOrderRow[] | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  const cid = String(conversationId ?? '').trim()
  if (!pid || !cid) return null
  const lim = Math.max(1, Math.min(120, Math.floor(limit) || 80))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where partner_id = $1::uuid and conversation_id = $2::uuid
       order by created_at desc
       limit $3`,
      [pid, cid, lim]
    )
    return rows.map((r) => mapOrderRow(r))
  } catch (e) {
    console.warn('[fetchPartnerOrdersForConversationFromPg]', e)
    return null
  }
}

export async function fetchPartnerOrderForThreadFromPg(input: {
  orderId: string
  partnerId: string
  conversationId: string
  externalThreadId: string
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where id = $1::uuid
         and partner_id = $2::uuid
         and conversation_id = $3::uuid
         and external_thread_id = $4
       limit 1`,
      [input.orderId, input.partnerId, input.conversationId, input.externalThreadId]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerOrderForThreadFromPg]', e)
    return null
  }
}

/** Đơn gần nhất đang chờ cọc — khi khách gửi ảnh biên lai trong chat (không cần bấm nút riêng). */
export type WidgetOrderListRow = PartnerOrderRow & {
  partner_display_name: string
  partner_slug: string
}

function mapWidgetOrderListRow(r: Record<string, unknown>): WidgetOrderListRow {
  return {
    ...mapOrderRow(r),
    partner_display_name: String(r.partner_display_name ?? ''),
    partner_slug: String(r.partner_slug ?? ''),
  }
}

/** Đơn widget của user đã liên kết (cùng nguồn «Tin nhắn của tôi»). */
export async function fetchWidgetOrdersForLinkedUserFromPg(
  linkedUserId: string,
  limit = 120
): Promise<WidgetOrderListRow[] | null> {
  if (!isPgConfigured()) return null
  const uid = String(linkedUserId ?? '').trim()
  if (!uid) return null
  const lim = Math.max(1, Math.min(300, Math.floor(limit) || 120))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
              o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
              o.variant_color, o.variant_size, o.variant_image_urls, o.quantity, o.note,
              o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
              o.unit_price, o.subtotal_amount,
              o.loyalty_tier_code, o.loyalty_tier_name, o.loyalty_discount_percent, o.loyalty_discount_amount,
              o.birthday_discount_percent, o.birthday_discount_amount, o.total_discount_percent, o.total_discount_amount,
              o.amount_after_discount, o.deposit_percent, o.required_amount, o.paid_amount,
              o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
              o.created_at, o.updated_at, o.verified_at, o.locked_at, o.google_sheet_row, o.google_sheet_row_count,
              coalesce(mp.display_name, '') as partner_display_name,
              coalesce(mp.slug, '') as partner_slug
       from public.messaging_partner_orders o
       inner join public.customer_care_conversations c on c.id = o.conversation_id
       inner join public.messaging_partners mp on mp.id = o.partner_id
       where c.channel = 'widget'
         and c.linked_user_id = $1::uuid
         and coalesce(mp.is_active, true) = true
       order by o.created_at desc
       limit $2`,
      [uid, lim]
    )
    return rows.map(mapWidgetOrderListRow)
  } catch (e) {
    console.warn('[fetchWidgetOrdersForLinkedUserFromPg]', e)
    return null
  }
}

export async function fetchLatestAwaitingPaymentOrderForPartnerThreadFromPg(
  partnerId: string,
  externalThreadId: string
): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  const tid = String(externalThreadId ?? '').trim()
  if (!pid || !tid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `${ORDER_ROW_SELECT}
       where partner_id = $1::uuid
         and external_thread_id = $2
         and status = 'awaiting_payment'
         and required_amount > 0
         and locked_at is null
       order by updated_at desc
       limit 1`,
      [pid, tid]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[fetchLatestAwaitingPaymentOrderForPartnerThreadFromPg]', e)
    return null
  }
}

export async function fetchPartnerOrderByPaymentReferenceFromPg(
  partnerId: string,
  paymentReferenceUpper: string
): Promise<
  | {
      id: string
      conversation_id: string
      payment_reference: string
      required_amount: number
      expected_account_number: string
      sepay_webhook_token: string
      sepay_secret_key: string
    }
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select o.id::text, o.conversation_id::text, o.payment_reference, o.required_amount,
              coalesce(ps.account_number, '') as expected_account_number,
              coalesce(ps.sepay_webhook_token, '') as sepay_webhook_token,
              coalesce(ps.sepay_secret_key, '') as sepay_secret_key
       from public.messaging_partner_orders o
       left join public.messaging_partner_payment_settings ps on ps.partner_id = o.partner_id
       where o.partner_id = $1::uuid
         and upper(trim(o.payment_reference)) = $2
       order by o.created_at desc
       limit 1`,
      [partnerId, paymentReferenceUpper]
    )
    if (!row) return null
    return {
      id: String(row.id),
      conversation_id: String(row.conversation_id),
      payment_reference: String(row.payment_reference ?? ''),
      required_amount: num(row.required_amount, 0),
      expected_account_number: String(row.expected_account_number ?? ''),
      sepay_webhook_token: String(row.sepay_webhook_token ?? ''),
      sepay_secret_key: String(row.sepay_secret_key ?? ''),
    }
  } catch (e) {
    console.warn('[fetchPartnerOrderByPaymentReferenceFromPg]', e)
    return null
  }
}

export async function insertPartnerPaymentProofFromPg(input: {
  orderId: string
  imageStoragePath: string
  imageUrl: string
  ocrText: string
  ocrReceiverAccount: string
  ocrAmount: number | null
  ocrTransactionRef: string
  verificationStatus: 'pending' | 'verified' | 'failed' | 'manual_review'
  verificationReason: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_payment_proofs (
         order_id, image_storage_path, image_url, ocr_text, ocr_receiver_account,
         ocr_amount, ocr_transaction_ref, verification_status, verification_reason, created_at
       ) values (
         $1::uuid, $2, $3, $4, $5,
         $6::numeric, $7, $8, $9, now()
       )`,
      [
        input.orderId,
        input.imageStoragePath,
        input.imageUrl,
        input.ocrText,
        input.ocrReceiverAccount,
        input.ocrAmount,
        input.ocrTransactionRef,
        input.verificationStatus,
        input.verificationReason,
      ]
    )
    return true
  } catch (e) {
    console.warn('[insertPartnerPaymentProofFromPg]', e)
    return false
  }
}

export async function updatePartnerOrderPaymentVerificationFromPg(input: {
  orderId: string
  status: PartnerOrderRow['status']
  paidAmount: number
  verifiedNote: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set status = $2,
           paid_amount = $3::numeric,
           verified_note = $4,
           verified_at = case when $2 in ('paid_verified', 'pending_manual_review') then now() else verified_at end,
           locked_at = case when $2 = 'paid_verified' then coalesce(locked_at, now()) else locked_at end,
           updated_at = now()
       where id = $1::uuid`,
      [input.orderId, input.status, Math.max(0, input.paidAmount || 0), input.verifiedNote]
    )
    return true
  } catch (e) {
    console.warn('[updatePartnerOrderPaymentVerificationFromPg]', e)
    return false
  }
}

export type PartnerOrderAdminRow = PartnerOrderRow & {
  partner_display_name: string
  order_item_count: number
  order_items_summary: string
  latest_proof_image_url: string | null
  latest_proof_status: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  latest_proof_reason: string | null
}

/** Tổng hợp đơn chat (cùng bộ lọc workspace + trạng thái với danh sách; không giới hạn 200 dòng). */
export type PartnerOrderOwnerStats = {
  orderCount: number
  countAwaitingPayment: number
  countPaymentChecking: number
  countPaidVerified: number
  countPendingManual: number
  countCancelled: number
  sumSubtotalVnd: number
  sumRequiredVnd: number
  sumPaidVnd: number
  /** Đơn chưa hủy: max(0, subtotal − paid) */
  sumOutstandingVnd: number
}

export async function fetchPartnerOrderStatsForOwnerFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  status?: string | null
  /** Lọc theo ngày tạo đơn (Asia/Ho_Chi_Minh), định dạng YYYY-MM-DD */
  createdFrom?: string | null
  createdTo?: string | null
}): Promise<PartnerOrderOwnerStats | null> {
  if (!isPgConfigured()) return null
  const status = String(input.status ?? '').trim()
  const partnerId = String(input.partnerId ?? '').trim()
  const dateFrom = parseOrderDateFilterParam(input.createdFrom)
  const dateTo = parseOrderDateFilterParam(input.createdTo)
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select count(*)::int as order_count,
              count(*) filter (where o.status = 'awaiting_payment')::int as c_awaiting,
              count(*) filter (where o.status = 'payment_checking')::int as c_checking,
              count(*) filter (where o.status = 'paid_verified')::int as c_paid,
              count(*) filter (where o.status = 'pending_manual_review')::int as c_manual,
              count(*) filter (where o.status = 'cancelled')::int as c_cancelled,
              coalesce(sum(o.subtotal_amount), 0)::double precision as sum_subtotal,
              coalesce(sum(o.required_amount), 0)::double precision as sum_required,
              coalesce(sum(o.paid_amount), 0)::double precision as sum_paid,
              coalesce(sum(
                case
                  when o.status = 'cancelled' then 0::numeric
                  else greatest(
                    0::numeric,
                    coalesce(nullif(o.amount_after_discount, 0), o.subtotal_amount, 0) - coalesce(o.paid_amount, 0)
                  )
                end
              ), 0)::double precision as sum_outstanding
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id and ${sqlPartnerMpActorHasPerm(1, 'orders')}
       where ($2::uuid is null or o.partner_id = $2::uuid)
         and ($3 = '' or o.status = $3)
         and ($4::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $4::date)
         and ($5::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $5::date)`,
      [input.ownerUserId, partnerId || null, status, dateFrom, dateTo]
    )
    if (!row) {
      return {
        orderCount: 0,
        countAwaitingPayment: 0,
        countPaymentChecking: 0,
        countPaidVerified: 0,
        countPendingManual: 0,
        countCancelled: 0,
        sumSubtotalVnd: 0,
        sumRequiredVnd: 0,
        sumPaidVnd: 0,
        sumOutstandingVnd: 0,
      }
    }
    const rnd = (k: string) => Math.round(Number(row[k]) || 0)
    const rni = (k: string) => Math.max(0, Math.floor(Number(row[k]) || 0))
    return {
      orderCount: rni('order_count'),
      countAwaitingPayment: rni('c_awaiting'),
      countPaymentChecking: rni('c_checking'),
      countPaidVerified: rni('c_paid'),
      countPendingManual: rni('c_manual'),
      countCancelled: rni('c_cancelled'),
      sumSubtotalVnd: rnd('sum_subtotal'),
      sumRequiredVnd: rnd('sum_required'),
      sumPaidVnd: rnd('sum_paid'),
      sumOutstandingVnd: rnd('sum_outstanding'),
    }
  } catch (e) {
    console.error('[fetchPartnerOrderStatsForOwnerFromPg]', e)
    return null
  }
}

/** Ngày tạo đơn theo giờ VN; chỉ chấp nhận `YYYY-MM-DD`. */
function parseOrderDateFilterParam(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function mapOrderAdminRow(r: Record<string, unknown>): PartnerOrderAdminRow {
  return {
    ...mapOrderRow(r),
    partner_display_name: String(r.partner_display_name ?? ''),
    order_item_count: Math.max(1, Math.floor(num(r.order_item_count, 1))),
    order_items_summary: String(r.order_items_summary ?? ''),
    latest_proof_image_url: r.latest_proof_image_url ? String(r.latest_proof_image_url) : null,
    latest_proof_status: r.latest_proof_status ? (String(r.latest_proof_status) as PartnerOrderAdminRow['latest_proof_status']) : null,
    latest_proof_reason: r.latest_proof_reason ? String(r.latest_proof_reason) : null,
  }
}

export async function fetchPartnerOrdersForOwnerFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  status?: string | null
  createdFrom?: string | null
  createdTo?: string | null
  limit?: number
}): Promise<PartnerOrderAdminRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(20, Math.min(300, Math.floor(Number(input.limit) || 120)))
  const status = String(input.status ?? '').trim()
  const partnerId = String(input.partnerId ?? '').trim()
  const dateFrom = parseOrderDateFilterParam(input.createdFrom)
  const dateTo = parseOrderDateFilterParam(input.createdTo)
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
              o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
              o.variant_color, o.variant_size, o.variant_image_urls, o.quantity, o.note,
              o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
              o.unit_price, o.subtotal_amount,
              o.loyalty_tier_code, o.loyalty_tier_name, o.loyalty_discount_percent, o.loyalty_discount_amount,
              o.birthday_discount_percent, o.birthday_discount_amount, o.total_discount_percent, o.total_discount_amount,
              o.amount_after_discount, o.deposit_percent, o.required_amount, o.paid_amount,
              o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
              o.created_at, o.updated_at, o.verified_at, o.locked_at, o.google_sheet_row, o.google_sheet_row_count,
              coalesce(mp.display_name, '') as partner_display_name,
              coalesce(ls.order_item_count, 1) as order_item_count,
              coalesce(ls.order_items_summary, '') as order_items_summary,
              lp.image_url as latest_proof_image_url,
              lp.verification_status as latest_proof_status,
              lp.verification_reason as latest_proof_reason
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id and ${sqlPartnerMpActorHasPerm(1, 'orders')}
       left join lateral (
         select count(*)::int as order_item_count,
                string_agg(
                  concat(l.product_name, ' x', l.quantity,
                         case when nullif(trim(l.variant_color), '') is not null then concat(' - ', l.variant_color) else '' end,
                         case when nullif(trim(l.variant_size), '') is not null then concat(' - size ', l.variant_size) else '' end),
                  E'\n' order by l.sort_order asc, l.created_at asc, l.id asc
                ) as order_items_summary
         from public.messaging_partner_order_lines l
         where l.order_id = o.id
       ) ls on true
       left join lateral (
         select image_url, verification_status, verification_reason
         from public.messaging_partner_payment_proofs p
         where p.order_id = o.id
         order by p.created_at desc
         limit 1
       ) lp on true
       where ($2::uuid is null or o.partner_id = $2::uuid)
         and ($3 = '' or o.status = $3)
         and ($4::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $4::date)
         and ($5::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $5::date)
       order by o.created_at desc
       limit $6`,
      [input.ownerUserId, partnerId || null, status, dateFrom, dateTo, lim]
    )
    return rows.map(mapOrderAdminRow)
  } catch (e) {
    console.error('[fetchPartnerOrdersForOwnerFromPg]', e)
    return null
  }
}

const _exportMaxParsed = parseInt(process.env.MESSAGING_PARTNER_ORDERS_EXPORT_MAX || '50000', 10)
const EXPORT_ORDERS_MAX = Math.min(
  100_000,
  Math.max(1000, Number.isFinite(_exportMaxParsed) ? _exportMaxParsed : 50000)
)

/** Xuất Excel: cùng bộ lọc với danh sách đơn, giới hạn tối đa lớn (mặc định 50k). */
export async function fetchPartnerOrdersForOwnerExportFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  status?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}): Promise<PartnerOrderAdminRow[] | null> {
  if (!isPgConfigured()) return null
  const status = String(input.status ?? '').trim()
  const partnerId = String(input.partnerId ?? '').trim()
  const dateFrom = parseOrderDateFilterParam(input.createdFrom)
  const dateTo = parseOrderDateFilterParam(input.createdTo)
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
              o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
              o.variant_color, o.variant_size, o.variant_image_urls, o.quantity, o.note,
              o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
              o.unit_price, o.subtotal_amount,
              o.loyalty_tier_code, o.loyalty_tier_name, o.loyalty_discount_percent, o.loyalty_discount_amount,
              o.birthday_discount_percent, o.birthday_discount_amount, o.total_discount_percent, o.total_discount_amount,
              o.amount_after_discount, o.deposit_percent, o.required_amount, o.paid_amount,
              o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
              o.created_at, o.updated_at, o.verified_at, o.locked_at, o.google_sheet_row, o.google_sheet_row_count,
              coalesce(mp.display_name, '') as partner_display_name,
              coalesce(ls.order_item_count, 1) as order_item_count,
              coalesce(ls.order_items_summary, '') as order_items_summary,
              lp.image_url as latest_proof_image_url,
              lp.verification_status as latest_proof_status,
              lp.verification_reason as latest_proof_reason
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id and ${sqlPartnerMpActorHasPerm(1, 'orders')}
       left join lateral (
         select count(*)::int as order_item_count,
                string_agg(
                  concat(l.product_name, ' x', l.quantity,
                         case when nullif(trim(l.variant_color), '') is not null then concat(' - ', l.variant_color) else '' end,
                         case when nullif(trim(l.variant_size), '') is not null then concat(' - size ', l.variant_size) else '' end),
                  E'\n' order by l.sort_order asc, l.created_at asc, l.id asc
                ) as order_items_summary
         from public.messaging_partner_order_lines l
         where l.order_id = o.id
       ) ls on true
       left join lateral (
         select image_url, verification_status, verification_reason
         from public.messaging_partner_payment_proofs p
         where p.order_id = o.id
         order by p.created_at desc
         limit 1
       ) lp on true
       where ($2::uuid is null or o.partner_id = $2::uuid)
         and ($3 = '' or o.status = $3)
         and ($4::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $4::date)
         and ($5::date is null or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $5::date)
       order by o.created_at desc
       limit $6`,
      [input.ownerUserId, partnerId || null, status, dateFrom, dateTo, EXPORT_ORDERS_MAX]
    )
    return rows.map(mapOrderAdminRow)
  } catch (e) {
    console.warn('[fetchPartnerOrdersForOwnerExportFromPg]', e)
    return null
  }
}

export async function updatePartnerOrderStatusForOwnerFromPg(input: {
  ownerUserId: string
  orderId: string
  status: 'paid_verified' | 'pending_manual_review' | 'cancelled' | 'awaiting_payment' | 'payment_checking'
  verifiedNote: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_orders o
       set status = $3,
           verified_note = $4,
           verified_at = case when $3 in ('paid_verified', 'pending_manual_review') then now() else o.verified_at end,
           locked_at = case when $3 = 'paid_verified' then coalesce(o.locked_at, now()) else o.locked_at end,
           updated_at = now()
       from public.messaging_partners mp
       where o.id = $1::uuid
         and mp.id = o.partner_id
         and ${sqlPartnerMpActorHasPerm(2, 'orders')}`,
      [input.orderId, input.ownerUserId, input.status, input.verifiedNote]
    )
    return true
  } catch (e) {
    console.warn('[updatePartnerOrderStatusForOwnerFromPg]', e)
    return false
  }
}

/** Chủ shop xác nhận cọc thủ công: ghi nhận paid ≥ required (không vượt subtotal), đặt paid_verified. */
export async function confirmPartnerOrderDepositForOwnerFromPg(input: {
  ownerUserId: string
  orderId: string
  verifiedNote: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const note = input.verifiedNote.trim().slice(0, 1000)
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_orders o
       set status = 'paid_verified',
           paid_amount = least(
             coalesce(nullif(o.amount_after_discount, 0), o.subtotal_amount, 0::numeric),
             greatest(coalesce(o.paid_amount, 0::numeric), coalesce(o.required_amount, 0::numeric))
           ),
           verified_note = $3,
           verified_at = now(),
           locked_at = coalesce(o.locked_at, now()),
           updated_at = now()
       from public.messaging_partners mp
       where o.id = $1::uuid
         and mp.id = o.partner_id
         and ${sqlPartnerMpActorHasPerm(2, 'orders')}
       returning o.id::text as id`,
      [input.orderId, input.ownerUserId, note]
    )
    return row !== null
  } catch (e) {
    console.warn('[confirmPartnerOrderDepositForOwnerFromPg]', e)
    return false
  }
}

export async function updatePartnerOrderShippingStatusForOwnerFromPg(input: {
  ownerUserId: string
  orderId: string
  shippingStatus: PartnerOrderRow['shipping_status']
  note: string
}): Promise<PartnerOrderAdminRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_orders o
       set shipping_status = $3,
           verified_note = case when trim($4) <> '' then $4 else o.verified_note end,
           updated_at = now()
       from public.messaging_partners mp
       where o.id = $1::uuid
         and mp.id = o.partner_id
         and ${sqlPartnerMpActorHasPerm(2, 'orders')}
       returning o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
                 o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
                 o.variant_color, o.variant_size, o.variant_image_urls, o.quantity, o.note,
                 o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
                 o.unit_price, o.subtotal_amount,
                 o.loyalty_tier_code, o.loyalty_tier_name, o.loyalty_discount_percent, o.loyalty_discount_amount,
                 o.birthday_discount_percent, o.birthday_discount_amount, o.total_discount_percent, o.total_discount_amount,
                 o.amount_after_discount, o.deposit_percent, o.required_amount, o.paid_amount,
                 o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
                 o.created_at, o.updated_at, o.verified_at, o.locked_at, o.google_sheet_row, o.google_sheet_row_count`,
      [input.orderId, input.ownerUserId, input.shippingStatus, input.note]
    )
    if (!row) return null
    return {
      ...mapOrderRow(row),
      partner_display_name: '',
      order_item_count: 1,
      order_items_summary: '',
      latest_proof_image_url: null,
      latest_proof_status: null,
      latest_proof_reason: null,
    }
  } catch (e) {
    console.warn('[updatePartnerOrderShippingStatusForOwnerFromPg]', e)
    return null
  }
}

export type PartnerOrderEventRow = {
  id: string
  order_id: string
  event_type: string
  title: string
  detail: string
  source: string
  created_by: string
  created_at: string
}

export async function insertPartnerOrderEventFromPg(input: {
  orderId: string
  eventType: string
  title: string
  detail: string
  source?: string
  createdBy?: string
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_order_events (
         order_id, event_type, title, detail, source, created_by, metadata, created_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, coalesce($7::jsonb, '{}'::jsonb), now()
       )`,
      [
        input.orderId,
        input.eventType.trim().slice(0, 60),
        input.title.trim().slice(0, 180),
        input.detail.trim().slice(0, 2000),
        (input.source ?? 'system').trim().slice(0, 40),
        (input.createdBy ?? '').trim().slice(0, 120),
        input.metadata ?? {},
      ]
    )
    return true
  } catch (e) {
    console.warn('[insertPartnerOrderEventFromPg]', e)
    return false
  }
}

export async function fetchPartnerOrderEventsForOwnerFromPg(input: {
  ownerUserId: string
  orderId: string
  limit?: number
}): Promise<PartnerOrderEventRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(10, Math.min(200, Math.floor(Number(input.limit) || 80)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select e.id::text, e.order_id::text, e.event_type, e.title, e.detail, e.source, e.created_by, e.created_at
       from public.messaging_partner_order_events e
       join public.messaging_partner_orders o on o.id = e.order_id
       join public.messaging_partners mp on mp.id = o.partner_id and ${sqlPartnerMpActorHasPerm(1, 'orders')}
       where e.order_id = $2::uuid
       order by e.created_at desc
       limit $3`,
      [input.ownerUserId, input.orderId, lim]
    )
    return rows.map((r) => ({
      id: String(r.id),
      order_id: String(r.order_id),
      event_type: String(r.event_type ?? ''),
      title: String(r.title ?? ''),
      detail: String(r.detail ?? ''),
      source: String(r.source ?? ''),
      created_by: String(r.created_by ?? ''),
      created_at: String(r.created_at ?? ''),
    }))
  } catch (e) {
    console.warn('[fetchPartnerOrderEventsForOwnerFromPg]', e)
    return null
  }
}

/** Lịch sử đơn — khách đã liên kết tài khoản (cùng nguồn «Đơn hàng của tôi»). */
export async function fetchPartnerOrderEventsForLinkedUserFromPg(input: {
  linkedUserId: string
  orderId: string
  limit?: number
}): Promise<PartnerOrderEventRow[] | null> {
  if (!isPgConfigured()) return null
  const uid = String(input.linkedUserId ?? '').trim()
  const oid = String(input.orderId ?? '').trim()
  if (!uid || !oid) return null
  const lim = Math.max(10, Math.min(200, Math.floor(Number(input.limit) || 80)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select e.id::text, e.order_id::text, e.event_type, e.title, e.detail, e.source, e.created_by, e.created_at
       from public.messaging_partner_order_events e
       join public.messaging_partner_orders o on o.id = e.order_id
       join public.customer_care_conversations c on c.id = o.conversation_id
       join public.messaging_partners mp on mp.id = o.partner_id
       where c.channel = 'widget'
         and c.linked_user_id = $1::uuid
         and e.order_id = $2::uuid
         and coalesce(mp.is_active, true) = true
       order by e.created_at desc
       limit $3`,
      [uid, oid, lim]
    )
    return rows.map((r) => ({
      id: String(r.id),
      order_id: String(r.order_id),
      event_type: String(r.event_type ?? ''),
      title: String(r.title ?? ''),
      detail: String(r.detail ?? ''),
      source: String(r.source ?? ''),
      created_by: String(r.created_by ?? ''),
      created_at: String(r.created_at ?? ''),
    }))
  } catch (e) {
    console.warn('[fetchPartnerOrderEventsForLinkedUserFromPg]', e)
    return null
  }
}
