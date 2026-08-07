import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PartnerSearchAliasRow = {
  id: string
  partnerId: string
  keyword: string
  inventoryId: string | null
  categoryId: string | null
  createdAt: string
}

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  return s && UUID_RE.test(s) ? s : null
}

function mapRow(r: {
  id: string
  partner_id: string
  keyword: string
  inventory_id: string | null
  category_id: string | null
  created_at: unknown
}): PartnerSearchAliasRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    keyword: String(r.keyword ?? '').trim(),
    inventoryId: r.inventory_id ? String(r.inventory_id) : null,
    categoryId: r.category_id ? String(r.category_id) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
  }
}

export async function listPartnerSearchAliasesFromPg(partnerId: string): Promise<PartnerSearchAliasRow[] | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) return null
  try {
    const rows = await pgQuery<Parameters<typeof mapRow>[0]>(
      `select id::text, partner_id::text, keyword, inventory_id::text, category_id::text, created_at
       from public.messaging_partner_search_aliases
       where partner_id = $1::uuid
       order by lower(keyword) asc`,
      [pid]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPartnerSearchAliasesFromPg]', e)
    return null
  }
}

/** Exact keyword match (case-insensitive) for storefront search shortcut. */
export async function findPartnerSearchAliasByKeywordFromPg(
  partnerId: string,
  keyword: string
): Promise<PartnerSearchAliasRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  const kw = keyword.trim()
  if (!pid || !kw) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `select id::text, partner_id::text, keyword, inventory_id::text, category_id::text, created_at
       from public.messaging_partner_search_aliases
       where partner_id = $1::uuid and lower(keyword) = lower($2)
       limit 1`,
      [pid, kw.slice(0, 200)]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[findPartnerSearchAliasByKeywordFromPg]', e)
    return null
  }
}

export async function insertPartnerSearchAliasFromPg(input: {
  partnerId: string
  keyword: string
  inventoryId?: string | null
  categoryId?: string | null
}): Promise<{ ok: true; row: PartnerSearchAliasRow } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'db_not_configured' }
  const pid = safeUuid(input.partnerId)
  const keyword = input.keyword.trim().slice(0, 200)
  const inventoryId = input.inventoryId ? safeUuid(input.inventoryId) : null
  const categoryId = input.categoryId ? safeUuid(input.categoryId) : null
  if (!pid || !keyword) return { ok: false, error: 'invalid_input' }
  if (!inventoryId && !categoryId) return { ok: false, error: 'target_required' }
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `insert into public.messaging_partner_search_aliases (partner_id, keyword, inventory_id, category_id)
       values ($1::uuid, $2, $3::uuid, $4::uuid)
       returning id::text, partner_id::text, keyword, inventory_id::text, category_id::text, created_at`,
      [pid, keyword, inventoryId, categoryId]
    )
    if (!row) return { ok: false, error: 'insert_failed' }
    return { ok: true, row: mapRow(row) }
  } catch (e) {
    const err = e as { code?: string }
    if (err?.code === '23505') return { ok: false, error: 'duplicate_keyword' }
    console.warn('[insertPartnerSearchAliasFromPg]', e)
    return { ok: false, error: 'insert_failed' }
  }
}

export async function deletePartnerSearchAliasFromPg(
  partnerId: string,
  aliasId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const aid = safeUuid(aliasId)
  if (!pid || !aid) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `delete from public.messaging_partner_search_aliases
       where partner_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [pid, aid]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[deletePartnerSearchAliasFromPg]', e)
    return false
  }
}
