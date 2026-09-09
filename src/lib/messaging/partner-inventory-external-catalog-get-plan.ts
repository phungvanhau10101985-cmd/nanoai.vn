import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import { inventoryRemarketingMatchKey } from '@/lib/messaging/partner-inventory-excel'

export type InventoryRemarketingKeyRow = {
  id: string
  remarketing_id: string | null
}

/**
 * GET kho khách: mã đã có → không ghi đè; mã mới → insert; xóa chỉ theo cờ xóa của API khách.
 * Chỉ cần id + remarketing_id — không nạp full dòng kho.
 */
export function planExternalCatalogGetWrites(input: {
  incoming: InventoryExcelInsert[]
  existingKeys: InventoryRemarketingKeyRow[]
  deleteRemarketingIds: string[]
}): { insertRows: InventoryExcelInsert[]; deleteIds: string[] } {
  const idsByKey = new Map<string, string[]>()
  const existingKeys = new Set<string>()
  for (const row of input.existingKeys) {
    const id = String(row.id ?? '').trim()
    if (!id) continue
    const k = inventoryRemarketingMatchKey(row.remarketing_id)
    if (!k) continue
    existingKeys.add(k)
    const arr = idsByKey.get(k) ?? []
    arr.push(id)
    idsByKey.set(k, arr)
  }

  const deleteIds: string[] = []
  const seenDelete = new Set<string>()
  for (const raw of input.deleteRemarketingIds) {
    const k = inventoryRemarketingMatchKey(raw)
    if (!k) continue
    for (const id of idsByKey.get(k) ?? []) {
      if (seenDelete.has(id)) continue
      seenDelete.add(id)
      deleteIds.push(id)
    }
  }

  const insertRows: InventoryExcelInsert[] = []
  const seenInsert = new Set<string>()
  for (const row of input.incoming) {
    const k = inventoryRemarketingMatchKey(row.remarketing_id)
    if (!k || existingKeys.has(k) || seenInsert.has(k)) continue
    seenInsert.add(k)
    insertRows.push(row)
  }

  return { insertRows, deleteIds }
}
