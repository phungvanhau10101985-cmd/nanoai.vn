import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import {
  inventoryNameMatchKey,
  inventorySkuMatchKey,
} from '@/lib/messaging/partner-inventory-excel'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'

type Db = SupabaseClient<Database>
type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
type InventoryInsert = Database['public']['Tables']['messaging_partner_inventory']['Insert']
const INVENTORY_SELECT_PAGE_SIZE = 1000
const WRITE_CHUNK_SIZE = 500

type InventoryUpsertBase = {
  name: string
  sku: string | null
  description: string
  stock_note: string
  price_hint: string
  image_url: string
  product_url: string
  consult_note: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

function sameInventoryData(row: InventoryRow, base: InventoryUpsertBase): boolean {
  return (
    row.name === base.name &&
    row.sku === base.sku &&
    row.description === base.description &&
    row.stock_note === base.stock_note &&
    row.price_hint === base.price_hint &&
    row.image_url === base.image_url &&
    row.product_url === base.product_url &&
    row.consult_note === base.consult_note &&
    row.sort_order === base.sort_order &&
    row.is_active === base.is_active
  )
}

function indexExistingBySku(rows: InventoryRow[]) {
  const m = new Map<string, InventoryRow[]>()
  for (const r of rows) {
    const k = inventorySkuMatchKey(r.sku)
    if (!k) continue
    const arr = m.get(k) ?? []
    arr.push(r)
    m.set(k, arr)
  }
  return m
}

function indexExistingNoSkuByName(rows: InventoryRow[]) {
  const m = new Map<string, InventoryRow[]>()
  for (const r of rows) {
    if (inventorySkuMatchKey(r.sku)) continue
    const nk = inventoryNameMatchKey(r.name)
    const arr = m.get(nk) ?? []
    arr.push(r)
    m.set(nk, arr)
  }
  return m
}

function chunked<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function toInventoryRow(id: string, partnerId: string, base: InventoryUpsertBase, createdAt: string): InventoryRow {
  return {
    id,
    partner_id: partnerId,
    sort_order: base.sort_order,
    sku: base.sku,
    name: base.name,
    description: base.description,
    stock_note: base.stock_note,
    price_hint: base.price_hint,
    image_url: base.image_url,
    product_url: base.product_url,
    consult_note: base.consult_note,
    is_active: base.is_active,
    image_embedding_json: null,
    image_embedding_fingerprint: null,
    image_embedding_model: null,
    image_embedding_dims: null,
    image_embedding_vec: null,
    image_embedding_updated_at: null,
    image_embedding_error: null,
    vision_catalog_checksum: null,
    vision_catalog_synced_at: null,
    vision_catalog_excluded: false,
    created_at: createdAt,
    updated_at: base.updated_at,
  }
}

/**
 * Upsert nhiều dòng kho theo cùng quy tắc import Excel (SKU → khớp SKU; không SKU → khớp tên).
 * Dùng cho import Excel và cổng Open Catalog (JSON).
 */
export async function listPartnerInventoryRows(
  db: Db,
  partnerId: string
): Promise<{ ok: true; rows: InventoryRow[] } | { ok: false; error: string }> {
  const allRows: InventoryRow[] = []
  let from = 0
  while (true) {
    const to = from + INVENTORY_SELECT_PAGE_SIZE - 1
    const { data, error } = await db
      .from('messaging_partner_inventory')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: true })
      .range(from, to)
    if (error) return { ok: false, error: error.message }
    const chunk = data ?? []
    if (chunk.length === 0) break
    allRows.push(...chunk)
    if (chunk.length < INVENTORY_SELECT_PAGE_SIZE) break
    from += INVENTORY_SELECT_PAGE_SIZE
  }
  return { ok: true, rows: allRows }
}

export async function upsertPartnerInventoryBatch(
  db: Db,
  partnerId: string,
  rows: InventoryExcelInsert[],
  options?: { existingRows?: InventoryRow[] }
): Promise<
  { ok: true; inserted: number; updated: number; deleted: number } | { ok: false; error: string }
> {
  const now = new Date().toISOString()

  let resolvedExistingRows: InventoryRow[]
  if (options?.existingRows) {
    resolvedExistingRows = options.existingRows
  } else {
    const listed = await listPartnerInventoryRows(db, partnerId)
    if (!listed.ok) return { ok: false, error: listed.error }
    resolvedExistingRows = listed.rows
  }
  const existingById = new Map(resolvedExistingRows.map((r) => [r.id, r]))
  const bySku = indexExistingBySku(resolvedExistingRows)
  const byNameNoSku = indexExistingNoSkuByName(resolvedExistingRows)

  const skuResolvedId = new Map<string, string>()
  const nameNoSkuResolvedId = new Map<string, string>()

  let inserted = 0
  let updated = 0
  let deleted = 0
  const changedIds = new Set<string>()
  const plannedDeletes = new Set<string>()
  const plannedUpdates = new Map<string, InventoryInsert>()
  const plannedInserts = new Map<string, InventoryInsert>()
  const countedUpdatedIds = new Set<string>()

  const dropFromSkuIndex = (skuKey: string, invId: string) => {
    const arr = bySku.get(skuKey)
    if (!arr) return
    const i = arr.findIndex((x) => x.id === invId)
    if (i >= 0) arr.splice(i, 1)
    if (arr.length === 0) bySku.delete(skuKey)
  }

  const dropFromNameNoSkuIndex = (nk: string, invId: string) => {
    const arr = byNameNoSku.get(nk)
    if (!arr) return
    const i = arr.findIndex((x) => x.id === invId)
    if (i >= 0) arr.splice(i, 1)
    if (arr.length === 0) byNameNoSku.delete(nk)
  }

  for (const r of rows) {
    const skuKey = inventorySkuMatchKey(r.sku)
    let targetId: string | null = null

    if (skuKey) {
      targetId = skuResolvedId.get(skuKey) ?? null
      if (!targetId) {
        const first = bySku.get(skuKey)?.[0]
        if (first) targetId = first.id
      }
    } else {
      const nk = inventoryNameMatchKey(r.name)
      targetId = nameNoSkuResolvedId.get(nk) ?? null
      if (!targetId) {
        const list = (byNameNoSku.get(nk) ?? []).filter((x) => !inventorySkuMatchKey(x.sku))
        if (list.length === 1) {
          targetId = list[0].id
        } else if (list.length > 1) {
          targetId = (list.find((x) => x.sort_order === r.sort_order) ?? list[0]).id
        }
      }
    }

    if (r.removeFromInventory) {
      if (!targetId) continue
      // Nếu target là dòng mới vừa phát sinh trong cùng payload, bỏ insert plan là đủ.
      if (plannedInserts.has(targetId)) {
        plannedInserts.delete(targetId)
        existingById.delete(targetId)
        inserted = Math.max(0, inserted - 1)
        changedIds.delete(targetId)
      } else if (existingById.has(targetId) && !plannedDeletes.has(targetId)) {
        plannedDeletes.add(targetId)
        plannedUpdates.delete(targetId)
        existingById.delete(targetId)
        deleted += 1
        changedIds.add(targetId)
      }
      if (skuKey) {
        skuResolvedId.delete(skuKey)
        dropFromSkuIndex(skuKey, targetId)
      } else {
        const nk = inventoryNameMatchKey(r.name)
        nameNoSkuResolvedId.delete(nk)
        dropFromNameNoSkuIndex(nk, targetId)
      }
      continue
    }

    const base: InventoryUpsertBase = {
      name: r.name,
      sku: r.sku,
      description: r.description,
      stock_note: r.stock_note,
      price_hint: r.price_hint,
      image_url: r.image_url,
      product_url: r.product_url,
      consult_note: r.consult_note,
      sort_order: r.sort_order,
      is_active: r.is_active,
      updated_at: now,
    }

    if (targetId) {
      const current = existingById.get(targetId)
      if (current && sameInventoryData(current, base)) {
        // Dòng không đổi dữ liệu => không update DB, tránh trigger đồng bộ Vision không cần thiết.
        if (skuKey) skuResolvedId.set(skuKey, targetId)
        else nameNoSkuResolvedId.set(inventoryNameMatchKey(r.name), targetId)
        continue
      }
      if (plannedInserts.has(targetId)) {
        const prev = plannedInserts.get(targetId)
        if (prev) plannedInserts.set(targetId, { ...prev, ...base })
      } else {
        const existing = existingById.get(targetId)
        plannedUpdates.set(targetId, {
          id: targetId,
          partner_id: partnerId,
          created_at: existing?.created_at ?? now,
          ...base,
        })
        if (!countedUpdatedIds.has(targetId)) {
          countedUpdatedIds.add(targetId)
          updated += 1
        }
      }
      changedIds.add(targetId)
      existingById.set(targetId, {
        ...(current ?? toInventoryRow(targetId, partnerId, base, now)),
        ...base,
      })
      if (skuKey) skuResolvedId.set(skuKey, targetId)
      else nameNoSkuResolvedId.set(inventoryNameMatchKey(r.name), targetId)
    } else {
      const newId = randomUUID()
      plannedInserts.set(newId, {
        id: newId,
        partner_id: partnerId,
        ...base,
        created_at: now,
      })
      inserted += 1
      changedIds.add(newId)
      existingById.set(newId, toInventoryRow(newId, partnerId, base, now))
      if (skuKey) skuResolvedId.set(skuKey, newId)
      else nameNoSkuResolvedId.set(inventoryNameMatchKey(r.name), newId)
    }
  }

  for (const ids of chunked(Array.from(plannedDeletes), WRITE_CHUNK_SIZE)) {
    const { error } = await db
      .from('messaging_partner_inventory')
      .delete()
      .eq('partner_id', partnerId)
      .in('id', ids)
    if (error) return { ok: false, error: error.message }
  }

  for (const rowsChunk of chunked(Array.from(plannedUpdates.values()), WRITE_CHUNK_SIZE)) {
    const { error } = await db
      .from('messaging_partner_inventory')
      .upsert(rowsChunk, { onConflict: 'id' })
    if (error) return { ok: false, error: error.message }
  }

  for (const rowsChunk of chunked(Array.from(plannedInserts.values()), WRITE_CHUNK_SIZE)) {
    const { error } = await db
      .from('messaging_partner_inventory')
      .insert(rowsChunk)
    if (error) return { ok: false, error: error.message }
  }

  if (changedIds.size > 0) {
    await syncPartnerInventoryEmbeddings(db, partnerId, {
      inventoryIds: Array.from(changedIds),
      force: false,
    })
  }

  return { ok: true, inserted, updated, deleted }
}
