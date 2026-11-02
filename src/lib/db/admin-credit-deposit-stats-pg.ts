import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type AdminCreditDepositAggregate = {
  completedCount: number
  sumAmountVnd: number
  sumCreditsAdded: number
  distinctUsers: number
}

export type AdminCreditDepositRow = {
  id: string
  user_id: string | null
  email: string | null
  full_name: string | null
  amount: number
  credits_added: number
  transaction_id: string | null
  transaction_content: string | null
  bank_account: string | null
  bank_name: string | null
  created_at: string | null
  completed_at: string | null
}

/**
 * Giao dịch `payments` đã hoàn thành trong khoảng thời gian
 * (mốc thời gian = coalesce(completed_at, created_at)).
 */
export async function fetchAdminCreditDepositAggregateInRange(
  fromIso: string,
  toIso: string
): Promise<{ data: AdminCreditDepositAggregate | null; error: string | null }> {
  if (!isPgConfigured()) {
    return { data: null, error: 'DATABASE_URL not set' }
  }
  try {
    const row = await pgQueryOne<{
      cnt: string | null
      sum_amount: string | null
      sum_credits: string | null
      distinct_users: string | null
    }>(
      `select count(*)::text as cnt,
              coalesce(sum(amount::numeric), 0)::text as sum_amount,
              coalesce(sum(credits_added::numeric), 0)::text as sum_credits,
              count(distinct user_id)::text as distinct_users
       from public.payments
       where status = 'completed'
         and coalesce(completed_at, created_at) >= $1::timestamptz
         and coalesce(completed_at, created_at) <= $2::timestamptz`,
      [fromIso, toIso]
    )
    const completedCount = Math.max(0, Math.floor(Number(row?.cnt ?? 0)))
    const sumAmountVnd = Number(row?.sum_amount ?? 0)
    const sumCreditsAdded = Number(row?.sum_credits ?? 0)
    const distinctUsers = Math.max(0, Math.floor(Number(row?.distinct_users ?? 0)))
    return {
      data: {
        completedCount,
        sumAmountVnd: Number.isFinite(sumAmountVnd) ? sumAmountVnd : 0,
        sumCreditsAdded: Number.isFinite(sumCreditsAdded) ? sumCreditsAdded : 0,
        distinctUsers,
      },
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { data: null, error: msg }
  }
}

export async function fetchAdminCreditDepositRowsInRange(
  fromIso: string,
  toIso: string,
  limit: number
): Promise<{ rows: AdminCreditDepositRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const lim = Math.min(2000, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      user_id: string | null
      email: string | null
      full_name: string | null
      amount: string | number | null
      credits_added: string | number | null
      transaction_id: string | null
      transaction_content: string | null
      bank_account: string | null
      bank_name: string | null
      created_at: string | null
      completed_at: string | null
    }>(
      `select pay.id::text,
              pay.user_id::text as user_id,
              nullif(au.email, '') as email,
              p.full_name as full_name,
              pay.amount::float8 as amount,
              pay.credits_added::float8 as credits_added,
              pay.transaction_id::text as transaction_id,
              pay.transaction_content,
              pay.bank_account,
              pay.bank_name,
              pay.created_at::text as created_at,
              pay.completed_at::text as completed_at
       from public.payments pay
       left join auth.users au on au.id = pay.user_id
       left join public.profiles p on p.id = pay.user_id
       where pay.status = 'completed'
         and coalesce(pay.completed_at, pay.created_at) >= $1::timestamptz
         and coalesce(pay.completed_at, pay.created_at) <= $2::timestamptz
       order by coalesce(pay.completed_at, pay.created_at) desc
       limit $3`,
      [fromIso, toIso, lim]
    )
    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        user_id: r.user_id ? String(r.user_id) : null,
        email: r.email ? String(r.email) : null,
        full_name: r.full_name ? String(r.full_name) : null,
        amount: Number(r.amount ?? 0),
        credits_added: Number(r.credits_added ?? 0),
        transaction_id: r.transaction_id ? String(r.transaction_id) : null,
        transaction_content: r.transaction_content ? String(r.transaction_content) : null,
        bank_account: r.bank_account ? String(r.bank_account) : null,
        bank_name: r.bank_name ? String(r.bank_name) : null,
        created_at: r.created_at ?? null,
        completed_at: r.completed_at ?? null,
      })),
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}

export type CreditDepositBucket = 'day' | 'month' | 'year'

export type AdminCreditDepositPeriodRow = {
  periodKey: string
  completedCount: number
  distinctUsers: number
  sumAmountVnd: number
  sumCreditsAdded: number
}

function periodTruncSql(bucket: CreditDepositBucket): string {
  const expr = `coalesce(completed_at, created_at) at time zone 'Asia/Ho_Chi_Minh'`
  if (bucket === 'year') return `to_char(${expr}, 'YYYY')`
  if (bucket === 'month') return `to_char(${expr}, 'YYYY-MM')`
  return `to_char(${expr}, 'YYYY-MM-DD')`
}

/** Gom giao dịch nạp đã xong theo ngày, tháng hoặc năm (giờ Việt Nam). */
export async function fetchAdminCreditDepositByPeriodInRange(
  fromIso: string,
  toIso: string,
  bucket: CreditDepositBucket
): Promise<{ rows: AdminCreditDepositPeriodRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const trunc = periodTruncSql(bucket)
  try {
    const rows = await pgQuery<{
      period_key: string | null
      cnt: string | number | null
      distinct_users: string | number | null
      sum_amount: string | number | null
      sum_credits: string | number | null
    }>(
      `select ${trunc} as period_key,
              count(*)::text as cnt,
              count(distinct user_id)::text as distinct_users,
              coalesce(sum(amount::numeric), 0)::text as sum_amount,
              coalesce(sum(credits_added::numeric), 0)::text as sum_credits
       from public.payments
       where status = 'completed'
         and coalesce(completed_at, created_at) >= $1::timestamptz
         and coalesce(completed_at, created_at) <= $2::timestamptz
       group by 1
       order by 1 asc`,
      [fromIso, toIso]
    )
    return {
      rows: rows.map((r) => ({
        periodKey: String(r.period_key ?? ''),
        completedCount: Math.max(0, Math.floor(Number(r.cnt ?? 0))),
        distinctUsers: Math.max(0, Math.floor(Number(r.distinct_users ?? 0))),
        sumAmountVnd: Number(r.sum_amount ?? 0) || 0,
        sumCreditsAdded: Number(r.sum_credits ?? 0) || 0,
      })),
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}

export type AdminPendingCreditDepositRow = {
  id: string
  user_id: string | null
  email: string | null
  full_name: string | null
  amount: number
  credits_added: number
  transaction_content: string | null
  created_at: string | null
}

/** Đơn nạp còn pending — không lọc theo ngày, để admin không bỏ sót mã chờ xác nhận. */
export async function fetchAdminPendingCreditDeposits(
  limit: number
): Promise<{ rows: AdminPendingCreditDepositRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const lim = Math.min(200, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      user_id: string | null
      email: string | null
      full_name: string | null
      amount: string | number | null
      credits_added: string | number | null
      transaction_content: string | null
      created_at: string | null
    }>(
      `select pay.id::text,
              pay.user_id::text as user_id,
              nullif(au.email, '') as email,
              p.full_name as full_name,
              pay.amount::float8 as amount,
              pay.credits_added::float8 as credits_added,
              pay.transaction_content,
              pay.created_at::text as created_at
       from public.payments pay
       left join auth.users au on au.id = pay.user_id
       left join public.profiles p on p.id = pay.user_id
       where pay.status = 'pending'
       order by pay.created_at desc
       limit $1`,
      [lim]
    )
    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        user_id: r.user_id ? String(r.user_id) : null,
        email: r.email ? String(r.email) : null,
        full_name: r.full_name ? String(r.full_name) : null,
        amount: Number(r.amount ?? 0) || 0,
        credits_added: Number(r.credits_added ?? 0) || 0,
        transaction_content: r.transaction_content ? String(r.transaction_content) : null,
        created_at: r.created_at ?? null,
      })),
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}

const PAYMENT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AdminConfirmCreditDepositResult =
  | {
      ok: true
      userId: string
      amount: number
      creditsAdded: number
      orderCode: string
      newBalance: number
    }
  | { ok: false; error: 'invalid_id' | 'not_found' | 'not_pending' | 'database' }

/**
 * Admin xác nhận đơn nạp pending: đánh dấu completed và cộng credit trong một câu SQL.
 * Lần gọi thứ hai trên cùng đơn không cộng thêm.
 */
export async function confirmAdminPendingCreditDeposit(input: {
  paymentId: string
  adminUserId: string
}): Promise<AdminConfirmCreditDepositResult> {
  const paymentId = String(input.paymentId || '').trim()
  const adminUserId = String(input.adminUserId || '').trim()
  if (!PAYMENT_UUID_RE.test(paymentId) || !adminUserId) {
    return { ok: false, error: 'invalid_id' }
  }
  if (!isPgConfigured()) return { ok: false, error: 'database' }

  const unit = Math.max(1, Math.floor(CREDIT_UNIT_PRICE_VND))
  try {
    const pool = getPgPool()
    const updated = await pool.query<{
      user_id: string
      amount: string | number | null
      transaction_content: string | null
      credits_to_add: string | number | null
      balance: string | number | null
    }>(
      `with locked as (
         update public.payments
         set status = 'completed',
             completed_at = now(),
             updated_at = now(),
             transaction_id = coalesce(nullif(transaction_id, ''), 'admin:' || $1::text),
             sepay_data = coalesce(sepay_data, '{}'::jsonb) || jsonb_build_object(
               'source', 'admin_manual',
               'admin_confirmed_by', $2::text,
               'admin_confirmed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
         where id = $1::uuid
           and status = 'pending'
         returning
           user_id,
           amount,
           transaction_content,
           case
             when coalesce(credits_added, 0) > 0 then floor(credits_added)
             else floor(coalesce(amount, 0) / $3::numeric)
           end as credits_to_add
       ),
       credited as (
         insert into public.credits (user_id, balance)
         select user_id, credits_to_add from locked
         on conflict (user_id) do update
           set balance = public.credits.balance + excluded.balance
         returning user_id, balance
       )
       select locked.user_id::text,
              locked.amount::float8 as amount,
              locked.transaction_content,
              locked.credits_to_add::float8 as credits_to_add,
              credited.balance::float8 as balance
       from locked
       join credited on credited.user_id = locked.user_id`,
      [paymentId, adminUserId, unit]
    )
    const row = updated.rows[0]
    if (row?.user_id) {
      return {
        ok: true,
        userId: String(row.user_id),
        amount: Number(row.amount ?? 0) || 0,
        creditsAdded: Number(row.credits_to_add ?? 0) || 0,
        orderCode: String(row.transaction_content || '').trim(),
        newBalance: Number(row.balance ?? 0) || 0,
      }
    }

    const existing = await pgQueryOne<{ status: string | null }>(
      'select status from public.payments where id = $1::uuid limit 1',
      [paymentId]
    )
    if (!existing) return { ok: false, error: 'not_found' }
    return { ok: false, error: 'not_pending' }
  } catch (e) {
    console.error('[confirmAdminPendingCreditDeposit]', e)
    return { ok: false, error: 'database' }
  }
}
