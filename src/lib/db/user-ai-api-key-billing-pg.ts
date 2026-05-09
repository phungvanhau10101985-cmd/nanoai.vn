import { randomBytes } from 'crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { listActivePaymentConfigs } from '@/lib/db/payments-repo'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import {
  BYOK_FIRST_MONTH_DISCOUNT_PERCENT,
  BYOK_PLANS,
  getByokFirstMonthAmount,
  getByokRenewalAmount,
  type ByokPlanId,
} from '@/lib/customer-api-keys/byok-plans'

export type ByokSubscriptionRow = {
  user_id: string
  plan_id: ByokPlanId
  status: 'inactive' | 'active' | 'expired' | 'cancelled'
  current_period_start: string | null
  current_period_end: string | null
  first_month_discount_used: boolean
  latest_payment_id: string | null
  updated_at: string
}

export type ByokPlanPaymentRow = {
  id: string
  user_id: string
  plan_id: ByokPlanId
  amount: number
  regular_amount: number
  discount_percent: number
  period_months: number
  transaction_content: string
  bank_account: string
  bank_name: string
  qr_url: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  transaction_id: string | null
  created_at: string
  completed_at: string | null
}

export async function getByokSubscriptionForUser(userId: string): Promise<ByokSubscriptionRow | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<ByokSubscriptionRow>(
    `select user_id::text, plan_id, status, current_period_start::text, current_period_end::text,
            first_month_discount_used, latest_payment_id::text, updated_at::text
     from public.user_ai_api_key_subscriptions
     where user_id = $1::uuid
     limit 1`,
    [userId]
  )
}

export async function getByokPlanPaymentForUser(paymentId: string, userId: string): Promise<ByokPlanPaymentRow | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<ByokPlanPaymentRow>(
    `select id::text, user_id::text, plan_id, amount::int, regular_amount::int, discount_percent::int,
            period_months::int, transaction_content, bank_account, bank_name, qr_url, status,
            transaction_id, created_at::text, completed_at::text
     from public.user_ai_api_key_plan_payments
     where id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [paymentId, userId]
  )
}

export async function listByokPlanPaymentsForUser(userId: string, limit = 10): Promise<ByokPlanPaymentRow[]> {
  if (!isPgConfigured()) return []
  return pgQuery<ByokPlanPaymentRow>(
    `select id::text, user_id::text, plan_id, amount::int, regular_amount::int, discount_percent::int,
            period_months::int, transaction_content, bank_account, bank_name, qr_url, status,
            transaction_id, created_at::text, completed_at::text
     from public.user_ai_api_key_plan_payments
     where user_id = $1::uuid
     order by created_at desc
     limit $2`,
    [userId, Math.min(50, Math.max(1, limit))]
  )
}

export async function createByokPlanPayment(input: {
  userId: string
  planId: ByokPlanId
}): Promise<ByokPlanPaymentRow> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL is not set')
  const configs = await listActivePaymentConfigs()
  const config = configs[0]
  if (!config) throw new Error('Chưa cấu hình tài khoản nhận thanh toán.')

  const subscription = await getByokSubscriptionForUser(input.userId)
  const firstMonthDiscount = !subscription?.first_month_discount_used
  const regularAmount = getByokRenewalAmount(input.planId)
  const amount = firstMonthDiscount ? getByokFirstMonthAmount(input.planId) : regularAmount
  const discountPercent = firstMonthDiscount ? BYOK_FIRST_MONTH_DISCOUNT_PERCENT : 0
  const token = randomBytes(5).toString('hex').toUpperCase()
  const transactionContent = `BYOK ${token}`
  const qrUrl = buildSePayQrImgUrl({
    acc: config.bank_account,
    bank: config.bank_id,
    amount,
    des: transactionContent,
    template: 'compact',
  })

  const row = await pgQueryOne<ByokPlanPaymentRow>(
    `insert into public.user_ai_api_key_plan_payments (
       user_id, plan_id, amount, regular_amount, discount_percent, period_months,
       transaction_content, bank_account, bank_name, qr_url, status
     ) values ($1::uuid, $2, $3, $4, $5, 1, $6, $7, $8, $9, 'pending')
     returning id::text, user_id::text, plan_id, amount::int, regular_amount::int, discount_percent::int,
               period_months::int, transaction_content, bank_account, bank_name, qr_url, status,
               transaction_id, created_at::text, completed_at::text`,
    [
      input.userId,
      input.planId,
      amount,
      regularAmount,
      discountPercent,
      transactionContent,
      config.bank_account,
      config.bank_name,
      qrUrl,
    ]
  )
  if (!row) throw new Error('Không tạo được giao dịch BYOK.')
  return row
}

export async function sepayFindPendingByokPaymentMatch(
  normalizedContentUpper: string,
  amountIn: number
): Promise<{ id: string; user_id: string; plan_id: ByokPlanId } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ id: string; user_id: string; plan_id: ByokPlanId }>(
    `select id::text, user_id::text, plan_id
     from public.user_ai_api_key_plan_payments
     where status = 'pending'
       and upper(trim(transaction_content)) = $1
       and amount = $2::int
     order by created_at desc
     limit 1`,
    [normalizedContentUpper, Math.round(amountIn)]
  )
}

export async function sepayFindByokPaymentByTransactionId(
  transactionId: string
): Promise<{ id: string; status: string } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ id: string; status: string }>(
    'select id::text, status from public.user_ai_api_key_plan_payments where transaction_id = $1 limit 1',
    [transactionId]
  )
}

export async function completeByokPlanPayment(input: {
  paymentId: string
  transactionId: string | null
  normalizedContent: string
  sepayData: Record<string, unknown>
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const paymentRes = await client.query<{
      user_id: string
      plan_id: ByokPlanId
      period_months: number
      discount_percent: number
    }>(
      `update public.user_ai_api_key_plan_payments
       set status = 'completed',
           transaction_id = $2,
           transaction_content = $3,
           sepay_data = $4::jsonb,
           completed_at = now(),
           updated_at = now()
       where id = $1::uuid and status = 'pending'
       returning user_id::text, plan_id, period_months::int, discount_percent::int`,
      [input.paymentId, input.transactionId, input.normalizedContent, JSON.stringify(input.sepayData)]
    )
    const payment = paymentRes.rows[0]
    if (!payment) {
      await client.query('rollback')
      return { error: 'payment_not_pending_or_not_found' }
    }

    await client.query(
      `insert into public.user_ai_api_key_subscriptions (
         user_id, plan_id, status, current_period_start, current_period_end,
         first_month_discount_used, latest_payment_id
       )
       values (
         $1::uuid,
         $2,
         'active',
         now(),
         now() + ($3::text || ' months')::interval,
         $4,
         $5::uuid
       )
       on conflict (user_id) do update set
         plan_id = excluded.plan_id,
         status = 'active',
         current_period_start = case
           when public.user_ai_api_key_subscriptions.current_period_end > now()
             then public.user_ai_api_key_subscriptions.current_period_start
           else now()
         end,
         current_period_end = case
           when public.user_ai_api_key_subscriptions.current_period_end > now()
             then public.user_ai_api_key_subscriptions.current_period_end + ($3::text || ' months')::interval
           else now() + ($3::text || ' months')::interval
         end,
         first_month_discount_used = public.user_ai_api_key_subscriptions.first_month_discount_used or excluded.first_month_discount_used,
         latest_payment_id = excluded.latest_payment_id`,
      [
        payment.user_id,
        payment.plan_id,
        Math.max(1, payment.period_months || 1),
        payment.discount_percent > 0,
        input.paymentId,
      ]
    )
    await client.query('commit')
    return { ok: true }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { error: e instanceof Error ? e.message : String(e) }
  } finally {
    client.release()
  }
}

export const BYOK_PLAN_IDS = Object.keys(BYOK_PLANS) as ByokPlanId[]
