import { randomUUID } from 'node:crypto'
import type { Database } from '@/types/database.types'
import {
  deletePartnerInventoryByIdsForPartnerFromPg,
  fetchPartnerInventoryFullListOrderedCreatedFromPg,
  insertPartnerInventoryChunkFromPg,
  upsertPartnerInventoryChunkFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import {
  inventoryNameMatchKey,
  inventorySkuMatchKey,
} from '@/lib/messaging/partner-inventory-excel'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'

type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
type InventoryInsert = Database['public']['Tables']['messaging_partner_inventory']['Insert']
const WRITE_CHUNK_SIZE = 500

type InventoryUpsertBase = {
  name: string
  sku: string | null
  description: string
  stock_note: string
  stock_qty: number
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
    row.stock_qty === base.stock_qty &&
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

function dedupeExistingBySku(rows: InventoryRow[]): { canonical: InventoryRow[]; duplicateIds: string[] } {
  const bySku = new Map<string, InventoryRow[]>()
  const noSku: InventoryRow[] = []
  for (const row of rows) {
    const skuKey = inventorySkuMatchKey(row.sku)
    if (!skuKey) {
      noSku.push(row)
      continue
    }
    const bucket = bySku.get(skuKey) ?? []
    bucket.push(row)
    bySku.set(skuKey, bucket)
  }

  const canonical: InventoryRow[] = [...noSku]
  const duplicateIds: string[] = []
  for (const bucket of bySku.values()) {
    bucket.sort((a, b) => {
      const u = (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
      if (u !== 0) return u
      const c = (b.created_at ?? '').localeCompare(a.created_at ?? '')
      if (c !== 0) return c
      return a.id.localeCompare(b.id)
    })
    canonical.push(bucket[0])
    for (let i = 1; i < bucket.length; i++) duplicateIds.push(bucket[i].id)
  }
  return { canonical, duplicateIds }
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
    stock_qty: base.stock_qty,
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
  partnerId: string
): Promise<{ ok: true; rows: InventoryRow[] } | { ok: false; error: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'Postgres (DATABASE_URL) is not configured.' }
  }
  const fromPg = await fetchPartnerInventoryFullListOrderedCreatedFromPg(partnerId)
  if (fromPg === null) {
    return { ok: false, error: 'Could not load inventory from Postgres.' }
  }
  return { ok: true, rows: fromPg as InventoryRow[] }
}

export async function upsertPartnerInventoryBatch(
  partnerId: string,
  rows: InventoryExcelInsert[],
  options?: { existingRows?: InventoryRow[] }
): Promise<
  { ok: true; inserted: number; updated: number; deleted: number } | { ok: false; error: string }
> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'Postgres (DATABASE_URL) is not configured.' }
  }

  const now = new Date().toISOString()

  let resolvedExistingRows: InventoryRow[]
  if (options?.existingRows) {
    resolvedExistingRows = options.existingRows
  } else {
    const listed = await listPartnerInventoryRows(partnerId)
    if (!listed.ok) return { ok: false, error: listed.error }
    resolvedExistingRows = listed.rows
  }
  const deduped = dedupeExistingBySku(resolvedExistingRows)
  resolvedExistingRows = deduped.canonical
  const existingById = new Map(resolvedExistingRows.map((r) => [r.id, r]))
  const bySku = indexExistingBySku(resolvedExistingRows)
  const byNameNoSku = indexExistingNoSkuByName(resolvedExistingRows)

  const skuResolvedId = new Map<string, string>()
  const nameNoSkuResolvedId = new Map<string, string>()

  let inserted = 0
  let updated = 0
  let deleted = 0
  const changedIds = new Set<string>()
  const plannedDeletes = new Set<string>(deduped.duplicateIds)
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
      stock_qty: r.stock_qty,
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
    const ok = await deletePartnerInventoryByIdsForPartnerFromPg(partnerId, ids)
    if (!ok) {
      return { ok: false, error: 'Inventory delete failed (Postgres).' }
    }
  }

  for (const rowsChunk of chunked(Array.from(plannedUpdates.values()), WRITE_CHUNK_SIZE)) {
    const ok = await upsertPartnerInventoryChunkFromPg(rowsChunk)
    if (!ok) {
      return { ok: false, error: 'Inventory update failed (Postgres).' }
    }
  }

  for (const rowsChunk of chunked(Array.from(plannedInserts.values()), WRITE_CHUNK_SIZE)) {
    const ok = await insertPartnerInventoryChunkFromPg(rowsChunk)
    if (!ok) {
      return { ok: false, error: 'Inventory insert failed (Postgres).' }
    }
  }

  if (changedIds.size > 0) {
    await syncPartnerInventoryEmbeddings(partnerId, {
      inventoryIds: Array.from(changedIds),
      force: false,
    })
  }

  return { ok: true, inserted, updated, deleted }
}
