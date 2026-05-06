import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'

export type PartnerLoyaltySettingsRow = {
  partner_id: string
  enabled: boolean
  spend_window_days: number
  max_total_discount_percent: number
  updated_at: string
}

export type PartnerLoyaltyTierRow = {
  id: string
  partner_id: string
  tier_code: string
  tier_name: string
  min_spend_6_months: number
  discount_percent: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PartnerCustomerLoyaltyStatus = {
  enabled: boolean
  spendWindowDays: number
  totalSpent: number
  tier: PartnerLoyaltyTierRow | null
  nextTier: PartnerLoyaltyTierRow | null
  amountToNextTier: number
  maxTotalDiscountPercent: number
}

export type PartnerLoyaltyCustomerIdentity = {
  emailNormalized?: string | null
  linkedUserId?: string | null
  guestAccountId?: string | null
}

export type PartnerStackedDiscountSnapshot = {
  loyaltyTierCode: string
  loyaltyTierName: string
  loyaltyDiscountPercent: number
  loyaltyDiscountAmount: number
  birthdayDiscountPercent: number
  birthdayDiscountAmount: number
  totalDiscountPercent: number
  totalDiscountAmount: number
  amountAfterDiscount: number
}

const DEFAULT_TIERS = [
  { tierCode: 'L1', tierName: 'L1', minSpend6Months: 0, discountPercent: 0, sortOrder: 0 },
  { tierCode: 'L2', tierName: 'L2', minSpend6Months: 4_000_000, discountPercent: 2, sortOrder: 1 },
  { tierCode: 'L3', tierName: 'L3', minSpend6Months: 8_000_000, discountPercent: 4, sortOrder: 2 },
  { tierCode: 'L4', tierName: 'L4', minSpend6Months: 12_000_000, discountPercent: 6, sortOrder: 3 },
  { tierCode: 'L5', tierName: 'L5', minSpend6Months: 20_000_000, discountPercent: 10, sortOrder: 4 },
]

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function money(v: unknown): number {
  return Math.max(0, Math.round(num(v, 0)))
}

function percent(v: unknown, fallback = 0): number {
  const n = num(v, fallback)
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100))
}

function normalizedEmail(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().slice(0, 180)
}

function normalizedUuid(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : ''
}

function mapSettingsRow(r: Record<string, unknown>): PartnerLoyaltySettingsRow {
  return {
    partner_id: String(r.partner_id),
    enabled: r.enabled !== false,
    spend_window_days: Math.max(30, Math.min(730, Math.floor(num(r.spend_window_days, 180)))),
    max_total_discount_percent: percent(r.max_total_discount_percent, 30),
    updated_at: String(r.updated_at ?? ''),
  }
}

function mapTierRow(r: Record<string, unknown>): PartnerLoyaltyTierRow {
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    tier_code: String(r.tier_code ?? ''),
    tier_name: String(r.tier_name ?? ''),
    min_spend_6_months: money(r.min_spend_6_months),
    discount_percent: percent(r.discount_percent, 0),
    sort_order: Math.floor(num(r.sort_order, 0)),
    is_active: r.is_active !== false,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function ensureDefaultPartnerLoyaltyFromPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = normalizedUuid(partnerId)
  if (!pid) return false
  try {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(
        `insert into public.messaging_partner_loyalty_settings (
           partner_id, enabled, spend_window_days, max_total_discount_percent
         ) values ($1::uuid, true, 180, 30)
         on conflict (partner_id) do nothing`,
        [pid]
      )
      for (const t of DEFAULT_TIERS) {
        await client.query(
          `insert into public.messaging_partner_loyalty_tiers (
             partner_id, tier_code, tier_name, min_spend_6_months, discount_percent, sort_order, is_active
           ) values ($1::uuid, $2, $3, $4::numeric, $5::numeric, $6, true)
           on conflict (partner_id, tier_code) do nothing`,
          [pid, t.tierCode, t.tierName, t.minSpend6Months, t.discountPercent, t.sortOrder]
        )
      }
      await client.query('commit')
      return true
    } catch (e) {
      await client.query('rollback')
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.warn('[ensureDefaultPartnerLoyaltyFromPg]', e)
    return false
  }
}

export async function fetchPartnerLoyaltySettingsFromPg(partnerId: string): Promise<PartnerLoyaltySettingsRow | null> {
  if (!isPgConfigured()) return null
  const pid = normalizedUuid(partnerId)
  if (!pid) return null
  try {
    await ensureDefaultPartnerLoyaltyFromPg(pid)
    const row = await pgQueryOne<Record<string, unknown>>(
      `select partner_id::text, enabled, spend_window_days, max_total_discount_percent, updated_at::text
       from public.messaging_partner_loyalty_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    return row ? mapSettingsRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerLoyaltySettingsFromPg]', e)
    return null
  }
}

export async function listPartnerLoyaltyTiersFromPg(partnerId: string): Promise<PartnerLoyaltyTierRow[] | null> {
  if (!isPgConfigured()) return null
  const pid = normalizedUuid(partnerId)
  if (!pid) return null
  try {
    await ensureDefaultPartnerLoyaltyFromPg(pid)
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, tier_code, tier_name, min_spend_6_months, discount_percent,
              sort_order, is_active, created_at::text, updated_at::text
       from public.messaging_partner_loyalty_tiers
       where partner_id = $1::uuid
       order by min_spend_6_months asc, sort_order asc, tier_code asc`,
      [pid]
    )
    return rows.map(mapTierRow)
  } catch (e) {
    console.warn('[listPartnerLoyaltyTiersFromPg]', e)
    return null
  }
}

export async function fetchPartnerLoyaltyDashboardForActorFromPg(input: {
  actorUserId: string
  partnerId: string
}): Promise<{ settings: PartnerLoyaltySettingsRow; tiers: PartnerLoyaltyTierRow[] } | null> {
  if (!isPgConfigured()) return null
  const pid = normalizedUuid(input.partnerId)
  if (!pid) return null
  try {
    const allowed = await pgQueryOne<{ id: string }>(
      `select mp.id::text as id
       from public.messaging_partners mp
       where mp.id = $1::uuid
         and coalesce(mp.industry_key, 'fashion') <> 'hotel'
         and ${sqlPartnerMpActorHasPerm(2, 'orders')}
       limit 1`,
      [pid, input.actorUserId]
    )
    if (!allowed) return null
    const settings = await fetchPartnerLoyaltySettingsFromPg(pid)
    const tiers = await listPartnerLoyaltyTiersFromPg(pid)
    if (!settings || !tiers) return null
    return { settings, tiers }
  } catch (e) {
    console.warn('[fetchPartnerLoyaltyDashboardForActorFromPg]', e)
    return null
  }
}

export async function updatePartnerLoyaltyDashboardForActorFromPg(input: {
  actorUserId: string
  partnerId: string
  enabled: boolean
  spendWindowDays: number
  maxTotalDiscountPercent: number
  tiers: Array<{
    id?: string | null
    tierCode: string
    tierName: string
    minSpend6Months: number
    discountPercent: number
    sortOrder: number
    isActive: boolean
  }>
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = normalizedUuid(input.partnerId)
  if (!pid) return false
  const cleaned = input.tiers
    .map((t, i) => ({
      id: normalizedUuid(t.id ?? ''),
      tierCode: String(t.tierCode ?? '').trim().slice(0, 24).toUpperCase() || `L${i + 1}`,
      tierName: String(t.tierName ?? '').trim().slice(0, 80) || `L${i + 1}`,
      minSpend6Months: money(t.minSpend6Months),
      discountPercent: percent(t.discountPercent, 0),
      sortOrder: Math.max(0, Math.floor(num(t.sortOrder, i))),
      isActive: t.isActive !== false,
    }))
    .slice(0, 20)
  if (cleaned.length === 0) return false
  try {
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await client.query('begin')
      const allowed = await client.query<{ id: string }>(
        `select mp.id::text as id
         from public.messaging_partners mp
         where mp.id = $1::uuid
           and coalesce(mp.industry_key, 'fashion') <> 'hotel'
           and ${sqlPartnerMpActorHasPerm(2, 'orders')}
         limit 1`,
        [pid, input.actorUserId]
      )
      if (allowed.rowCount !== 1) {
        await client.query('rollback')
        return false
      }
      await client.query(
        `insert into public.messaging_partner_loyalty_settings (
           partner_id, enabled, spend_window_days, max_total_discount_percent, updated_at
         ) values ($1::uuid, $2, $3, $4::numeric, now())
         on conflict (partner_id) do update set
           enabled = excluded.enabled,
           spend_window_days = excluded.spend_window_days,
           max_total_discount_percent = excluded.max_total_discount_percent,
           updated_at = now()`,
        [
          pid,
          input.enabled === true,
          Math.max(30, Math.min(730, Math.floor(num(input.spendWindowDays, 180)))),
          percent(input.maxTotalDiscountPercent, 30),
        ]
      )
      const keepIds: string[] = []
      for (const t of cleaned) {
        const row = await client.query<{ id: string }>(
          `insert into public.messaging_partner_loyalty_tiers (
             partner_id, tier_code, tier_name, min_spend_6_months, discount_percent, sort_order, is_active
           ) values ($1::uuid, $2, $3, $4::numeric, $5::numeric, $6, $7)
           on conflict (partner_id, tier_code) do update set
             tier_name = excluded.tier_name,
             min_spend_6_months = excluded.min_spend_6_months,
             discount_percent = excluded.discount_percent,
             sort_order = excluded.sort_order,
             is_active = excluded.is_active,
             updated_at = now()
           returning id::text`,
          [pid, t.tierCode, t.tierName, t.minSpend6Months, t.discountPercent, t.sortOrder, t.isActive]
        )
        const id = row.rows[0]?.id
        if (id) keepIds.push(id)
      }
      if (keepIds.length > 0) {
        await client.query(
          `update public.messaging_partner_loyalty_tiers
           set is_active = false, updated_at = now()
           where partner_id = $1::uuid
             and not (id = any($2::uuid[]))`,
          [pid, keepIds]
        )
      }
      await client.query('commit')
      return true
    } catch (e) {
      await client.query('rollback')
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.warn('[updatePartnerLoyaltyDashboardForActorFromPg]', e)
    return false
  }
}

export async function calculatePartnerCustomerSpendWindowFromPg(input: {
  partnerId: string
  spendWindowDays: number
  identity: PartnerLoyaltyCustomerIdentity
}): Promise<number> {
  if (!isPgConfigured()) return 0
  const pid = normalizedUuid(input.partnerId)
  if (!pid) return 0
  const email = normalizedEmail(input.identity.emailNormalized)
  const linkedUserId = normalizedUuid(input.identity.linkedUserId)
  const guestAccountId = normalizedUuid(input.identity.guestAccountId)
  if (!email && !linkedUserId && !guestAccountId) return 0
  try {
    const row = await pgQueryOne<{ total_spent: string | number | null }>(
      `select coalesce(sum(greatest(
                0::numeric,
                coalesce(nullif(o.amount_after_discount, 0), o.subtotal_amount - coalesce(o.total_discount_amount, 0), o.subtotal_amount, 0)
              )), 0) as total_spent
       from public.messaging_partner_orders o
       left join public.customer_care_conversations c on c.id = o.conversation_id
       where o.partner_id = $1::uuid
         and o.status = 'paid_verified'
         and coalesce(o.shipping_status, 'pending') = 'delivered'
         and o.created_at >= now() - ($2::int * interval '1 day')
         and (
           ($3 <> '' and lower(trim(coalesce(o.customer_email, ''))) = $3)
           or ($4::uuid is not null and c.linked_user_id = $4::uuid)
           or ($5::uuid is not null and c.guest_account_id = $5::uuid)
         )`,
      [pid, Math.max(30, Math.min(730, Math.floor(num(input.spendWindowDays, 180)))), email, linkedUserId || null, guestAccountId || null]
    )
    return money(row?.total_spent)
  } catch (e) {
    console.warn('[calculatePartnerCustomerSpendWindowFromPg]', e)
    return 0
  }
}

export async function resolvePartnerCustomerLoyaltyStatusFromPg(input: {
  partnerId: string
  identity: PartnerLoyaltyCustomerIdentity
}): Promise<PartnerCustomerLoyaltyStatus> {
  const settings = await fetchPartnerLoyaltySettingsFromPg(input.partnerId)
  const tiers = (await listPartnerLoyaltyTiersFromPg(input.partnerId)) ?? []
  const activeTiers = tiers
    .filter((t) => t.is_active)
    .sort((a, b) => a.min_spend_6_months - b.min_spend_6_months || a.sort_order - b.sort_order)
  const fallbackSettings = settings ?? {
    partner_id: input.partnerId,
    enabled: false,
    spend_window_days: 180,
    max_total_discount_percent: 30,
    updated_at: '',
  }
  const totalSpent = fallbackSettings.enabled
    ? await calculatePartnerCustomerSpendWindowFromPg({
        partnerId: input.partnerId,
        spendWindowDays: fallbackSettings.spend_window_days,
        identity: input.identity,
      })
    : 0
  let tier: PartnerLoyaltyTierRow | null = null
  for (const t of activeTiers) {
    if (totalSpent >= t.min_spend_6_months) tier = t
  }
  const nextTier = activeTiers.find((t) => t.min_spend_6_months > totalSpent) ?? null
  return {
    enabled: fallbackSettings.enabled,
    spendWindowDays: fallbackSettings.spend_window_days,
    totalSpent,
    tier,
    nextTier,
    amountToNextTier: nextTier ? Math.max(0, nextTier.min_spend_6_months - totalSpent) : 0,
    maxTotalDiscountPercent: fallbackSettings.max_total_discount_percent,
  }
}

export async function resolveStackedMessagingDiscountFromPg(input: {
  partnerId: string
  subtotal: number
  birthdayDiscountPercent?: number | null
  identity: PartnerLoyaltyCustomerIdentity
}): Promise<{ loyaltyStatus: PartnerCustomerLoyaltyStatus; snapshot: PartnerStackedDiscountSnapshot }> {
  const subtotal = money(input.subtotal)
  const loyaltyStatus = await resolvePartnerCustomerLoyaltyStatusFromPg({
    partnerId: input.partnerId,
    identity: input.identity,
  })
  const maxPct = percent(loyaltyStatus.maxTotalDiscountPercent, 30)
  const rawBirthdayPct = percent(input.birthdayDiscountPercent ?? 0, 0)
  const rawLoyaltyPct = loyaltyStatus.enabled ? percent(loyaltyStatus.tier?.discount_percent ?? 0, 0) : 0
  const birthdayPct = Math.min(rawBirthdayPct, maxPct)
  const loyaltyPct = Math.min(rawLoyaltyPct, Math.max(0, maxPct - birthdayPct))
  const totalPct = percent(birthdayPct + loyaltyPct, 0)
  const birthdayAmount = Math.round((subtotal * birthdayPct) / 100)
  const loyaltyAmount = Math.round((subtotal * loyaltyPct) / 100)
  const totalAmount = Math.min(subtotal, birthdayAmount + loyaltyAmount)
  return {
    loyaltyStatus,
    snapshot: {
      loyaltyTierCode: loyaltyStatus.tier?.tier_code ?? '',
      loyaltyTierName: loyaltyStatus.tier?.tier_name ?? '',
      loyaltyDiscountPercent: loyaltyPct,
      loyaltyDiscountAmount: loyaltyAmount,
      birthdayDiscountPercent: birthdayPct,
      birthdayDiscountAmount: birthdayAmount,
      totalDiscountPercent: totalPct,
      totalDiscountAmount: totalAmount,
      amountAfterDiscount: Math.max(0, subtotal - totalAmount),
    },
  }
}

