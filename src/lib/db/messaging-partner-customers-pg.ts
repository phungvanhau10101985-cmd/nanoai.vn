import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import {
  deleteMessagingPartnerMemberForOwnerFromPg,
  isMessagingPartnerOwnerFromPg,
  upsertMessagingPartnerMemberForOwnerFromPg,
} from '@/lib/db/messaging-partner-members-pg'
import {
  inferLinkedStaffRole,
  linkedModulesForDisplay,
  permissionsForLinkedStaff,
  readStoredStaffRole,
  type LinkedStaffRole,
} from '@/lib/messaging/partner-shop-member-staff'
import type { ShopMemberImportRow } from '@/lib/messaging/partner-shop-member-import'
import { normalizeStaffPermissionsFromJson } from '@/lib/messaging/partner-staff-permissions'
import { serializeStaffPermissions } from '@/lib/messaging/partner-staff-permissions'

/**
 * Khách đã tạo tài khoản shop (`messaging_guest_accounts`).
 * Danh sách quản trị theo mặt 188 «Quản lý thành viên».
 * Khách checkout không tài khoản không hiện. Khách đăng ký nhưng chưa mua vẫn hiện.
 * Tổng chi tiêu / đơn đã giao chỉ tính `paid_verified` + `delivered` (giữ cho báo cáo).
 */

export type PartnerCustomerSummaryRow = {
  id: string
  email: string
  emailNormalized: string
  fullName: string
  phone: string
  customerName: string
  customerPhone: string
  dateOfBirth: string | null
  gender: string | null
  createdAt: string
  updatedAt: string
  lastLogin: string
  isActive: boolean
  isVerified: boolean
  address: string
  avatar: string | null
  hasLinkedAdmin: boolean
  linkedAdminRole: LinkedStaffRole
  linkedAdminModules: string[]
  orderCount: number
  completedOrderCount: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
}

type CustomerDbRow = {
  account_id: string
  email_key: string
  email_raw: string
  customer_name: string
  customer_phone: string
  gender: string | null
  date_of_birth: string | null
  shipping_address: string | null
  avatar_url: string | null
  registered_at: unknown
  updated_at: unknown
  last_login_at: unknown
  first_verified_at: unknown
  is_active: boolean | null
  permissions: unknown
  order_count: number
  completed_order_count: number
  total_spent: string | number
  first_order_at: unknown
  last_order_at: unknown
}

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function iso(v: unknown): string {
  if (!v) return ''
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString()
}

function mapCustomerRow(r: CustomerDbRow): PartnerCustomerSummaryRow {
  const perms = r.permissions ? normalizeStaffPermissionsFromJson(r.permissions) : null
  const storedRole = readStoredStaffRole(r.permissions)
  const linkedAdminRole: LinkedStaffRole = perms ? inferLinkedStaffRole(perms, storedRole) : 'none'
  const hasLinkedAdmin = Boolean(r.permissions) && linkedAdminRole !== 'none'
  const name = r.customer_name ?? ''
  const phone = r.customer_phone ?? ''
  const email = r.email_key ?? ''
  return {
    id: r.account_id,
    email,
    emailNormalized: email,
    fullName: name,
    phone,
    customerName: name,
    customerPhone: phone,
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : null,
    gender: r.gender ?? null,
    createdAt: iso(r.registered_at),
    updatedAt: iso(r.updated_at),
    lastLogin: iso(r.last_login_at),
    isActive: r.is_active !== false,
    isVerified: Boolean(r.first_verified_at),
    address: r.shipping_address ?? '',
    avatar: r.avatar_url ? String(r.avatar_url) : null,
    hasLinkedAdmin,
    linkedAdminRole: hasLinkedAdmin ? linkedAdminRole : 'none',
    linkedAdminModules: hasLinkedAdmin && perms ? linkedModulesForDisplay(linkedAdminRole, perms) : [],
    orderCount: r.order_count ?? 0,
    completedOrderCount: r.completed_order_count ?? 0,
    totalSpent: num(r.total_spent, 0),
    firstOrderAt: iso(r.first_order_at),
    lastOrderAt: iso(r.last_order_at),
  }
}

function listSql(flags: { active: boolean; profileDemo: boolean }) {
  const activeCol = flags.active ? 'coalesce(ga.is_active, true)' : 'true'
  const genderCol = flags.profileDemo ? 'p.gender' : 'null::text'
  const dobCol = flags.profileDemo ? 'p.date_of_birth::text' : 'null::text'
  const searchClause = `/*SEARCH*/`
  return `
    with accounts as (
      select
        ga.id::text as account_id,
        ga.email_normalized as email_key,
        ga.email_raw,
        ga.last_login_at,
        ga.created_at as registered_at,
        ga.updated_at,
        ga.first_verified_at,
        ${activeCol} as is_active
      from public.messaging_guest_accounts ga
      where ga.partner_id = $1::uuid
    ),
    order_agg as (
      select
        lower(trim(customer_email)) as email_key,
        count(*)::int as order_count,
        count(*) filter (
          where status = 'paid_verified' and coalesce(shipping_status, 'pending') = 'delivered'
        )::int as completed_order_count,
        sum(
          case when status = 'paid_verified' and coalesce(shipping_status, 'pending') = 'delivered'
            then greatest(
              0::numeric,
              coalesce(
                nullif(amount_after_discount, 0),
                subtotal_amount - coalesce(total_discount_amount, 0) - coalesce(promo_discount_amount, 0),
                subtotal_amount,
                0
              )
            )
            else 0::numeric
          end
        ) as total_spent,
        max(created_at) as last_order_at,
        min(created_at) as first_order_at
      from public.messaging_partner_orders
      where partner_id = $1::uuid and trim(coalesce(customer_email, '')) <> ''
      group by 1
    ),
    latest_order as (
      select distinct on (lower(trim(customer_email)))
        lower(trim(customer_email)) as email_key,
        customer_name,
        customer_phone
      from public.messaging_partner_orders
      where partner_id = $1::uuid and trim(coalesce(customer_email, '')) <> ''
      order by lower(trim(customer_email)), created_at desc
    )
    select
      a.account_id,
      a.email_key,
      a.email_raw,
      coalesce(nullif(trim(p.customer_name), ''), nullif(trim(lo.customer_name), ''), '') as customer_name,
      coalesce(nullif(trim(p.customer_phone), ''), nullif(trim(lo.customer_phone), ''), '') as customer_phone,
      ${genderCol} as gender,
      ${dobCol} as date_of_birth,
      coalesce(p.shipping_address, '') as shipping_address,
      nullif(trim(coalesce(pr.avatar_url, '')), '') as avatar_url,
      a.registered_at,
      a.updated_at,
      a.last_login_at,
      a.first_verified_at,
      a.is_active,
      mem.permissions,
      coalesce(oa.order_count, 0) as order_count,
      coalesce(oa.completed_order_count, 0) as completed_order_count,
      coalesce(oa.total_spent, 0) as total_spent,
      oa.first_order_at,
      oa.last_order_at
    from accounts a
    left join public.messaging_partner_customer_profiles p
      on p.partner_id = $1::uuid and p.email_normalized = a.email_key
    left join order_agg oa using (email_key)
    left join latest_order lo using (email_key)
    left join auth.users au on lower(trim(coalesce(au.email, ''))) = a.email_key
    left join public.profiles pr on pr.id = au.id
    left join public.messaging_partner_members mem
      on mem.partner_id = $1::uuid and mem.member_user_id = au.id
    where true ${searchClause}
  `
}

function applySearch(sql: string, search: string): { text: string; paramsExtra: string[] } {
  if (!search) return { text: sql.replace('/*SEARCH*/', ''), paramsExtra: [] }
  return {
    text: sql.replace(
      '/*SEARCH*/',
      `and (
         a.email_key ilike $2
         or a.email_raw ilike $2
         or lower(coalesce(nullif(trim(p.customer_name), ''), nullif(trim(lo.customer_name), ''), '')) ilike $2
         or coalesce(nullif(trim(p.customer_phone), ''), nullif(trim(lo.customer_phone), ''), '') ilike $2
       )`
    ),
    paramsExtra: [`%${search}%`],
  }
}

async function runCustomerQuery(input: {
  partnerId: string
  search: string
  pageSize: number
  offset: number
  accountId?: string
}): Promise<{ rows: CustomerDbRow[]; total: number } | null> {
  const flags = { active: true, profileDemo: true }
  const attempts: Array<{ active: boolean; profileDemo: boolean }> = [
    flags,
    { active: false, profileDemo: true },
    { active: true, profileDemo: false },
    { active: false, profileDemo: false },
  ]
  let lastError: unknown = null
  for (const attempt of attempts) {
    try {
      const base = listSql(attempt)
      const { text, paramsExtra } = applySearch(base, input.search)
      const params: unknown[] = [input.partnerId, ...paramsExtra]
      let whereId = ''
      if (input.accountId) {
        params.push(input.accountId)
        whereId = ` and a.account_id = $${params.length}`
      }
      const rows = await pgQuery<CustomerDbRow>(
        `${text}${whereId}
         order by a.registered_at desc nulls last
         limit ${input.pageSize} offset ${input.offset}`,
        params
      )
      const totalParams = input.accountId ? params : params
      const totalRow = await pgQueryOne<{ c: number }>(
        `select count(*)::int as c from (${text}${whereId}) listed`,
        totalParams
      )
      return { rows, total: totalRow?.c ?? rows.length }
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      if (/is_active/i.test(msg) && attempt.active) continue
      if (/gender|date_of_birth/i.test(msg) && attempt.profileDemo) continue
      break
    }
  }
  console.warn('[fetchPartnerCustomersForAdminFromPg]', lastError)
  return null
}

export async function fetchPartnerCustomersForAdminFromPg(input: {
  partnerId: string
  page?: number
  pageSize?: number
  search?: string
}): Promise<{ rows: PartnerCustomerSummaryRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 20)))
  const offset = (page - 1) * pageSize
  const search = (input.search ?? '').trim().toLowerCase()
  const result = await runCustomerQuery({ partnerId: input.partnerId, search, pageSize, offset })
  if (!result) return null
  return { rows: result.rows.map(mapCustomerRow), total: result.total }
}

export async function fetchPartnerCustomerForAdminFromPg(input: {
  partnerId: string
  accountId: string
}): Promise<PartnerCustomerSummaryRow | null> {
  if (!isPgConfigured()) return null
  const result = await runCustomerQuery({
    partnerId: input.partnerId,
    search: '',
    pageSize: 1,
    offset: 0,
    accountId: input.accountId,
  })
  const row = result?.rows[0]
  return row ? mapCustomerRow(row) : null
}

export async function setPartnerCustomerActiveFromPg(input: {
  partnerId: string
  accountId: string
  isActive: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_guest_accounts
       set is_active = $3, updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [input.partnerId, input.accountId, input.isActive]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[setPartnerCustomerActiveFromPg]', e)
    return false
  }
}

async function partnerOwnerUserId(partnerId: string): Promise<string | null> {
  const row = await pgQueryOne<{ owner_user_id: string }>(
    `select owner_user_id::text as owner_user_id
     from public.messaging_partners where id = $1::uuid limit 1`,
    [partnerId]
  )
  return row?.owner_user_id ?? null
}

export async function deletePartnerCustomerAccountFromPg(input: {
  partnerId: string
  accountId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database' }
  const current = await fetchPartnerCustomerForAdminFromPg(input)
  if (!current) return { ok: false, error: 'not_found' }
  try {
    if (current.hasLinkedAdmin && current.email) {
      const userId = await resolveCanonicalUserIdByEmail(current.email)
      const ownerUserId = await partnerOwnerUserId(input.partnerId)
      if (userId && ownerUserId) {
        const isOwner = await isMessagingPartnerOwnerFromPg(input.partnerId, userId)
        if (!isOwner) {
          await deleteMessagingPartnerMemberForOwnerFromPg({
            partnerId: input.partnerId,
            ownerUserId,
            memberUserId: userId,
          })
        }
      }
    }
    await pgQuery(
      `delete from public.messaging_partner_customer_addresses
       where partner_id = $1::uuid and email_normalized = $2`,
      [input.partnerId, current.email]
    ).catch(() => undefined)
    await pgQuery(
      `delete from public.messaging_partner_customer_profiles
       where partner_id = $1::uuid and email_normalized = $2`,
      [input.partnerId, current.email]
    ).catch(() => undefined)
    const removed = await pgQueryOne<{ id: string }>(
      `delete from public.messaging_guest_accounts
       where partner_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [input.partnerId, input.accountId]
    )
    if (!removed?.id) return { ok: false, error: 'not_found' }
    return { ok: true }
  } catch (e) {
    console.warn('[deletePartnerCustomerAccountFromPg]', e)
    return { ok: false, error: 'delete_failed' }
  }
}

export async function setPartnerCustomerLinkedStaffFromPg(input: {
  partnerId: string
  ownerUserId: string
  accountId: string
  staffRole: LinkedStaffRole
  modules?: string[] | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owns = await isMessagingPartnerOwnerFromPg(input.partnerId, input.ownerUserId)
  if (!owns) return { ok: false, error: 'forbidden' }
  const member = await fetchPartnerCustomerForAdminFromPg({
    partnerId: input.partnerId,
    accountId: input.accountId,
  })
  if (!member) return { ok: false, error: 'not_found' }
  if (!member.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
    return { ok: false, error: 'need_email' }
  }
  if (input.staffRole === 'none') {
    const existing = await resolveCanonicalUserIdByEmail(member.email).catch(() => null)
    if (existing) {
      const isOwner = await isMessagingPartnerOwnerFromPg(input.partnerId, existing)
      if (!isOwner) {
        await deleteMessagingPartnerMemberForOwnerFromPg({
          partnerId: input.partnerId,
          ownerUserId: input.ownerUserId,
          memberUserId: existing,
        })
      }
    }
    return { ok: true }
  }
  const userId = await resolveCanonicalUserIdByEmail(member.email)
  if (!userId) return { ok: false, error: 'need_email' }
  if (await isMessagingPartnerOwnerFromPg(input.partnerId, userId)) {
    return { ok: false, error: 'is_owner' }
  }
  const perms = permissionsForLinkedStaff(input.staffRole, input.modules)
  const saved = await upsertMessagingPartnerMemberForOwnerFromPg({
    partnerId: input.partnerId,
    ownerUserId: input.ownerUserId,
    memberUserId: userId,
    permissions: perms,
  })
  if (!saved.ok) return { ok: false, error: saved.error || 'insert_failed' }
  const withRole = {
    ...serializeStaffPermissions(perms),
    staff_role: input.staffRole,
  }
  try {
    await pgQuery(
      `update public.messaging_partner_members
       set permissions = $3::jsonb, updated_at = now()
       where partner_id = $1::uuid and member_user_id = $2::uuid`,
      [input.partnerId, userId, JSON.stringify(withRole)]
    )
  } catch (e) {
    console.warn('[setPartnerCustomerLinkedStaffFromPg] staff_role', e)
  }
  return { ok: true }
}

export async function importPartnerShopMembersFromPg(input: {
  partnerId: string
  rows: ShopMemberImportRow[]
}): Promise<{ created: number; updated: number; skipped: number; invalid: number }> {
  let created = 0
  let updated = 0
  let skipped = 0
  let invalid = 0
  for (const row of input.rows) {
    if (!row.email) {
      invalid += 1
      continue
    }
    const existing = await pgQueryOne<{ id: string; phone: string | null; name: string | null; gender: string | null; dob: string | null }>(
      `select ga.id::text,
              nullif(trim(p.customer_phone), '') as phone,
              nullif(trim(p.customer_name), '') as name,
              p.gender,
              p.date_of_birth::text as dob
       from public.messaging_guest_accounts ga
       left join public.messaging_partner_customer_profiles p
         on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
       where ga.partner_id = $1::uuid and ga.email_normalized = $2
       limit 1`,
      [input.partnerId, row.email]
    ).catch(async () =>
      pgQueryOne<{ id: string; phone: string | null; name: string | null; gender: string | null; dob: string | null }>(
        `select ga.id::text,
                nullif(trim(p.customer_phone), '') as phone,
                nullif(trim(p.customer_name), '') as name,
                null::text as gender,
                null::text as dob
         from public.messaging_guest_accounts ga
         left join public.messaging_partner_customer_profiles p
           on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
         where ga.partner_id = $1::uuid and ga.email_normalized = $2
         limit 1`,
        [input.partnerId, row.email]
      )
    )
    if (!existing?.id) {
      const inserted = await pgQueryOne<{ id: string }>(
        `insert into public.messaging_guest_accounts (
           partner_id, email_raw, email_normalized, first_verified_at, last_login_at
         ) values ($1::uuid, $2, $3, now(), now())
         on conflict (partner_id, email_normalized) do nothing
         returning id::text`,
        [input.partnerId, row.email, row.email]
      )
      if (!inserted?.id) {
        skipped += 1
        continue
      }
      created += 1
    } else {
      const same =
        (existing.name || '') === row.name &&
        (existing.phone || '') === (row.phone || '') &&
        (existing.gender || null) === row.gender &&
        (existing.dob || '').slice(0, 10) === (row.birthday || '')
      if (same && !row.name && !row.phone && !row.gender && !row.birthday) {
        skipped += 1
        continue
      }
      if (same) {
        skipped += 1
        continue
      }
      updated += 1
    }
    if (row.name || row.phone || row.gender || row.birthday) {
      await pgQuery(
        `insert into public.messaging_partner_customer_profiles (
           partner_id, email_normalized, email_raw, customer_name, customer_phone, shipping_address,
           gender, date_of_birth, created_at, updated_at
         ) values ($1::uuid, $2, $2, $3, $4, '', $5, $6::date, now(), now())
         on conflict (partner_id, email_normalized) do update set
           customer_name = case when excluded.customer_name <> '' then excluded.customer_name else messaging_partner_customer_profiles.customer_name end,
           customer_phone = case when excluded.customer_phone <> '' then excluded.customer_phone else messaging_partner_customer_profiles.customer_phone end,
           gender = coalesce(excluded.gender, messaging_partner_customer_profiles.gender),
           date_of_birth = coalesce(excluded.date_of_birth, messaging_partner_customer_profiles.date_of_birth),
           updated_at = now()`,
        [input.partnerId, row.email, row.name, row.phone || '', row.gender, row.birthday]
      ).catch(async () => {
        await pgQuery(
          `insert into public.messaging_partner_customer_profiles (
             partner_id, email_normalized, email_raw, customer_name, customer_phone, shipping_address, created_at, updated_at
           ) values ($1::uuid, $2, $2, $3, $4, '', now(), now())
           on conflict (partner_id, email_normalized) do update set
             customer_name = case when excluded.customer_name <> '' then excluded.customer_name else messaging_partner_customer_profiles.customer_name end,
             customer_phone = case when excluded.customer_phone <> '' then excluded.customer_phone else messaging_partner_customer_profiles.customer_phone end,
             updated_at = now()`,
          [input.partnerId, row.email, row.name, row.phone || '']
        )
      })
    }
  }
  return { created, updated, skipped, invalid }
}
