import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type {
  PartnerMarketingBannerAdminItem,
  PartnerMarketingBannerKind,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import { partnerMarketingBannerCampaignKey } from '@/lib/partner-website/promotions/partner-marketing-banner'

export type PartnerMarketingBannerAssetRow = PartnerMarketingBannerAdminItem

function mapRow(row: Record<string, unknown>): PartnerMarketingBannerAssetRow {
  return {
    id: String(row.id),
    kind: row.kind === 'birthday' ? 'birthday' : 'sale',
    campaign_key: String(row.campaign_key ?? ''),
    date_key: String(row.date_key ?? ''),
    discount_percent: Number(row.discount_percent) || 0,
    image_url: row.image_url ? String(row.image_url) : null,
    aspect_ratio: String(row.aspect_ratio ?? '21:9'),
    image_width: row.image_width == null ? null : Number(row.image_width),
    image_height: row.image_height == null ? null : Number(row.image_height),
    prompt: String(row.prompt ?? ''),
    provider: String(row.provider ?? 'gemini'),
    model: String(row.model ?? ''),
    status:
      row.status === 'ready' || row.status === 'failed' || row.status === 'generating'
        ? row.status
        : 'failed',
    error_message: row.error_message ? String(row.error_message) : null,
    version: Number(row.version) || 1,
    is_active: row.is_active === true,
    source: row.source === 'upload' ? 'upload' : 'ai',
    generated_at: row.generated_at ? String(row.generated_at) : null,
    created_at: String(row.created_at ?? ''),
  }
}

const SELECT_COLS = `
  id::text, partner_id::text, kind, campaign_key, date_key, discount_percent::float8 as discount_percent,
  image_url, aspect_ratio, image_width, image_height, prompt, provider, model, status, error_message,
  version, is_active, source, generated_at, created_at
`

export async function listPartnerMarketingBannerAssetsFromPg(input: {
  partnerId: string
  kind?: PartnerMarketingBannerKind | null
  limit?: number
}): Promise<PartnerMarketingBannerAssetRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.max(1, Math.min(300, input.limit ?? 80))
  const rows = await pgQuery<Record<string, unknown>>(
    input.kind
      ? `select ${SELECT_COLS}
         from public.messaging_partner_marketing_banner_assets
         where partner_id = $1::uuid and kind = $2
         order by created_at desc, version desc
         limit $3`
      : `select ${SELECT_COLS}
         from public.messaging_partner_marketing_banner_assets
         where partner_id = $1::uuid
         order by created_at desc, version desc
         limit $2`,
    input.kind ? [input.partnerId, input.kind, limit] : [input.partnerId, limit]
  )
  return rows.map(mapRow)
}

function vnYmd(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function addYmd(value: { year: number; month: number; day: number }, days: number) {
  const utc = new Date(Date.UTC(value.year, value.month - 1, value.day + days))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

function ymdIso(value: { year: number; month: number; day: number }): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

export async function findTestPartnerBirthdayBannerFromPg(input: {
  partnerId: string
  today?: Date
  discountPercent: number
}): Promise<{ asset: PartnerMarketingBannerAssetRow; eventDate: string } | null> {
  if (!isPgConfigured()) return null
  const today = vnYmd(input.today ?? new Date())
  for (let offset = 0; offset < 8; offset++) {
    const target = addYmd(today, offset)
    const asset = await findActivePartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: 'birthday',
      day: target.day,
      month: target.month,
      discountPercent: input.discountPercent,
    })
    if (asset) {
      return { asset, eventDate: ymdIso(target) }
    }
  }
  const row = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and kind = 'birthday'
       and status = 'ready' and is_active = true and coalesce(image_url, '') <> ''
       and discount_percent = $2
     order by generated_at desc nulls last, version desc
     limit 1`,
    [input.partnerId, input.discountPercent]
  )
  if (!row) return null
  const asset = mapRow(row)
  const parsed = /^(\d{2})-(\d{2})$/.exec(asset.date_key)
  const month = parsed ? Number(parsed[1]) : today.month
  const day = parsed ? Number(parsed[2]) : today.day
  let event = { year: today.year, month, day }
  if (
    event.year < today.year ||
    (event.year === today.year && (event.month < today.month || (event.month === today.month && event.day < today.day)))
  ) {
    event = { ...event, year: today.year + 1 }
  }
  return { asset, eventDate: ymdIso(event) }
}

export async function findActivePartnerMarketingBannerFromPg(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  discountPercent: number
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const key = partnerMarketingBannerCampaignKey(input.kind, input.day, input.month, input.discountPercent)
  const row = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and kind = $2 and campaign_key = $3
       and status = 'ready' and is_active = true and coalesce(image_url, '') <> ''
     order by version desc
     limit 1`,
    [input.partnerId, input.kind, key]
  )
  return row ? mapRow(row) : null
}

export async function findLatestPartnerMarketingBannerFromPg(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  campaignKey: string
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and kind = $2 and campaign_key = $3
     order by version desc
     limit 1`,
    [input.partnerId, input.kind, input.campaignKey]
  )
  return row ? mapRow(row) : null
}

export async function findGeneratingPartnerMarketingBannerFromPg(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  campaignKey: string
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and kind = $2 and campaign_key = $3 and status = 'generating'
     order by version desc
     limit 1`,
    [input.partnerId, input.kind, input.campaignKey]
  )
  return row ? mapRow(row) : null
}

export async function insertPartnerMarketingBannerAssetFromPg(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  campaignKey: string
  dateKey: string
  discountPercent: number
  prompt: string
  model: string
  version: number
  source?: 'ai' | 'upload'
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `insert into public.messaging_partner_marketing_banner_assets (
       partner_id, kind, campaign_key, date_key, discount_percent, prompt, model, version, status, is_active, source
     ) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,'generating', false, $9)
     returning ${SELECT_COLS}`,
    [
      input.partnerId,
      input.kind,
      input.campaignKey,
      input.dateKey,
      input.discountPercent,
      input.prompt,
      input.model,
      input.version,
      input.source ?? 'ai',
    ]
  )
  return row ? mapRow(row) : null
}

export async function completePartnerMarketingBannerAssetFromPg(input: {
  id: string
  partnerId: string
  kind: PartnerMarketingBannerKind
  campaignKey: string
  imageUrl: string
  imageWidth?: number | null
  imageHeight?: number | null
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `update public.messaging_partner_marketing_banner_assets
       set is_active = false, updated_at = now()
       where partner_id = $1::uuid and kind = $2 and campaign_key = $3 and id <> $4::uuid`,
      [input.partnerId, input.kind, input.campaignKey, input.id]
    )
    const done = await client.query<Record<string, unknown>>(
      `update public.messaging_partner_marketing_banner_assets
       set image_url = $2, image_width = $3, image_height = $4, status = 'ready',
           is_active = true, error_message = null, generated_at = now(), updated_at = now()
       where id = $1::uuid
       returning ${SELECT_COLS}`,
      [input.id, input.imageUrl, input.imageWidth ?? null, input.imageHeight ?? null]
    )
    await client.query('commit')
    const row = done.rows[0]
    return row ? mapRow(row) : null
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function failPartnerMarketingBannerAssetFromPg(input: {
  id: string
  errorMessage: string
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_marketing_banner_assets
     set status = 'failed', error_message = $2, is_active = false, updated_at = now()
     where id = $1::uuid`,
    [input.id, input.errorMessage.slice(0, 4000)]
  )
}

export async function activatePartnerMarketingBannerAssetFromPg(input: {
  partnerId: string
  assetId: string
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const current = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [input.partnerId, input.assetId]
  )
  if (!current) return null
  const row = mapRow(current)
  if (row.status !== 'ready' || !row.image_url) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `update public.messaging_partner_marketing_banner_assets
       set is_active = false, updated_at = now()
       where partner_id = $1::uuid and kind = $2 and campaign_key = $3`,
      [input.partnerId, row.kind, row.campaign_key]
    )
    const done = await client.query<Record<string, unknown>>(
      `update public.messaging_partner_marketing_banner_assets
       set is_active = true, updated_at = now()
       where id = $1::uuid
       returning ${SELECT_COLS}`,
      [row.id]
    )
    await client.query('commit')
    return done.rows[0] ? mapRow(done.rows[0]) : null
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function deletePartnerMarketingBannerAssetFromPg(input: {
  partnerId: string
  assetId: string
}): Promise<PartnerMarketingBannerAssetRow | null> {
  if (!isPgConfigured()) return null
  const existing = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [input.partnerId, input.assetId]
  )
  if (!existing) return null
  const row = mapRow(existing)
  await pgQuery(
    `delete from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and id = $2::uuid`,
    [input.partnerId, input.assetId]
  )
  if (row.is_active) {
    const next = await pgQueryOne<Record<string, unknown>>(
      `select ${SELECT_COLS}
       from public.messaging_partner_marketing_banner_assets
       where partner_id = $1::uuid and kind = $2 and campaign_key = $3
         and status = 'ready' and coalesce(image_url, '') <> ''
       order by version desc
       limit 1`,
      [input.partnerId, row.kind, row.campaign_key]
    )
    if (next) {
      await pgQuery(
        `update public.messaging_partner_marketing_banner_assets
         set is_active = true, updated_at = now()
         where id = $1::uuid`,
        [String(next.id)]
      )
    }
  }
  return row
}

export async function findTestBirthdayPartnerMarketingBannerFromPg(input: {
  partnerId: string
  today: Date
  discountPercent: number
}): Promise<{ asset: PartnerMarketingBannerAssetRow; eventDate: Date } | null> {
  for (let offset = 0; offset < 8; offset++) {
    const target = new Date(input.today)
    target.setDate(target.getDate() + offset)
    const asset = await findActivePartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: 'birthday',
      day: target.getDate(),
      month: target.getMonth() + 1,
      discountPercent: input.discountPercent,
    })
    if (asset) return { asset, eventDate: target }
  }
  const latest = await pgQueryOne<Record<string, unknown>>(
    `select ${SELECT_COLS}
     from public.messaging_partner_marketing_banner_assets
     where partner_id = $1::uuid and kind = 'birthday' and status = 'ready'
       and is_active = true and discount_percent = $2
     order by generated_at desc nulls last, id desc
     limit 1`,
    [input.partnerId, input.discountPercent]
  )
  if (!latest) return null
  const asset = mapRow(latest)
  const parts = asset.date_key.split('-')
  const month = Number(parts[0])
  const day = Number(parts[1])
  const year = input.today.getFullYear()
  let eventDate = new Date(year, month - 1, day)
  if (eventDate < input.today) eventDate = new Date(year + 1, month - 1, day)
  return { asset, eventDate }
}

export async function listBirthdayDatesWithCustomersFromPg(input: {
  partnerId: string
  today: Date
}): Promise<Date[]> {
  if (!isPgConfigured()) return []
  const targets = Array.from({ length: 8 }, (_, offset) => {
    const d = new Date(input.today)
    d.setDate(d.getDate() + offset)
    return d
  })
  const pairs = new Set<string>()
  try {
    const profileRows = await pgQuery<{ month: number; day: number }>(
      `select extract(month from date_of_birth)::int as month,
              extract(day from date_of_birth)::int as day
       from public.messaging_partner_customer_profiles
       where partner_id = $1::uuid and date_of_birth is not null`,
      [input.partnerId]
    )
    for (const row of profileRows) pairs.add(`${row.month}-${row.day}`)
  } catch (e) {
    console.warn('[listBirthdayDatesWithCustomersFromPg] profiles', e)
  }
  try {
    const linkedRows = await pgQuery<{ month: number; day: number }>(
      `select distinct extract(month from p.birth_date)::int as month,
              extract(day from p.birth_date)::int as day
       from public.customer_care_conversations c
       join public.profiles p on p.id = c.linked_user_id
       where c.partner_id = $1::uuid
         and c.linked_user_id is not null
         and p.birth_date is not null`,
      [input.partnerId]
    )
    for (const row of linkedRows) pairs.add(`${row.month}-${row.day}`)
  } catch (e) {
    console.warn('[listBirthdayDatesWithCustomersFromPg] linked', e)
  }
  return targets.filter((target) => {
    const key = `${target.getMonth() + 1}-${target.getDate()}`
    if (pairs.has(key)) return true
    const isFeb28NonLeap =
      target.getMonth() === 1 &&
      target.getDate() === 28 &&
      !isLeapYear(target.getFullYear())
    return isFeb28NonLeap && pairs.has('2-29')
  })
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export async function listWebsitePartnerIdsForMarketingBannersFromPg(limit = 80): Promise<string[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ partner_id: string }>(
    `select p.id::text as partner_id
     from public.messaging_partners p
     join public.messaging_partner_websites w on w.partner_id = p.id
     where coalesce(p.is_active, true) = true
       and p.purge_at is null
     order by w.updated_at desc nulls last
     limit $1`,
    [Math.max(1, Math.min(200, limit))]
  )
  return rows.map((row) => row.partner_id)
}

export async function fetchPartnerMarketingBannerBrandFromPg(partnerId: string): Promise<{
  shopName: string
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
  logoUrl: string | null
  themeJson: unknown
} | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{
    display_name: string | null
    brand_name: string | null
    logo_url: string | null
    industry_key: string | null
    site_title: string | null
    site_logo: string | null
    theme_json: unknown
  }>(
    `select p.display_name, p.brand_name, p.logo_url, p.industry_key,
            w.title as site_title, w.logo_url as site_logo, w.theme_json
     from public.messaging_partners p
     left join public.messaging_partner_websites w on w.partner_id = p.id
     where p.id = $1::uuid
     limit 1`,
    [partnerId]
  )
  if (!row) return null
  const industry =
    row.industry_key === 'fashion' ||
    row.industry_key === 'hotel' ||
    row.industry_key === 'food' ||
    row.industry_key === 'other'
      ? row.industry_key
      : null
  return {
    shopName: String(row.brand_name || row.display_name || row.site_title || 'Shop').trim() || 'Shop',
    industryKey: industry,
    logoUrl: row.site_logo || row.logo_url || null,
    themeJson: row.theme_json,
  }
}
