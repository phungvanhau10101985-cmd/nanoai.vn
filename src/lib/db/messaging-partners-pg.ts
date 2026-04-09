import type { Database } from '@/types/database.types'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'

export type MessagingPartnerRow = Database['public']['Tables']['messaging_partners']['Row']

function mapTimestamptz(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

export type MessagingPartnerBySlugRow = {
  id: string
  display_name: string
  is_active: boolean
  /** Dùng cho embed widget; có thể rỗng. */
  embed_key: string
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
      embed_key: string | null
    }>(
      `select id::text, display_name, is_active, coalesce(embed_key, '') as embed_key
       from public.messaging_partners where slug = $1 limit 1`,
      [slug]
    )
    if (!row) return null
    return {
      id: row.id,
      display_name: String(row.display_name ?? ''),
      is_active: row.is_active !== false,
      embed_key: String(row.embed_key ?? ''),
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerBySlugFromPg]', e)
    return null
  }
}

export type MessagingPartnerByIdRow = {
  id: string
  is_active: boolean
}

/**
 * Một dòng `messaging_partners` theo id (Postgres). `null` = không cấu hình DATABASE_URL, lỗi, hoặc không có bản ghi.
 */
export async function fetchMessagingPartnerByIdFromPg(partnerId: string): Promise<MessagingPartnerByIdRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string; is_active: boolean | null }>(
      `select id::text, is_active from public.messaging_partners where id = $1::uuid limit 1`,
      [partnerId]
    )
    if (!row) return null
    return { id: row.id, is_active: row.is_active !== false }
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
  if (!isPgConfigured() || partnerIds.length === 0) return null
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
      [partnerIds]
    )
    return rows.map((r) => ({
      id: r.id,
      display_name: String(r.display_name ?? ''),
      slug: String(r.slug ?? ''),
      is_active: r.is_active !== false,
    }))
  } catch (e) {
    console.warn('[fetchMessagingPartnersByIdsFromPg]', e)
    return null
  }
}

/**
 * Mọi workspace `messaging_partners` của owner (Postgres). `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnersByOwnerFromPg(ownerUserId: string): Promise<MessagingPartnerRow[] | null> {
  if (!isPgConfigured()) return null
  if (!isValidUuidString(ownerUserId)) {
    console.warn('[fetchMessagingPartnersByOwnerFromPg] skip: invalid owner_user_id')
    return null
  }
  try {
    const rows = await pgQuery<{
      id: string
      slug: string
      display_name: string | null
      owner_user_id: string | null
      embed_key: string | null
      is_active: boolean | null
      created_at: unknown
      updated_at: unknown
    }>(
      `select id::text, slug, display_name, owner_user_id::text,
              coalesce(embed_key, '') as embed_key,
              coalesce(is_active, true) as is_active,
              created_at, updated_at
       from public.messaging_partners
       where owner_user_id = $1::uuid
       order by created_at desc`,
      [ownerUserId]
    )
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      display_name: String(r.display_name ?? ''),
      owner_user_id: r.owner_user_id,
      embed_key: String(r.embed_key ?? ''),
      is_active: r.is_active !== false,
      created_at: mapTimestamptz(r.created_at),
      updated_at: mapTimestamptz(r.updated_at),
    }))
  } catch (e) {
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
  try {
    const row = await pgQueryOne<{ embed_key: string | null }>(
      `select coalesce(embed_key, '') as embed_key
       from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid
       limit 1`,
      [partnerId, ownerUserId]
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
  owner_user_id: string
}): Promise<MessagingPartnerRow | null> {
  if (!isPgConfigured()) return null
  if (!isValidUuidString(params.owner_user_id)) {
    console.warn('[insertMessagingPartnerForOwnerFromPg] skip: invalid owner_user_id')
    return null
  }
  try {
    const row = await pgQueryOne<{
      id: string
      slug: string
      display_name: string | null
      owner_user_id: string | null
      embed_key: string | null
      is_active: boolean | null
      created_at: unknown
      updated_at: unknown
    }>(
      `insert into public.messaging_partners (slug, display_name, owner_user_id)
       values ($1, $2, $3::uuid)
       returning id::text, slug, display_name, owner_user_id::text, embed_key::text as embed_key,
                 coalesce(is_active, true) as is_active, created_at, updated_at`,
      [params.slug, params.display_name, params.owner_user_id]
    )
    if (!row) return null
    return {
      id: row.id,
      slug: row.slug,
      display_name: String(row.display_name ?? ''),
      owner_user_id: row.owner_user_id,
      embed_key: String(row.embed_key ?? ''),
      is_active: row.is_active !== false,
      created_at: mapTimestamptz(row.created_at),
      updated_at: mapTimestamptz(row.updated_at),
    }
  } catch (e) {
    console.warn('[insertMessagingPartnerForOwnerFromPg]', e)
    return null
  }
}
