import type { Database } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerInventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
export type MessagingPartnerInventoryInsert = Database['public']['Tables']['messaging_partner_inventory']['Insert']

const INVENTORY_FULL_LIST_PAGE = 1000

function tsIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  return s || null
}

function tsIsoReq(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function parseEmbeddingJson(v: unknown): number[] | null {
  if (v == null) return null
  if (!Array.isArray(v)) return null
  const out: number[] = []
  for (const x of v) {
    const n = Number(x)
    if (Number.isFinite(n)) out.push(n)
  }
  return out.length ? out : null
}

function isMissingInventoryTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  if (code !== '42P01') return false
  const msg = String((e as { message?: unknown }).message ?? '')
  return /messaging_partner_inventory/i.test(msg)
}

type PgInventoryRaw = {
  id: string
  partner_id: string
  sort_order: number | null
  sku: string | null
  name: string
  description: string
  stock_note: string
  price_hint: string
  image_url: string
  product_url: string
  consult_note: string
  is_active: boolean | null
  image_embedding_json: unknown
  image_embedding_vec: string | null
  image_embedding_model: string | null
  image_embedding_dims: number | null
  image_embedding_fingerprint: string | null
  image_embedding_updated_at: unknown
  image_embedding_error: string | null
  vision_catalog_checksum: string | null
  vision_catalog_synced_at: unknown
  vision_catalog_excluded: boolean | null
  created_at: unknown
  updated_at: unknown
}

function mapPgInventoryRow(r: PgInventoryRaw): MessagingPartnerInventoryRow {
  return {
    id: r.id,
    partner_id: r.partner_id,
    sort_order: num(r.sort_order, 0),
    sku: r.sku ?? null,
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    stock_note: String(r.stock_note ?? ''),
    price_hint: String(r.price_hint ?? ''),
    image_url: String(r.image_url ?? ''),
    product_url: String(r.product_url ?? ''),
    consult_note: String(r.consult_note ?? ''),
    is_active: r.is_active !== false,
    image_embedding_json: parseEmbeddingJson(r.image_embedding_json),
    image_embedding_vec: r.image_embedding_vec ?? null,
    image_embedding_model: r.image_embedding_model ?? null,
    image_embedding_dims: numOrNull(r.image_embedding_dims),
    image_embedding_fingerprint: r.image_embedding_fingerprint ?? null,
    image_embedding_updated_at: tsIso(r.image_embedding_updated_at),
    image_embedding_error: r.image_embedding_error ?? null,
    vision_catalog_checksum: r.vision_catalog_checksum ?? null,
    vision_catalog_synced_at: tsIso(r.vision_catalog_synced_at),
    vision_catalog_excluded: r.vision_catalog_excluded !== false,
    created_at: tsIsoReq(r.created_at),
    updated_at: tsIsoReq(r.updated_at),
  }
}

const INVENTORY_PAGE_SELECT = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.consult_note, '') as consult_note,
  coalesce(mpi.is_active, true) as is_active,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

/**
 * Trang inventory active + tổng số (Postgres). `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryActivePageWithCountFromPg(
  partnerId: string,
  offset: number,
  limit: number
): Promise<{ rows: MessagingPartnerInventoryRow[]; count: number } | null> {
  if (!isPgConfigured()) return null
  const off = Math.max(0, Math.floor(offset))
  const lim = Math.max(1, Math.floor(limit))
  try {
    const countRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and coalesce(is_active, true) = true`,
      [partnerId]
    )
    const rows = await pgQuery<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid and coalesce(mpi.is_active, true) = true
       order by mpi.sort_order asc
       limit $2 offset $3`,
      [partnerId, lim, off]
    )
    return {
      count: countRow?.c ?? 0,
      rows: rows.map(mapPgInventoryRow),
    }
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return { rows: [], count: 0 }
    }
    console.warn('[fetchPartnerInventoryActivePageWithCountFromPg]', e)
    return null
  }
}

/**
 * `id` → `price_hint` cho các dòng inventory của partner (Postgres).
 * `null` = không pool hoặc lỗi — caller caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryPriceHintsByIdsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, string> | null> {
  if (!isPgConfigured() || inventoryIds.length === 0) return null
  try {
    const rows = await pgQuery<{ id: string; price_hint: string | null }>(
      `select id::text, coalesce(price_hint, '') as price_hint
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [partnerId, inventoryIds]
    )
    const m = new Map<string, string>()
    for (const r of rows) {
      m.set(r.id, String(r.price_hint ?? ''))
    }
    return m
  } catch (e) {
    console.warn('[fetchPartnerInventoryPriceHintsByIdsFromPg]', e)
    return null
  }
}

/** Giống `sanitizeInventorySearchToken` trong partner-inventory-ai-search (tránh import vòng). */
function sanitizeTokenForInventoryLike(raw: string): string {
  return raw.replace(/[%_,().]/g, '').trim().slice(0, 64)
}

/**
 * Danh sách mặc định cho ngữ cảnh AI: active, sort_order, giới hạn N dòng.
 * `null` = lỗi / chưa cấu hình PG — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryDefaultForAiFromPg(
  partnerId: string,
  limit: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.floor(limit))
  try {
    const rows = await pgQuery<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid and coalesce(mpi.is_active, true) = true
       order by mpi.sort_order asc
       limit $2`,
      [partnerId, lim]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryDefaultForAiFromPg]', e)
    return null
  }
}

/**
 * ILIKE trên sku / name / description / price_hint (một token đã làm sạch).
 * `null` = lỗi / chưa cấu hình PG.
 */
export async function fetchPartnerInventoryRowsByTokenIlikeFromPg(
  partnerId: string,
  token: string,
  limit: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const clean = sanitizeTokenForInventoryLike(token).replace(/[%_]/g, '')
  if (clean.length < 2) return []
  const lim = Math.max(1, Math.floor(limit))
  const pattern = `%${clean}%`
  try {
    const rows = await pgQuery<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and (
           coalesce(mpi.sku, '') ilike $2
           or coalesce(mpi.name, '') ilike $2
           or coalesce(mpi.description, '') ilike $2
           or coalesce(mpi.price_hint, '') ilike $2
         )
       limit $3`,
      [partnerId, pattern, lim]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByTokenIlikeFromPg]', e)
    return null
  }
}

export async function fetchPartnerInventoryRowByIdForPartnerFromPg(
  partnerId: string,
  inventoryId: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid and mpi.id = $2::uuid
       limit 1`,
      [partnerId, inventoryId]
    )
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByIdForPartnerFromPg]', e)
    return null
  }
}

/** Kết quả RPC `match_messaging_partner_inventory_by_embedding` (pgvector). */
export type MatchPartnerInventoryEmbeddingRow = {
  inventory_id: string
  name: string
  sku: string | null
  image_url: string
  product_url: string | null
  score: number
}

/**
 * ANN search embedding ảnh (gọi cùng function SQL đã có trong DB).
 * `null` = không pool / lỗi — caller xử lý khi không có PG.
 */
export async function matchPartnerInventoryByEmbeddingFromPg(
  partnerId: string,
  queryVectorLiteral: string,
  limit: number,
  minScore: number
): Promise<MatchPartnerInventoryEmbeddingRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(25, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      inventory_id: string
      name: string
      sku: string | null
      image_url: string
      product_url: string | null
      score: string | number
    }>(
      `select * from public.match_messaging_partner_inventory_by_embedding(
        $1::uuid,
        $2::vector(768),
        $3::int,
        $4::double precision
      )`,
      [partnerId, queryVectorLiteral, lim, minScore]
    )
    return rows.map((r) => ({
      inventory_id: String(r.inventory_id),
      name: String(r.name ?? ''),
      sku: r.sku ?? null,
      image_url: String(r.image_url ?? ''),
      product_url: r.product_url ?? null,
      score: typeof r.score === 'number' ? r.score : Number(r.score),
    }))
  } catch (e) {
    console.warn('[matchPartnerInventoryByEmbeddingFromPg]', e)
    return null
  }
}

/**
 * Nhiều id inventory của partner (đồng bộ embedding).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg(
  partnerId: string,
  ids: string[]
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured() || ids.length === 0) return null
  try {
    const rows = await pgQuery<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid and mpi.id = any($2::uuid[])`,
      [partnerId, ids]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg]', e)
    return null
  }
}

/**
 * Trang theo `updated_at` tăng dần (quét cần sync embedding).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventorySliceByUpdatedAtAscFromPg(
  partnerId: string,
  limit: number,
  offset: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.floor(limit))
  const off = Math.max(0, Math.floor(offset))
  try {
    const rows = await pgQuery<PgInventoryRaw>(
      `${INVENTORY_PAGE_SELECT}
       where mpi.partner_id = $1::uuid
       order by mpi.updated_at asc nulls last
       limit $2 offset $3`,
      [partnerId, lim, off]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventorySliceByUpdatedAtAscFromPg]', e)
    return null
  }
}

export type PartnerInventoryEmbeddingUpdatePatch = {
  image_embedding_json: number[] | null
  image_embedding_fingerprint: string
  image_embedding_model: string
  image_embedding_dims: number
  image_embedding_vec: string | null
  image_embedding_updated_at: string
  image_embedding_error: string | null
}

/**
 * Cập nhật các cột embedding sau khi gọi Gemini. `true` nếu có đúng 1 dòng đổi.
 * `false` = không pool hoặc lỗi — caller cập nhật bằng đường khác nếu còn hỗ trợ.
 */
export async function updatePartnerInventoryEmbeddingFieldsFromPg(
  partnerId: string,
  inventoryId: string,
  patch: PartnerInventoryEmbeddingUpdatePatch
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const jsonPayload =
    patch.image_embedding_json == null ? null : JSON.stringify(patch.image_embedding_json)
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.messaging_partner_inventory set
        image_embedding_json = $3::jsonb,
        image_embedding_fingerprint = $4,
        image_embedding_model = $5,
        image_embedding_dims = $6,
        image_embedding_vec = $7::vector(768),
        image_embedding_updated_at = $8::timestamptz,
        image_embedding_error = $9
      where partner_id = $1::uuid and id = $2::uuid
      returning id::text as id`,
      [
        partnerId,
        inventoryId,
        jsonPayload,
        patch.image_embedding_fingerprint,
        patch.image_embedding_model,
        patch.image_embedding_dims,
        patch.image_embedding_vec,
        patch.image_embedding_updated_at,
        patch.image_embedding_error,
      ]
    )
    return rows.length > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryEmbeddingFieldsFromPg]', e)
    return false
  }
}

/**
 * Toàn bộ dòng inventory của partner, `created_at` / `id` tăng (giống import batch).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryFullListOrderedCreatedFromPg(
  partnerId: string
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const all: MessagingPartnerInventoryRow[] = []
  let from = 0
  try {
    while (true) {
      const rows = await pgQuery<PgInventoryRaw>(
        `${INVENTORY_PAGE_SELECT}
         where mpi.partner_id = $1::uuid
         order by mpi.created_at asc nulls last, mpi.id asc
         limit $2 offset $3`,
        [partnerId, INVENTORY_FULL_LIST_PAGE, from]
      )
      if (rows.length === 0) break
      all.push(...rows.map(mapPgInventoryRow))
      if (rows.length < INVENTORY_FULL_LIST_PAGE) break
      from += INVENTORY_FULL_LIST_PAGE
    }
    return all
  } catch (e) {
    console.warn('[fetchPartnerInventoryFullListOrderedCreatedFromPg]', e)
    return null
  }
}

/** `true` nếu chạy xong; `false` = không pool hoặc lỗi. */
export async function deletePartnerInventoryByIdsForPartnerFromPg(
  partnerId: string,
  ids: string[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (ids.length === 0) return true
  try {
    await getPgPool().query(
      `delete from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [partnerId, ids]
    )
    return true
  } catch (e) {
    console.warn('[deletePartnerInventoryByIdsForPartnerFromPg]', e)
    return false
  }
}

function inventoryInsertRowParams(r: MessagingPartnerInventoryInsert): unknown[] | null {
  const id = r.id
  const partnerId = r.partner_id
  if (!id || !partnerId) return null
  const nowIso = new Date().toISOString()
  return [
    id,
    partnerId,
    r.sort_order ?? 0,
    r.sku ?? null,
    r.name ?? '',
    r.description ?? '',
    r.stock_note ?? '',
    r.price_hint ?? '',
    r.image_url ?? '',
    r.product_url ?? '',
    r.consult_note ?? '',
    r.is_active !== false,
    r.created_at ?? nowIso,
    r.updated_at ?? nowIso,
  ]
}

/**
 * Insert một chunk (import mới). Chỉ các cột nghiệp vụ + timestamp — không đụng embedding/vision.
 * `false` = không pool, thiếu id, hoặc lỗi SQL.
 */
export async function insertPartnerInventoryChunkFromPg(
  rows: MessagingPartnerInventoryInsert[]
): Promise<boolean> {
  if (!isPgConfigured() || rows.length === 0) return false
  try {
    const params: unknown[] = []
    const valuesSql: string[] = []
    let p = 1
    for (const r of rows) {
      const rowParams = inventoryInsertRowParams(r)
      if (!rowParams) return false
      valuesSql.push(
        `($${p++}::uuid, $${p++}::uuid, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::bool, $${p++}::timestamptz, $${p++}::timestamptz)`
      )
      params.push(...rowParams)
    }
    await getPgPool().query(
      `insert into public.messaging_partner_inventory (
        id, partner_id, sort_order, sku, name, description, stock_note, price_hint,
        image_url, product_url, consult_note, is_active, created_at, updated_at
      ) values ${valuesSql.join(', ')}`,
      params
    )
    return true
  } catch (e) {
    console.warn('[insertPartnerInventoryChunkFromPg]', e)
    return false
  }
}

/**
 * Upsert chunk (`on conflict (id)`) — tương đương upsert REST trước đây; không ghi đè embedding nếu không gửi.
 * `false` = không pool hoặc lỗi.
 */
export async function upsertPartnerInventoryChunkFromPg(
  rows: MessagingPartnerInventoryInsert[]
): Promise<boolean> {
  if (!isPgConfigured() || rows.length === 0) return false
  try {
    const params: unknown[] = []
    const valuesSql: string[] = []
    let p = 1
    for (const r of rows) {
      const rowParams = inventoryInsertRowParams(r)
      if (!rowParams) return false
      valuesSql.push(
        `($${p++}::uuid, $${p++}::uuid, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::bool, $${p++}::timestamptz, $${p++}::timestamptz)`
      )
      params.push(...rowParams)
    }
    await getPgPool().query(
      `insert into public.messaging_partner_inventory (
        id, partner_id, sort_order, sku, name, description, stock_note, price_hint,
        image_url, product_url, consult_note, is_active, created_at, updated_at
      ) values ${valuesSql.join(', ')}
      on conflict (id) do update set
        partner_id = excluded.partner_id,
        sort_order = excluded.sort_order,
        sku = excluded.sku,
        name = excluded.name,
        description = excluded.description,
        stock_note = excluded.stock_note,
        price_hint = excluded.price_hint,
        image_url = excluded.image_url,
        product_url = excluded.product_url,
        consult_note = excluded.consult_note,
        is_active = excluded.is_active,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
      where public.messaging_partner_inventory.partner_id = excluded.partner_id`,
      params
    )
    return true
  } catch (e) {
    console.warn('[upsertPartnerInventoryChunkFromPg]', e)
    return false
  }
}

export type PartnerInventoryEmbeddingStatsAgg = {
  total: number
  eligible: number
  done: number
  pending: number
  failed: number
}

/** Thống kê embedding (cùng logic vòng lặp dashboard). `null` = lỗi / không pool. */
export async function fetchPartnerInventoryEmbeddingStatsFromPg(
  partnerId: string
): Promise<PartnerInventoryEmbeddingStatsAgg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      total: string | number
      eligible: string | number
      done: string | number
      pending: string | number
      failed: string | number
    }>(
      `with inv as (
         select *
         from public.messaging_partner_inventory
         where partner_id = $1::uuid
       ),
       el as (
         select *
         from inv
         where coalesce(is_active, true)
           and (
             trim(coalesce(image_url, '')) ~* '^https?://'
             or trim(coalesce(image_url, '')) like '//%'
           )
       )
       select
         (select count(*)::bigint from inv) as total,
         (select count(*)::bigint from el) as eligible,
         (select count(*)::bigint from el where image_embedding_updated_at is not null) as done,
         (select count(*)::bigint from el where image_embedding_updated_at is null) as pending,
         (select count(*)::bigint from el where trim(coalesce(image_embedding_error, '')) <> '') as failed`,
      [partnerId]
    )
    if (!row) return null
    const n = (v: string | number) => Math.max(0, Math.floor(Number(v)))
    return {
      total: n(row.total),
      eligible: n(row.eligible),
      done: n(row.done),
      pending: n(row.pending),
      failed: n(row.failed),
    }
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return { total: 0, eligible: 0, done: 0, pending: 0, failed: 0 }
    }
    console.warn('[fetchPartnerInventoryEmbeddingStatsFromPg]', e)
    return null
  }
}

export async function updatePartnerInventoryDashboardItemFromPg(
  partnerId: string,
  itemId: string,
  fields: {
    name: string
    sku: string | null
    description: string
    stock_note: string
    price_hint: string
    image_url: string
    product_url: string
    consult_note: string
    sort_order: number
    updated_at: string
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory set
        name = $3,
        sku = $4,
        description = $5,
        stock_note = $6,
        price_hint = $7,
        image_url = $8,
        product_url = $9,
        consult_note = $10,
        sort_order = $11,
        is_active = true,
        updated_at = $12::timestamptz
       where partner_id = $1::uuid and id = $2::uuid`,
      [
        partnerId,
        itemId,
        fields.name,
        fields.sku,
        fields.description,
        fields.stock_note,
        fields.price_hint,
        fields.image_url,
        fields.product_url,
        fields.consult_note,
        fields.sort_order,
        fields.updated_at,
      ]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryDashboardItemFromPg]', e)
    return false
  }
}

export async function insertPartnerInventoryDashboardItemFromPg(
  partnerId: string,
  fields: {
    name: string
    sku: string | null
    description: string
    stock_note: string
    price_hint: string
    image_url: string
    product_url: string
    consult_note: string
    sort_order: number
    created_at: string
    updated_at: string
  }
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_inventory (
        partner_id, name, sku, description, stock_note, price_hint, image_url, product_url, consult_note,
        sort_order, is_active, created_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11::timestamptz, $12::timestamptz
      )
      returning id::text as id`,
      [
        partnerId,
        fields.name,
        fields.sku,
        fields.description,
        fields.stock_note,
        fields.price_hint,
        fields.image_url,
        fields.product_url,
        fields.consult_note,
        fields.sort_order,
        fields.created_at,
        fields.updated_at,
      ]
    )
    return row?.id ?? null
  } catch (e) {
    console.warn('[insertPartnerInventoryDashboardItemFromPg]', e)
    return null
  }
}

export async function deletePartnerInventoryItemForPartnerFromPg(
  partnerId: string,
  itemId: string
): Promise<boolean> {
  return deletePartnerInventoryByIdsForPartnerFromPg(partnerId, [itemId])
}

/**
 * Các dòng kho đang active, `updated_at` mới nhất trước — dùng cron embed để ưu tiên partner vừa cập nhật.
 */
export async function fetchActivePartnerInventoryScanRowsFromPg(
  limit: number
): Promise<Array<{ partner_id: string; updated_at: string }> | null> {
  if (!isPgConfigured()) return null
  const cap = Math.max(1, Math.min(100_000, limit))
  try {
    const rows = await pgQuery<{ partner_id: string; updated_at: unknown }>(
      `select partner_id::text, updated_at
       from public.messaging_partner_inventory
       where coalesce(is_active, true) = true
       order by updated_at desc
       limit $1::int`,
      [cap]
    )
    return rows.map((r) => ({
      partner_id: r.partner_id,
      updated_at: tsIsoReq(r.updated_at),
    }))
  } catch (e) {
    console.error('[messaging-partner-inventory-pg] fetchActivePartnerInventoryScanRowsFromPg', e)
    return null
  }
}
