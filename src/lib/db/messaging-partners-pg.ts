import type { Database } from '@/types/database.types'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
export type MessagingPartnerRow = Database['public']['Tables']['messaging_partners']['Row']

/** Tránh đưa "" vào Postgres `::uuid` / `uuid[]` (lỗi 22P02). */
const UUID_SQL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function filterUuidStrings(ids: string[]): string[] {
  const out: string[] = []
  for (const raw of ids) {
    const s = typeof raw === 'string' ? raw.trim() : ''
    if (s && UUID_SQL.test(s)) out.push(s)
  }
  return [...new Set(out)]
}

function safeOwnerUuid(ownerUserId: unknown): string | null {
  const s = typeof ownerUserId === 'string' ? ownerUserId.trim() : String(ownerUserId ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

function mapTimestamptz(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function isMissingPartnerProfileColumnError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (!err || err.code !== '42703') return false
  const msg = String(err.message ?? '').toLowerCase()
  return (
    msg.includes('industry_key') ||
    msg.includes('brand_name') ||
    msg.includes('logo_url') ||
    msg.includes('purge_at') ||
    msg.includes('deletion_requested_at') ||
    msg.includes('facebook_pixel_id') ||
    msg.includes('facebook_capi_access_token') ||
    msg.includes('ga4_measurement_id')
  )
}

/** Shop nhận tin công khai (widget/FB/Zalo) chỉ khi active và không trong lịch xóa / chờ purge. */
export function isMessagingPartnerInboundOpen(row: { is_active: boolean; purge_at: string | null }): boolean {
  if (!row.is_active) return false
  if (row.purge_at) return false
  return true
}

export type MessagingPartnerBySlugRow = {
  id: string
  display_name: string
  is_active: boolean
  purge_at: string | null
  /** Dùng cho embed widget; có thể rỗng. */
  embed_key: string
  /** Logo shop (URL https); hiển thị tròn trên widget. */
  logo_url: string | null
  /** Meta Pixel — công khai cho fbq trên trang tư vấn */
  facebook_pixel_id: string | null
  /** Chỉ đọc server-side khi gửi CAPI */
  facebook_capi_access_token: string | null
  /** GA4 G-... — gtag config trên trang tư vấn */
  ga4_measurement_id: string | null
}

/**
 * Một dòng `messaging_partners` theo slug (Postgres). Trả `null` khi không có DATABASE_URL, lỗi, hoặc không có bản ghi.
 */
export async function fetchMessagingPartnerBySlugFromPg(slug: string): Promise<MessagingPartnerBySlugRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      display_name: string | null
      is_active: boolean | null
      purge_at: string | null
      embed_key: string | null
      logo_url: string | null
      facebook_pixel_id: string | null
      facebook_capi_access_token: string | null
      ga4_measurement_id: string | null
    }>(
      `select id::text, display_name, is_active, purge_at, coalesce(embed_key::text, '') as embed_key,
              logo_url,
              nullif(trim(coalesce(facebook_pixel_id, '')), '') as facebook_pixel_id,
              nullif(trim(coalesce(facebook_capi_access_token, '')), '') as facebook_capi_access_token,
              nullif(trim(coalesce(ga4_measurement_id, '')), '') as ga4_measurement_id
       from public.messaging_partners where slug = $1 limit 1`,
      [slug]
    )
    if (!row) return null
    const logoRaw = row.logo_url != null ? String(row.logo_url).trim() : ''
    return {
      id: row.id,
      display_name: String(row.display_name ?? ''),
      is_active: row.is_active !== false,
      purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
      embed_key: String(row.embed_key ?? ''),
      logo_url: logoRaw && /^https?:\/\//i.test(logoRaw) ? logoRaw : null,
      facebook_pixel_id: row.facebook_pixel_id ? String(row.facebook_pixel_id).trim() : null,
      facebook_capi_access_token: row.facebook_capi_access_token
        ? String(row.facebook_capi_access_token).trim()
        : null,
      ga4_measurement_id: row.ga4_measurement_id ? String(row.ga4_measurement_id).trim() : null,
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerBySlugFromPg]', e)
    return null
  }
}

/**
 * Pixel + CAPI token cho partner (chỉ gọi server sau khi đã xác thực slug/partner).
 * Không trả token ra client.
 */
export async function fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(
  partnerId: string
): Promise<{ facebook_pixel_id: string | null; facebook_capi_access_token: string | null } | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) return null
  try {
    const row = await pgQueryOne<{
      facebook_pixel_id: string | null
      facebook_capi_access_token: string | null
    }>(
      `select nullif(trim(coalesce(facebook_pixel_id, '')), '') as facebook_pixel_id,
              nullif(trim(coalesce(facebook_capi_access_token, '')), '') as facebook_capi_access_token
       from public.messaging_partners where id = $1::uuid limit 1`,
      [pid]
    )
    if (!row) return null
    return {
      facebook_pixel_id: row.facebook_pixel_id ? String(row.facebook_pixel_id).trim() : null,
      facebook_capi_access_token: row.facebook_capi_access_token
        ? String(row.facebook_capi_access_token).trim()
        : null,
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg]', e)
    return null
  }
}

export async function updateMessagingPartnerFacebookMetaForOwnerFromPg(params: {
  partner_id: string
  owner_user_id: string
  facebook_pixel_id: string | null
  /** `true` = cập nhật token theo `facebook_capi_access_token`; `false` = giữ nguyên trong DB */
  update_capi_token: boolean
  facebook_capi_access_token: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  const uid = safeOwnerUuid(params.owner_user_id)
  if (!pid || !uid) return false
  const pixel = params.facebook_pixel_id != null ? String(params.facebook_pixel_id).trim() : ''
  const capi = params.facebook_capi_access_token != null ? String(params.facebook_capi_access_token).trim() : ''
  try {
    if (params.update_capi_token) {
      const row = await pgQueryOne<{ id: string }>(
        `update public.messaging_partners
         set facebook_pixel_id = $3,
             facebook_capi_access_token = $4,
             updated_at = now()
         where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
         returning id::text`,
        [pid, uid, pixel || null, capi || null]
      )
      return Boolean(row?.id)
    }
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partners
       set facebook_pixel_id = $3,
           updated_at = now()
       where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
       returning id::text`,
      [pid, uid, pixel || null]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[updateMessagingPartnerFacebookMetaForOwnerFromPg]', e)
    return false
  }
}

export async function updateMessagingPartnerGa4ForOwnerFromPg(params: {
  partner_id: string
  owner_user_id: string
  ga4_measurement_id: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  const uid = safeOwnerUuid(params.owner_user_id)
  if (!pid || !uid) return false
  const ga = params.ga4_measurement_id != null ? String(params.ga4_measurement_id).trim() : ''
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partners
       set ga4_measurement_id = $3,
           updated_at = now()
       where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
       returning id::text`,
      [pid, uid, ga || null]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[updateMessagingPartnerGa4ForOwnerFromPg]', e)
    return false
  }
}

export type MessagingPartnerByIdRow = {
  id: string
  is_active: boolean
  purge_at: string | null
}

/**
 * Một dòng `messaging_partners` theo id (Postgres). `null` = không cấu hình DATABASE_URL, lỗi, hoặc không có bản ghi.
 */
export async function fetchMessagingPartnerByIdFromPg(partnerId: string): Promise<MessagingPartnerByIdRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) {
    console.warn('[fetchMessagingPartnerByIdFromPg] skip: invalid partner_id')
    return null
  }
  try {
    const row = await pgQueryOne<{
      id: string
      is_active: boolean | null
      purge_at: string | null
    }>(
      `select id::text, is_active, purge_at from public.messaging_partners where id = $1::uuid limit 1`,
      [pid]
    )
    if (!row) return null
    return {
      id: row.id,
      is_active: row.is_active !== false,
      purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerByIdFromPg]', e)
    return null
  }
}

export type MessagingPartnerByIdsRow = {
  id: string
  display_name: string
  slug: string
  is_active: boolean
}

/**
 * Nhiều partner theo id (Postgres). `null` = không cấu hình pool hoặc lỗi truy vấn — caller nên caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnersByIdsFromPg(partnerIds: string[]): Promise<MessagingPartnerByIdsRow[] | null> {
  if (!isPgConfigured()) return null
  const cleanIds = filterUuidStrings(partnerIds)
  if (cleanIds.length === 0) return null
  try {
    const rows = await pgQuery<{
      id: string
      display_name: string | null
      industry_key: 'fashion' | 'hotel' | 'food' | 'other' | null
      brand_name: string | null
      logo_url: string | null
      slug: string | null
      is_active: boolean | null
    }>(
      `select id::text, display_name, industry_key, brand_name, logo_url, slug, is_active
       from public.messaging_partners
       where id = any($1::uuid[])`,
      [cleanIds]
    )
    if (!rows.length) return []
    return rows.map((r) => ({
      id: r.id,
      display_name: String(r.display_name ?? ''),
      slug: String(r.slug ?? ''),
      is_active: r.is_active !== false,
    }))
  } catch (e) {
    if (isMissingPartnerProfileColumnError(e)) {
      try {
        const rows = await pgQuery<{
          id: string
          display_name: string | null
          slug: string | null
          is_active: boolean | null
        }>(
          `select id::text, display_name, slug, is_active
           from public.messaging_partners
           where id = any($1::uuid[])`,
          [cleanIds]
        )
        return rows.map((r) => ({
          id: r.id,
          display_name: String(r.display_name ?? ''),
          slug: String(r.slug ?? ''),
          is_active: r.is_active !== false,
        }))
      } catch (legacyErr) {
        console.warn('[fetchMessagingPartnersByIdsFromPg:legacy]', legacyErr)
        return null
      }
    }
    console.warn('[fetchMessagingPartnersByIdsFromPg]', e)
    return null
  }
}

/**
 * Mọi workspace `messaging_partners` của owner (Postgres). `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnersByOwnerFromPg(ownerUserId: string): Promise<MessagingPartnerRow[] | null> {
  if (!isPgConfigured()) return null
  const uidRaw = typeof ownerUserId === 'string' ? ownerUserId.trim() : String(ownerUserId ?? '').trim()
  // Nếu DB từng có owner_user_id rỗng/text bẩn, so sánh text-safe để tránh 22P02.
  if (!uidRaw || !UUID_SQL.test(uidRaw)) {
    console.warn('[fetchMessagingPartnersByOwnerFromPg] skip: invalid or empty owner_user_id')
  }
  try {
    const rows = await pgQuery<{
      id: string
      slug: string
      display_name: string | null
      industry_key: MessagingPartnerRow['industry_key'] | null
      brand_name: string | null
      logo_url: string | null
      owner_user_id: string | null
      embed_key: string | null
      is_active: boolean | null
      purge_at: string | null
      deletion_requested_at: string | null
      facebook_pixel_id: string | null
      ga4_measurement_id: string | null
      created_at: unknown
      updated_at: unknown
    }>(
      `select id::text, slug, display_name, owner_user_id::text,
              industry_key, brand_name, logo_url,
              coalesce(embed_key::text, '') as embed_key,
              coalesce(is_active, true) as is_active,
              purge_at, deletion_requested_at,
              nullif(trim(coalesce(facebook_pixel_id, '')), '') as facebook_pixel_id,
              nullif(trim(coalesce(ga4_measurement_id, '')), '') as ga4_measurement_id,
              created_at, updated_at
       from public.messaging_partners
       where (
         nullif(owner_user_id::text, '') = $1
         or exists (
           select 1
           from auth.users me
           join auth.users owner_u on owner_u.id = messaging_partners.owner_user_id
           where me.id = $1::uuid
             and lower(coalesce(me.email, '')) <> ''
             and lower(coalesce(owner_u.email, '')) = lower(coalesce(me.email, ''))
         )
       )
         and coalesce(is_active, true) = true
       order by created_at desc`,
      [uidRaw]
    )
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      display_name: String(r.display_name ?? ''),
      industry_key: r.industry_key ?? null,
      brand_name: r.brand_name ?? null,
      logo_url: r.logo_url ?? null,
      owner_user_id: r.owner_user_id,
      embed_key: String(r.embed_key ?? ''),
      is_active: r.is_active !== false,
      purge_at: r.purge_at ? mapTimestamptz(r.purge_at) : null,
      deletion_requested_at: r.deletion_requested_at ? mapTimestamptz(r.deletion_requested_at) : null,
      facebook_pixel_id: r.facebook_pixel_id ? String(r.facebook_pixel_id).trim() : null,
      facebook_capi_access_token: null,
      ga4_measurement_id: r.ga4_measurement_id ? String(r.ga4_measurement_id).trim() : null,
      created_at: mapTimestamptz(r.created_at),
      updated_at: mapTimestamptz(r.updated_at),
    }))
  } catch (e) {
    if (isMissingPartnerProfileColumnError(e)) {
      try {
        const rows = await pgQuery<{
          id: string
          slug: string
          display_name: string | null
          owner_user_id: string | null
          embed_key: string | null
          is_active: boolean | null
          purge_at: string | null
          deletion_requested_at: string | null
          created_at: unknown
          updated_at: unknown
        }>(
          `select id::text, slug, display_name, owner_user_id::text,
                  coalesce(embed_key::text, '') as embed_key,
                  coalesce(is_active, true) as is_active,
                  purge_at, deletion_requested_at,
                  created_at, updated_at
           from public.messaging_partners
           where (
             nullif(owner_user_id::text, '') = $1
             or exists (
               select 1
               from auth.users me
               join auth.users owner_u on owner_u.id = messaging_partners.owner_user_id
               where me.id = $1::uuid
                 and lower(coalesce(me.email, '')) <> ''
                 and lower(coalesce(owner_u.email, '')) = lower(coalesce(me.email, ''))
             )
           )
             and coalesce(is_active, true) = true
           order by created_at desc`,
          [uidRaw]
        )
        return rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          display_name: String(r.display_name ?? ''),
          industry_key: null,
          brand_name: null,
          logo_url: null,
          owner_user_id: r.owner_user_id,
          embed_key: String(r.embed_key ?? ''),
          is_active: r.is_active !== false,
          purge_at: r.purge_at ? mapTimestamptz(r.purge_at) : null,
          deletion_requested_at: r.deletion_requested_at ? mapTimestamptz(r.deletion_requested_at) : null,
          facebook_pixel_id: null,
          facebook_capi_access_token: null,
          ga4_measurement_id: null,
          created_at: mapTimestamptz(r.created_at),
          updated_at: mapTimestamptz(r.updated_at),
        }))
      } catch (legacyErr) {
        console.warn('[fetchMessagingPartnersByOwnerFromPg:legacy]', legacyErr)
        return null
      }
    }
    console.warn('[fetchMessagingPartnersByOwnerFromPg]', e)
    return null
  }
}

/**
 * `embed_key` khi đúng owner (Postgres). `null` = không dùng được PG hoặc không có bản ghi — caller caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnerEmbedKeyForOwnerFromPg(
  partnerId: string,
  ownerUserId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  const uid = safeOwnerUuid(ownerUserId)
  if (!pid || !uid) {
    console.warn('[fetchMessagingPartnerEmbedKeyForOwnerFromPg] skip: invalid partner_id or owner_user_id')
    return null
  }
  try {
    const row = await pgQueryOne<{ embed_key: string | null }>(
      `select coalesce(embed_key::text, '') as embed_key
       from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid
       limit 1`,
      [pid, uid]
    )
    if (!row) return null
    return String(row.embed_key ?? '')
  } catch (e) {
    console.warn('[fetchMessagingPartnerEmbedKeyForOwnerFromPg]', e)
    return null
  }
}

/**
 * Tạo workspace `messaging_partners` (INSERT + RETURNING). `null` = không pool hoặc lỗi (trùng slug, FK…) — caller xử lý khi không có PG.
 */
export async function insertMessagingPartnerForOwnerFromPg(params: {
  slug: string
  display_name: string
  industry_key: 'fashion' | 'hotel' | 'food' | 'other'
  brand_name: string
  logo_url: string | null
  owner_user_id: string
}): Promise<MessagingPartnerRow | null> {
  if (!isPgConfigured()) return null
  if (!safeOwnerUuid(params.owner_user_id)) {
    console.warn('[insertMessagingPartnerForOwnerFromPg] skip: invalid owner_user_id')
    return null
  }
  try {
    const row = await pgQueryOne<{
      id: string
      slug: string
      display_name: string | null
      industry_key: MessagingPartnerRow['industry_key'] | null
      brand_name: string | null
      logo_url: string | null
      owner_user_id: string | null
      embed_key: string | null
      is_active: boolean | null
      purge_at: string | null
      deletion_requested_at: string | null
      created_at: unknown
      updated_at: unknown
    }>(
      `insert into public.messaging_partners (slug, display_name, industry_key, brand_name, logo_url, owner_user_id)
       values ($1, $2, $3, $4, $5, $6::uuid)
       returning id::text, slug, display_name, industry_key, brand_name, logo_url,
                 owner_user_id::text, embed_key::text as embed_key,
                 coalesce(is_active, true) as is_active,
                 purge_at, deletion_requested_at, created_at, updated_at`,
      [
        params.slug,
        params.display_name,
        params.industry_key,
        params.brand_name,
        params.logo_url,
        safeOwnerUuid(params.owner_user_id)!,
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      slug: row.slug,
      display_name: String(row.display_name ?? ''),
      industry_key: row.industry_key ?? null,
      brand_name: row.brand_name ?? null,
      logo_url: row.logo_url ?? null,
      owner_user_id: row.owner_user_id,
      embed_key: String(row.embed_key ?? ''),
      is_active: row.is_active !== false,
      purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
      deletion_requested_at: row.deletion_requested_at ? mapTimestamptz(row.deletion_requested_at) : null,
      facebook_pixel_id: null,
      facebook_capi_access_token: null,
      ga4_measurement_id: null,
      created_at: mapTimestamptz(row.created_at),
      updated_at: mapTimestamptz(row.updated_at),
    }
  } catch (e) {
    if (isMissingPartnerProfileColumnError(e)) {
      try {
        const row = await pgQueryOne<{
          id: string
          slug: string
          display_name: string | null
          owner_user_id: string | null
          embed_key: string | null
          is_active: boolean | null
          purge_at: string | null
          deletion_requested_at: string | null
          created_at: unknown
          updated_at: unknown
        }>(
          `insert into public.messaging_partners (slug, display_name, owner_user_id)
           values ($1, $2, $3::uuid)
           returning id::text, slug, display_name, owner_user_id::text, embed_key::text as embed_key,
                     coalesce(is_active, true) as is_active,
                     purge_at, deletion_requested_at, created_at, updated_at`,
          [params.slug, params.display_name, safeOwnerUuid(params.owner_user_id)!]
        )
        if (!row) return null
        return {
          id: row.id,
          slug: row.slug,
          display_name: String(row.display_name ?? ''),
          industry_key: null,
          brand_name: null,
          logo_url: null,
          owner_user_id: row.owner_user_id,
          embed_key: String(row.embed_key ?? ''),
          is_active: row.is_active !== false,
          purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
          deletion_requested_at: row.deletion_requested_at ? mapTimestamptz(row.deletion_requested_at) : null,
          facebook_pixel_id: null,
          facebook_capi_access_token: null,
          ga4_measurement_id: null,
          created_at: mapTimestamptz(row.created_at),
          updated_at: mapTimestamptz(row.updated_at),
        }
      } catch (legacyErr) {
        console.warn('[insertMessagingPartnerForOwnerFromPg:legacy]', legacyErr)
        return null
      }
    }
    console.warn('[insertMessagingPartnerForOwnerFromPg]', e)
    return null
  }
}

export async function updateMessagingPartnerProfileForOwnerFromPg(params: {
  partner_id: string
  owner_user_id: string
  display_name: string
  industry_key: 'fashion' | 'hotel' | 'food' | 'other'
  brand_name: string
  logo_url: string | null
}): Promise<MessagingPartnerRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const uid = safeOwnerUuid(params.owner_user_id)
  if (!pid || !uid) return null
  try {
    const row = await pgQueryOne<{
      id: string
      slug: string
      display_name: string | null
      industry_key: MessagingPartnerRow['industry_key'] | null
      brand_name: string | null
      logo_url: string | null
      owner_user_id: string | null
      embed_key: string | null
      is_active: boolean | null
      purge_at: string | null
      deletion_requested_at: string | null
      created_at: unknown
      updated_at: unknown
    }>(
      `update public.messaging_partners
       set display_name = $3,
           industry_key = $4,
           brand_name = $5,
           logo_url = $6,
           updated_at = now()
       where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
       returning id::text, slug, display_name, industry_key, brand_name, logo_url,
                 owner_user_id::text, coalesce(embed_key::text, '') as embed_key,
                 coalesce(is_active, true) as is_active,
                 purge_at, deletion_requested_at, created_at, updated_at`,
      [pid, uid, params.display_name, params.industry_key, params.brand_name, params.logo_url]
    )
    if (!row) return null
    return {
      id: row.id,
      slug: row.slug,
      display_name: String(row.display_name ?? ''),
      industry_key: row.industry_key ?? null,
      brand_name: row.brand_name ?? null,
      logo_url: row.logo_url ?? null,
      owner_user_id: row.owner_user_id,
      embed_key: String(row.embed_key ?? ''),
      is_active: row.is_active !== false,
      purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
      deletion_requested_at: row.deletion_requested_at ? mapTimestamptz(row.deletion_requested_at) : null,
      facebook_pixel_id: null,
      facebook_capi_access_token: null,
      ga4_measurement_id: null,
      created_at: mapTimestamptz(row.created_at),
      updated_at: mapTimestamptz(row.updated_at),
    }
  } catch (e) {
    if (isMissingPartnerProfileColumnError(e)) {
      try {
        const row = await pgQueryOne<{
          id: string
          slug: string
          display_name: string | null
          owner_user_id: string | null
          embed_key: string | null
          is_active: boolean | null
          purge_at: string | null
          deletion_requested_at: string | null
          created_at: unknown
          updated_at: unknown
        }>(
          `update public.messaging_partners
           set display_name = $3, updated_at = now()
           where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
           returning id::text, slug, display_name, owner_user_id::text, coalesce(embed_key::text, '') as embed_key,
                     coalesce(is_active, true) as is_active,
                     purge_at, deletion_requested_at, created_at, updated_at`,
          [pid, uid, params.display_name]
        )
        if (!row) return null
        return {
          id: row.id,
          slug: row.slug,
          display_name: String(row.display_name ?? ''),
          industry_key: null,
          brand_name: null,
          logo_url: null,
          owner_user_id: row.owner_user_id,
          embed_key: String(row.embed_key ?? ''),
          is_active: row.is_active !== false,
          purge_at: row.purge_at ? mapTimestamptz(row.purge_at) : null,
          deletion_requested_at: row.deletion_requested_at ? mapTimestamptz(row.deletion_requested_at) : null,
          facebook_pixel_id: null,
          facebook_capi_access_token: null,
          ga4_measurement_id: null,
          created_at: mapTimestamptz(row.created_at),
          updated_at: mapTimestamptz(row.updated_at),
        }
      } catch (legacyErr) {
        console.warn('[updateMessagingPartnerProfileForOwnerFromPg:legacy]', legacyErr)
        return null
      }
    }
    console.warn('[updateMessagingPartnerProfileForOwnerFromPg]', e)
    return null
  }
}

/**
 * Xóa mềm workspace: đặt `is_active = false` khi đúng owner. Trả `false` khi không có bản ghi khớp hoặc lỗi.
 */
export async function deactivateMessagingPartnerForOwnerFromPg(
  partnerId: string,
  ownerUserId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const uid = safeOwnerUuid(ownerUserId)
  if (!pid || !uid) {
    console.warn('[deactivateMessagingPartnerForOwnerFromPg] skip: invalid partner_id or owner_user_id')
    return false
  }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partners
       set is_active = false, updated_at = now()
       where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
       returning id::text as id`,
      [pid, uid]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[deactivateMessagingPartnerForOwnerFromPg]', e)
    return false
  }
}
