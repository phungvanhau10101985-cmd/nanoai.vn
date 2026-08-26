import {
  assignInventoryToCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
  insertPartnerCategoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { slugifyPartnerCategoryName } from '@/lib/partner-website/category/partner-category-types'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'

function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function findChild(
  rows: PartnerCategoryRow[],
  parentId: string | null,
  name: string
): PartnerCategoryRow | undefined {
  const key = nameKey(name)
  return rows.find((c) => (c.parentId ?? null) === parentId && nameKey(c.name) === key)
}

async function ensureLevel(
  partnerId: string,
  rows: PartnerCategoryRow[],
  parentId: string | null,
  name: string
): Promise<PartnerCategoryRow | null> {
  const trimmed = name.trim().slice(0, 200)
  if (!trimmed) return parentId ? rows.find((c) => c.id === parentId) ?? null : null
  const existing = findChild(rows, parentId, trimmed)
  if (existing) return existing
  const created = await insertPartnerCategoryFromPg({
    partnerId,
    parentId,
    name: trimmed,
    slug: slugifyPartnerCategoryName(trimmed),
    isActive: true,
    sortOrder: rows.filter((c) => (c.parentId ?? null) === parentId).length,
  })
  if (!created.ok) {
    const again = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
    if (again) {
      rows.splice(0, rows.length, ...again)
      return findChild(rows, parentId, trimmed) ?? null
    }
    return null
  }
  rows.push(created.row)
  return created.row
}

export async function linkImportedInventoryToCatalogCategories(input: {
  partnerId: string
  inventoryId: string
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
}): Promise<void> {
  await linkImportedInventoryToCatalogCategoriesBatch(input.partnerId, [input])
}

/** Một lần đọc cây danh mục, rồi gán nhiều SP — dùng khi đồng bộ kho khách số lớn. */
export async function linkImportedInventoryToCatalogCategoriesBatch(
  partnerId: string,
  items: Array<{
    inventoryId: string
    categoryL1?: string | null
    categoryL2?: string | null
    categoryL3?: string | null
  }>
): Promise<void> {
  const work = items.filter((item) => item.inventoryId && (item.categoryL1 ?? '').trim())
  if (work.length === 0) return
  const listed = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
  if (listed === null) return
  const rows = [...listed]
  for (const item of work) {
    const l1 = (item.categoryL1 ?? '').trim()
    if (!l1) continue
    const n1 = await ensureLevel(partnerId, rows, null, l1)
    if (!n1) continue
    const l2 = (item.categoryL2 ?? '').trim()
    const n2 = l2 ? await ensureLevel(partnerId, rows, n1.id, l2) : n1
    if (!n2) continue
    const l3 = (item.categoryL3 ?? '').trim()
    const n3 = l3 ? await ensureLevel(partnerId, rows, n2.id, l3) : n2
    if (!n3) continue
    await assignInventoryToCategoryFromPg(partnerId, item.inventoryId, n3.id, true)
  }
}
