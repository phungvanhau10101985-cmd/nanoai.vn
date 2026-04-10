import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerPaymentSettingsRow = {
  partner_id: string
  bank_name: string
  bank_bin: string
  account_number: string
  account_holder: string
  default_deposit_percent: 30 | 100
  notify_email: string
  require_payment_proof: boolean
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
  quantity: number
  note: string
  product_inventory_id: string | null
  product_name: string
  product_image_url: string
  product_url: string
  unit_price: number
  subtotal_amount: number
  deposit_percent: 30 | 100
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
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
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
    quantity: Math.max(1, Math.floor(num(r.quantity, 1))),
    note: String(r.note ?? ''),
    product_inventory_id: r.product_inventory_id ? String(r.product_inventory_id) : null,
    product_name: String(r.product_name ?? ''),
    product_image_url: String(r.product_image_url ?? ''),
    product_url: String(r.product_url ?? ''),
    unit_price: num(r.unit_price, 0),
    subtotal_amount: num(r.subtotal_amount, 0),
    deposit_percent: num(r.deposit_percent, 30) === 100 ? 100 : 30,
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
  }
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
              default_deposit_percent, notify_email, require_payment_proof, updated_at
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
      default_deposit_percent: num(row.default_deposit_percent, 30) === 100 ? 100 : 30,
      notify_email: String(row.notify_email ?? ''),
      require_payment_proof: row.require_payment_proof !== false,
      updated_at: String(row.updated_at ?? ''),
    }
  } catch (e) {
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
  defaultDepositPercent: 30 | 100
  notifyEmail: string
  requirePaymentProof: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_payment_settings (
         partner_id, bank_name, bank_bin, account_number, account_holder,
         default_deposit_percent, notify_email, require_payment_proof, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, now()
       )
       on conflict (partner_id) do update set
         bank_name = excluded.bank_name,
         bank_bin = excluded.bank_bin,
         account_number = excluded.account_number,
         account_holder = excluded.account_holder,
         default_deposit_percent = excluded.default_deposit_percent,
         notify_email = excluded.notify_email,
         require_payment_proof = excluded.require_payment_proof,
         updated_at = now()`,
      [
        input.partnerId,
        input.bankName,
        input.bankBin,
        input.accountNumber,
        input.accountHolder,
        input.defaultDepositPercent,
        input.notifyEmail,
        input.requirePaymentProof,
      ]
    )
    return true
  } catch (e) {
    console.warn('[upsertPartnerPaymentSettingsFromPg]', e)
    return false
  }
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
  depositPercent: 30 | 100
  customerEmail?: string
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const qty = 1
  const subtotal = Math.max(0, Math.floor(input.unitPrice || 0)) * qty
  const required = Math.ceil((subtotal * input.depositPercent) / 100)
  try {
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
                 variant_color, variant_size, quantity, note,
                 product_inventory_id::text, product_name, product_image_url, product_url,
                 unit_price, subtotal_amount, deposit_percent, required_amount, paid_amount,
                 currency, payment_reference, payment_qr_url, verified_note, shipping_status,
                 created_at, updated_at, verified_at, locked_at`,
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
        input.depositPercent,
        required,
        String(input.customerEmail ?? '').trim(),
      ]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
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
  quantity: number
  note: string
  depositPercent: 30 | 100
  paymentReference: string
  paymentQrUrl: string
}): Promise<PartnerOrderRow | null> {
  if (!isPgConfigured()) return null
  const qty = Math.max(1, Math.min(99, Math.floor(input.quantity || 1)))
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_orders
       set customer_name = $5,
           customer_email = $6,
           customer_phone = $7,
           shipping_address = $8,
           variant_color = $9,
           variant_size = $10,
           quantity = $11,
           note = $12,
           deposit_percent = $13,
           subtotal_amount = coalesce(unit_price, 0) * $11::numeric,
           required_amount = ceil((coalesce(unit_price, 0) * $11::numeric) * ($13::numeric) / 100),
           payment_reference = $14,
           payment_qr_url = $15,
           status = 'awaiting_payment',
           updated_at = now()
       where id = $1::uuid
         and partner_id = $2::uuid
         and conversation_id = $3::uuid
         and external_thread_id = $4
         and locked_at is null
       returning id::text, partner_id::text, conversation_id::text, external_thread_id, status,
                 customer_name, customer_email, customer_phone, shipping_address,
                 variant_color, variant_size, quantity, note,
                 product_inventory_id::text, product_name, product_image_url, product_url,
                 unit_price, subtotal_amount, deposit_percent, required_amount, paid_amount,
                 currency, payment_reference, payment_qr_url, verified_note, shipping_status,
                 created_at, updated_at, verified_at, locked_at`,
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
        input.depositPercent,
        input.paymentReference,
        input.paymentQrUrl,
      ]
    )
    return row ? mapOrderRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerOrderCheckoutFromPg]', e)
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
      `select id::text, partner_id::text, conversation_id::text, external_thread_id, status,
              customer_name, customer_email, customer_phone, shipping_address,
              variant_color, variant_size, quantity, note,
              product_inventory_id::text, product_name, product_image_url, product_url,
              unit_price, subtotal_amount, deposit_percent, required_amount, paid_amount,
              currency, payment_reference, payment_qr_url, verified_note, shipping_status,
              created_at, updated_at, verified_at, locked_at
       from public.messaging_partner_orders
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
  latest_proof_image_url: string | null
  latest_proof_status: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  latest_proof_reason: string | null
}

function mapOrderAdminRow(r: Record<string, unknown>): PartnerOrderAdminRow {
  return {
    ...mapOrderRow(r),
    partner_display_name: String(r.partner_display_name ?? ''),
    latest_proof_image_url: r.latest_proof_image_url ? String(r.latest_proof_image_url) : null,
    latest_proof_status: r.latest_proof_status ? (String(r.latest_proof_status) as PartnerOrderAdminRow['latest_proof_status']) : null,
    latest_proof_reason: r.latest_proof_reason ? String(r.latest_proof_reason) : null,
  }
}

export async function fetchPartnerOrdersForOwnerFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  status?: string | null
  limit?: number
}): Promise<PartnerOrderAdminRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(20, Math.min(300, Math.floor(Number(input.limit) || 120)))
  const status = String(input.status ?? '').trim()
  const partnerId = String(input.partnerId ?? '').trim()
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
              o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
              o.variant_color, o.variant_size, o.quantity, o.note,
              o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
              o.unit_price, o.subtotal_amount, o.deposit_percent, o.required_amount, o.paid_amount,
              o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
              o.created_at, o.updated_at, o.verified_at, o.locked_at,
              coalesce(mp.display_name, '') as partner_display_name,
              lp.image_url as latest_proof_image_url,
              lp.verification_status as latest_proof_status,
              lp.verification_reason as latest_proof_reason
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id and mp.owner_user_id = $1::uuid
       left join lateral (
         select image_url, verification_status, verification_reason
         from public.messaging_partner_payment_proofs p
         where p.order_id = o.id
         order by p.created_at desc
         limit 1
       ) lp on true
       where ($2::uuid is null or o.partner_id = $2::uuid)
         and ($3 = '' or o.status = $3)
       order by o.created_at desc
       limit $4`,
      [input.ownerUserId, partnerId || null, status, lim]
    )
    return rows.map(mapOrderAdminRow)
  } catch (e) {
    console.warn('[fetchPartnerOrdersForOwnerFromPg]', e)
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
         and mp.owner_user_id = $2::uuid`,
      [input.orderId, input.ownerUserId, input.status, input.verifiedNote]
    )
    return true
  } catch (e) {
    console.warn('[updatePartnerOrderStatusForOwnerFromPg]', e)
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
         and mp.owner_user_id = $2::uuid
       returning o.id::text, o.partner_id::text, o.conversation_id::text, o.external_thread_id, o.status,
                 o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
                 o.variant_color, o.variant_size, o.quantity, o.note,
                 o.product_inventory_id::text, o.product_name, o.product_image_url, o.product_url,
                 o.unit_price, o.subtotal_amount, o.deposit_percent, o.required_amount, o.paid_amount,
                 o.currency, o.payment_reference, o.payment_qr_url, o.verified_note, o.shipping_status,
                 o.created_at, o.updated_at, o.verified_at, o.locked_at`,
      [input.orderId, input.ownerUserId, input.shippingStatus, input.note]
    )
    if (!row) return null
    return { ...mapOrderRow(row), partner_display_name: '', latest_proof_image_url: null, latest_proof_status: null, latest_proof_reason: null }
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
       join public.messaging_partners mp on mp.id = o.partner_id and mp.owner_user_id = $1::uuid
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
