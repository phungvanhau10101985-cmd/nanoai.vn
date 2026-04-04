import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import {
  inventoryNameMatchKey,
  inventorySkuMatchKey,
} from '@/lib/messaging/partner-inventory-excel'

type Db = SupabaseClient<Database>
type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

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

/**
 * Upsert nhiều dòng kho theo cùng quy tắc import Excel (SKU → khớp SKU; không SKU → khớp tên).
 * Dùng cho import Excel và cổng Open Catalog (JSON).
 */
export async function upsertPartnerInventoryBatch(
  db: Db,
  partnerId: string,
  rows: InventoryExcelInsert[]
): Promise<{ ok: true; inserted: number; updated: number } | { ok: false; error: string }> {
  const now = new Date().toISOString()

  const { data: existing, error: exErr } = await db
    .from('messaging_partner_inventory')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (exErr) return { ok: false, error: exErr.message }

  const existingRows = existing ?? []
  const bySku = indexExistingBySku(existingRows)
  const byNameNoSku = indexExistingNoSkuByName(existingRows)

  const skuResolvedId = new Map<string, string>()
  const nameNoSkuResolvedId = new Map<string, string>()

  let inserted = 0
  let updated = 0

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

    const base = {
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
      const { error: upErr } = await db
        .from('messaging_partner_inventory')
        .update(base)
        .eq('id', targetId)
        .eq('partner_id', partnerId)
      if (upErr) return { ok: false, error: upErr.message }
      updated += 1
      if (skuKey) skuResolvedId.set(skuKey, targetId)
      else nameNoSkuResolvedId.set(inventoryNameMatchKey(r.name), targetId)
    } else {
      const { data: ins, error: insErr } = await db
        .from('messaging_partner_inventory')
        .insert({
          partner_id: partnerId,
          ...base,
          created_at: now,
        })
        .select('id')
        .single()

      if (insErr) return { ok: false, error: insErr.message }
      const newId = ins.id as string
      inserted += 1
      if (skuKey) skuResolvedId.set(skuKey, newId)
      else nameNoSkuResolvedId.set(inventoryNameMatchKey(r.name), newId)
    }
  }

  return { ok: true, inserted, updated }
}
