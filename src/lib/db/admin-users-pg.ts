import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type AdminProfileWithBalanceRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  email: string | null
  balance: number
  created_at: string | null
}

export type AdminUsersSort = 'name' | 'created' | 'credits'
export type AdminUsersSortDir = 'asc' | 'desc'

export type ListProfilesWithCreditBalanceOptions = {
  /** Tìm theo email (khớp một phần, không phân biệt hoa thường). */
  emailQuery?: string | null
  sort?: AdminUsersSort
  sortDir?: AdminUsersSortDir
}

function buildAdminUsersOrderBy(sort: AdminUsersSort, sortDir: AdminUsersSortDir): string {
  const dir = sortDir === 'asc' ? 'asc' : 'desc'
  if (sort === 'created') {
    return `order by au.created_at ${dir} nulls last, p.id::text asc`
  }
  if (sort === 'credits') {
    return `order by coalesce(c.balance, 0) ${dir}, p.id::text asc`
  }
  return `order by coalesce(p.full_name, '') asc, p.id::text asc`
}

/**
 * Danh sách profile + số dư credits (admin) — nested `credits(balance)` trước đây qua REST.
 */
export async function pgListProfilesWithCreditBalance(
  options?: ListProfilesWithCreditBalanceOptions
): Promise<{
  rows: AdminProfileWithBalanceRow[]
  error: string | null
}> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  try {
    const emailQuery = options?.emailQuery?.trim() ?? ''
    const sort = options?.sort === 'created' || options?.sort === 'credits' ? options.sort : 'name'
    const sortDir = options?.sortDir === 'asc' ? 'asc' : 'desc'
    const params: unknown[] = []
    let emailFilter = ''
    if (emailQuery) {
      params.push(`%${emailQuery.replace(/[%_\\]/g, '')}%`)
      emailFilter = `and coalesce(au.email, '') ilike $${params.length}`
    }

    const rows = await pgQuery<AdminProfileWithBalanceRow>(
      `select p.id::text,
              p.full_name,
              p.avatar_url,
              p.role,
              nullif(au.email, '') as email,
              coalesce(nullif(to_jsonb(p)->>'created_at', ''), au.created_at::text) as created_at,
              coalesce(c.balance::float8, 0)::float8 as balance
       from public.profiles p
       left join auth.users au on au.id = p.id
       left join public.credits c on c.user_id = p.id
       where lower(coalesce(au.email, '')) not like 'guest-trial-%@guest.nanoai.local'
       ${emailFilter}
       ${buildAdminUsersOrderBy(sort, sortDir)}`,
      params.length > 0 ? params : undefined
    )
    return { rows, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}
