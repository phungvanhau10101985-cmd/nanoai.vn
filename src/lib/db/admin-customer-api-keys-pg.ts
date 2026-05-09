import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type AdminCustomerApiKeyRow = {
  user_id: string
  full_name: string | null
  email: string | null
  role: string | null
  provider: string
  key_hint: string
  is_enabled: boolean
  status: 'unchecked' | 'valid' | 'invalid'
  last_checked_at: string | null
  last_error: string | null
  subscription_plan_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  latest_payment_amount: number | null
  updated_at: string
  created_at: string
}

export type AdminCustomerApiKeyStats = {
  total: number
  enabled: number
  valid: number
  invalid: number
}

export async function pgListAdminCustomerApiKeys(): Promise<{
  rows: AdminCustomerApiKeyRow[]
  stats: AdminCustomerApiKeyStats
  error: string | null
}> {
  const emptyStats = { total: 0, enabled: 0, valid: 0, invalid: 0 }
  if (!isPgConfigured()) return { rows: [], stats: emptyStats, error: 'DATABASE_URL not set' }

  try {
    const rows = await pgQuery<AdminCustomerApiKeyRow>(
      `select k.user_id::text,
              p.full_name,
              nullif(au.email, '') as email,
              p.role,
              k.provider,
              k.key_hint,
              k.is_enabled,
              k.status,
              k.last_checked_at::text,
              k.last_error,
              s.plan_id as subscription_plan_id,
              s.status as subscription_status,
              s.current_period_end::text,
              pay.amount::float8 as latest_payment_amount,
              k.updated_at::text,
              k.created_at::text
       from public.user_ai_api_keys k
       left join public.profiles p on p.id = k.user_id
       left join auth.users au on au.id = k.user_id
       left join public.user_ai_api_key_subscriptions s on s.user_id = k.user_id
       left join public.user_ai_api_key_plan_payments pay on pay.id = s.latest_payment_id
       where lower(coalesce(au.email, '')) not like 'guest-trial-%@guest.nanoai.local'
       order by k.updated_at desc, k.created_at desc`
    )
    const stats = rows.reduce<AdminCustomerApiKeyStats>(
      (acc, row) => {
        acc.total += 1
        if (row.is_enabled) acc.enabled += 1
        if (row.status === 'valid') acc.valid += 1
        if (row.status === 'invalid') acc.invalid += 1
        return acc
      },
      { total: 0, enabled: 0, valid: 0, invalid: 0 }
    )
    return { rows, stats, error: null }
  } catch (e) {
    return { rows: [], stats: emptyStats, error: e instanceof Error ? e.message : String(e) }
  }
}
