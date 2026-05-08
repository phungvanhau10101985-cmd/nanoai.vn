import { isPgConfigured } from '@/lib/db/pool'
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
