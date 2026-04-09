import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type AdminProfileWithBalanceRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  balance: number
}

/**
 * Danh sách profile + số dư credits (admin) — nested `credits(balance)` trước đây qua REST.
 */
export async function pgListProfilesWithCreditBalance(): Promise<{
  rows: AdminProfileWithBalanceRow[]
  error: string | null
}> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  try {
    const rows = await pgQuery<AdminProfileWithBalanceRow>(
      `select p.id::text,
              p.full_name,
              p.avatar_url,
              p.role,
              coalesce(c.balance::float8, 0)::float8 as balance
       from public.profiles p
       left join public.credits c on c.user_id = p.id
       order by coalesce(p.full_name, '') asc, p.id::text asc`
    )
    return { rows, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}
