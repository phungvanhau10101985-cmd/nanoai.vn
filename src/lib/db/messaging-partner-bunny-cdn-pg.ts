import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PartnerBunnyCdnRow = {
  partnerId: string
  storageZoneId: number
  storageZoneName: string
  storagePassword: string
  pullZoneId: number
  hostname: string
  deletePending: boolean
}

type DbRow = {
  partner_id: string
  storage_zone_id: string | number
  storage_zone_name: string
  storage_password: string
  pull_zone_id: string | number
  hostname: string
  delete_pending: boolean
}

function mapRow(row: DbRow): PartnerBunnyCdnRow {
  return {
    partnerId: row.partner_id,
    storageZoneId: Number(row.storage_zone_id),
    storageZoneName: row.storage_zone_name,
    storagePassword: row.storage_password,
    pullZoneId: Number(row.pull_zone_id),
    hostname: row.hostname,
    deletePending: Boolean(row.delete_pending),
  }
}

const SELECT_COLS = `partner_id::text, storage_zone_id, storage_zone_name, storage_password,
  pull_zone_id, hostname, delete_pending`

function isMissingTable(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '42P01')
}

export async function fetchPartnerBunnyCdnFromPg(partnerId: string): Promise<PartnerBunnyCdnRow | null> {
  if (!isPgConfigured() || !UUID_RE.test(partnerId)) return null
  try {
    const row = await pgQueryOne<DbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_bunny_cdn
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    if (isMissingTable(e)) return null
    console.warn('[fetchPartnerBunnyCdnFromPg]', e)
    return null
  }
}

export async function fetchPartnerBunnyCdnByHostnameFromPg(hostname: string): Promise<PartnerBunnyCdnRow | null> {
  const host = hostname.trim().toLowerCase()
  if (!isPgConfigured() || !host) return null
  try {
    const row = await pgQueryOne<DbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_bunny_cdn
       where lower(hostname) = $1
       limit 1`,
      [host]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    if (isMissingTable(e)) return null
    console.warn('[fetchPartnerBunnyCdnByHostnameFromPg]', e)
    return null
  }
}

export async function partnerBunnyHostByPartnerIdsFromPg(partnerIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(partnerIds.map((id) => id.trim()).filter((id) => UUID_RE.test(id)))]
  const out = new Map<string, string>()
  if (!isPgConfigured() || ids.length === 0) return out
  try {
    const rows = await pgQuery<{ partner_id: string; hostname: string }>(
      `select partner_id::text, hostname
       from public.messaging_partner_bunny_cdn
       where partner_id = any($1::uuid[])
         and delete_pending = false`,
      [ids]
    )
    for (const row of rows) {
      const host = String(row.hostname || '').trim().toLowerCase()
      if (host) out.set(row.partner_id, host)
    }
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[partnerBunnyHostByPartnerIdsFromPg]', e)
  }
  return out
}

export async function insertPartnerBunnyCdnFromPg(row: PartnerBunnyCdnRow): Promise<boolean> {
  if (!isPgConfigured() || !UUID_RE.test(row.partnerId)) return false
  await pgQuery(
    `insert into public.messaging_partner_bunny_cdn
       (partner_id, storage_zone_id, storage_zone_name, storage_password, pull_zone_id, hostname, delete_pending)
     values ($1::uuid, $2::bigint, $3, $4, $5::bigint, $6, false)
     on conflict (partner_id) do nothing`,
    [
      row.partnerId,
      row.storageZoneId,
      row.storageZoneName,
      row.storagePassword,
      row.pullZoneId,
      row.hostname,
    ]
  )
  return true
}

export async function markPartnerBunnyCdnDeletePendingFromPg(partnerId: string): Promise<void> {
  if (!isPgConfigured() || !UUID_RE.test(partnerId)) return
  try {
    await pgQuery(
      `update public.messaging_partner_bunny_cdn
       set delete_pending = true
       where partner_id = $1::uuid`,
      [partnerId]
    )
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[markPartnerBunnyCdnDeletePendingFromPg]', e)
  }
}

export async function deletePartnerBunnyCdnRowFromPg(partnerId: string): Promise<void> {
  if (!isPgConfigured() || !UUID_RE.test(partnerId)) return
  await pgQuery(`delete from public.messaging_partner_bunny_cdn where partner_id = $1::uuid`, [partnerId])
}

/** Shop đang mở, chưa có ổ CDN, chưa hẹn xóa. */
export async function listPartnersMissingBunnyCdnFromPg(
  limit = 1
): Promise<Array<{ partnerId: string; slug: string }>> {
  if (!isPgConfigured()) return []
  const n = Math.max(1, Math.min(5, Math.floor(limit)))
  try {
    const rows = await pgQuery<{ partner_id: string; slug: string }>(
      `select p.id::text as partner_id, p.slug
       from public.messaging_partners p
       where coalesce(p.is_active, true) = true
         and p.purge_at is null
         and not exists (
           select 1 from public.messaging_partner_bunny_cdn c
           where c.partner_id = p.id
         )
       order by p.created_at, p.id
       limit $1::int`,
      [n]
    )
    return rows
      .map((row) => ({ partnerId: String(row.partner_id || ''), slug: String(row.slug || '').trim() }))
      .filter((row) => UUID_RE.test(row.partnerId) && row.slug.length > 0)
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[listPartnersMissingBunnyCdnFromPg]', e)
    return []
  }
}

export async function listPartnerBunnyCdnDeletePendingFromPg(limit = 20): Promise<PartnerBunnyCdnRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<DbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_bunny_cdn
       where delete_pending = true
       order by created_at
       limit $1::int`,
      [Math.max(1, Math.min(50, limit))]
    )
    return rows.map(mapRow)
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[listPartnerBunnyCdnDeletePendingFromPg]', e)
    return []
  }
}
