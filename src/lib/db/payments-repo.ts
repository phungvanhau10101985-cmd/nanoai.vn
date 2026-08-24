import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PaymentListRow = {
  id: string
  amount: number
  credits_added: number
  status: string
  qr_url: string | null
  transaction_content: string | null
  bank_account: string | null
  bank_name: string | null
  created_at: string
  completed_at: string | null
  transaction_id: string | null
}

export type PaymentConfigRow = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name: string | null
  qr_template_url: string
  is_active: boolean
}

export async function listActivePaymentConfigs(): Promise<PaymentConfigRow[]> {
  if (!isPgConfigured()) {
    console.warn('[listActivePaymentConfigs] DATABASE_URL not set')
    return []
  }
  try {
    return await pgQuery<PaymentConfigRow>(
      `select id, bank_account, bank_id, bank_name, account_holder_name, qr_template_url, is_active
       from public.payment_configs
       where is_active = true
       order by created_at asc`
    )
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') {
      console.warn('[listActivePaymentConfigs] missing table public.payment_configs — chạy db:migrate:push (20260418120000_create_public_payment_configs.sql)')
      return []
    }
    throw e
  }
}

export async function listPaymentsForUser(
  userId: string,
  opts: { limit: number; status?: string | null }
): Promise<PaymentListRow[]> {
  const lim = Math.min(500, Math.max(1, opts.limit))
  if (!isPgConfigured()) {
    console.warn('[listPaymentsForUser] DATABASE_URL not set')
    return []
  }
  if (opts.status && opts.status !== 'all') {
    return pgQuery<PaymentListRow>(
      `select id::text, amount::float8, credits_added::float8, status,
              qr_url, transaction_content, bank_account, bank_name,
              created_at::text, completed_at::text, transaction_id::text
       from public.payments
       where user_id = $1::uuid and status = $2
       order by created_at desc
       limit $3`,
      [userId, opts.status, lim]
    )
  }
  return pgQuery<PaymentListRow>(
    `select id::text, amount::float8, credits_added::float8, status,
            qr_url, transaction_content, bank_account, bank_name,
            created_at::text, completed_at::text, transaction_id::text
     from public.payments
     where user_id = $1::uuid
     order by created_at desc
     limit $2`,
    [userId, lim]
  )
}

export async function getPaymentByIdForUser(paymentId: string, userId: string): Promise<PaymentListRow | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<PaymentListRow>(
    `select id::text, amount::float8, credits_added::float8, status,
            qr_url, transaction_content, bank_account, bank_name,
            created_at::text, completed_at::text, transaction_id::text
     from public.payments
     where id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [paymentId, userId]
  )
}

export async function insertPendingPayment(input: {
  userId: string
  amount: number
  creditsAdded: number
  transactionContent: string
  bankAccount: string
  bankName: string
  qrUrl: string
}): Promise<PaymentListRow> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is required to create payments')
  }
  const row = await pgQueryOne<PaymentListRow>(
    `insert into public.payments (
      user_id, amount, credits_added, transaction_content, bank_account, bank_name, qr_url, status
    ) values ($1::uuid, $2::numeric, $3::numeric, $4, $5, $6, $7, 'pending')
    returning id::text, amount::float8, credits_added::float8, status,
              qr_url, transaction_content, bank_account, bank_name,
              created_at::text, completed_at::text, transaction_id::text`,
    [
      input.userId,
      input.amount,
      input.creditsAdded,
      input.transactionContent,
      input.bankAccount,
      input.bankName,
      input.qrUrl,
    ]
  )
  if (!row) throw new Error('insert payment returned no row')
  return row
}

/** SePay webhook — tra cứu theo transaction_id (idempotency). */
export async function sepayFindPaymentByTransactionId(
  transactionId: string
): Promise<{ id: string; status: string } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ id: string; status: string }>(
    'select id::text, status from public.payments where transaction_id = $1 limit 1',
    [transactionId]
  )
}

/** SePay: khớp giao dịch pending theo nội dung CK (đã upper) và số tiền. */
export async function sepayFindPendingPaymentMatch(
  normalizedContentUpper: string,
  amountIn: number
): Promise<{ id: string; user_id: string } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ id: string; user_id: string }>(
    `select id::text, user_id::text
     from public.payments
     where status = 'pending'
       and upper(trim(transaction_content)) = $1
       and amount = $2::numeric
     order by created_at desc
     limit 1`,
    [normalizedContentUpper, amountIn]
  )
}

export async function sepayMarkPaymentCompleted(input: {
  paymentId: string
  transactionId: string | null
  normalizedContent: string
  bankAccount: string | null
  bankName: string | null
  sepayData: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.payments set
        status = 'completed',
        transaction_id = $2,
        transaction_content = $3,
        bank_account = $4,
        bank_name = $5,
        sepay_data = $6::jsonb,
        completed_at = now(),
        updated_at = now()
      where id = $1::uuid`,
      [
        input.paymentId,
        input.transactionId,
        input.normalizedContent,
        input.bankAccount,
        input.bankName,
        JSON.stringify(input.sepayData),
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/** Admin `/admin/payment-config` — danh sách đầy đủ (kèm created_at). */
export type PaymentConfigAdminRow = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name: string | null
  qr_template_url: string
  is_active: boolean | null
  created_at: string | null
}

export async function listPaymentConfigsAllFromPg(): Promise<PaymentConfigAdminRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery<PaymentConfigAdminRow>(
      `select id::text, bank_account, bank_id, bank_name, account_holder_name,
              qr_template_url, is_active, created_at::text
       from public.payment_configs
       order by created_at asc nulls last`
    )
  } catch (e) {
    console.warn('[listPaymentConfigsAllFromPg]', e)
    return null
  }
}

export async function upsertPaymentConfigPg(input: {
  id?: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name: string | null
  qr_template_url: string
  is_active: boolean
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    const pool = getPgPool()
    if (input.id) {
      await pool.query(
        `update public.payment_configs set
          bank_account = $1,
          bank_id = $2,
          bank_name = $3,
          account_holder_name = $4,
          qr_template_url = $5,
          is_active = $6,
          updated_at = timezone('utc'::text, now())
         where id = $7::uuid`,
        [
          input.bank_account,
          input.bank_id,
          input.bank_name,
          input.account_holder_name,
          input.qr_template_url,
          input.is_active,
          input.id,
        ]
      )
    } else {
      await pool.query(
        `insert into public.payment_configs (bank_account, bank_id, bank_name, account_holder_name, qr_template_url, is_active)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          input.bank_account,
          input.bank_id,
          input.bank_name,
          input.account_holder_name,
          input.qr_template_url,
          input.is_active,
        ]
      )
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[upsertPaymentConfigPg]', e)
    return { error: msg }
  }
}

export function maskSepayHmacSecret(secret: string | null | undefined): { configured: boolean; last4: string | null } {
  const v = String(secret ?? '').trim()
  if (!v) return { configured: false, last4: null }
  return { configured: true, last4: v.slice(-4) }
}

export async function getSepayWebhookHmacSecretFromPg(): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ hmac_secret: string | null }>(
      'select hmac_secret from public.sepay_webhook_settings where id = 1 limit 1'
    )
    const v = String(row?.hmac_secret ?? '').trim()
    return v || null
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') return null
    console.warn('[getSepayWebhookHmacSecretFromPg]', e)
    return null
  }
}

export async function getSepayWebhookHmacSecretStatusFromPg(): Promise<{
  configured: boolean
  last4: string | null
}> {
  const secret = await getSepayWebhookHmacSecretFromPg()
  return maskSepayHmacSecret(secret)
}

export async function upsertSepayWebhookHmacSecretPg(
  hmacSecret: string
): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  const v = hmacSecret.trim()
  if (!v) return { error: 'secret_required' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.sepay_webhook_settings (id, hmac_secret, updated_at)
       values (1, $1, timezone('utc'::text, now()))
       on conflict (id) do update set hmac_secret = excluded.hmac_secret, updated_at = excluded.updated_at`,
      [v]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[upsertSepayWebhookHmacSecretPg]', e)
    return { error: msg }
  }
}

export async function deletePaymentConfigPg(id: string): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    const pool = getPgPool()
    await pool.query('delete from public.payment_configs where id = $1::uuid', [id])
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[deletePaymentConfigPg]', e)
    return { error: msg }
  }
}
