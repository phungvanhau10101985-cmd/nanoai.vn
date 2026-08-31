import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { fetchPartnerInventoryRowsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import type { PartnerCategoryTreeNode } from '@/lib/partner-website/category/partner-category-types'
import { normalizeShopImageUrl } from '@/lib/partner-website/shop/inventory-shop-detail'

export type CategoryHubImageTile = {
  id: string
  imageUrl: string
}

function lowerId(id: string): string {
  return String(id || '').trim().toLowerCase()
}

export function categoryDescendantIdMap(tree: PartnerCategoryTreeNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const walk = (node: PartnerCategoryTreeNode): string[] => {
    const ids: string[] = []
    for (const child of node.children ?? []) {
      ids.push(lowerId(child.id))
      ids.push(...walk(child))
    }
    out.set(lowerId(node.id), ids)
    return ids
  }
  for (const root of tree) walk(root)
  return out
}

export function categoryParentIdMap(tree: PartnerCategoryTreeNode[]): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (nodes: PartnerCategoryTreeNode[], parentId: string | null) => {
    for (const node of nodes) {
      const id = lowerId(node.id)
      if (parentId) out.set(id, parentId)
      if (node.children?.length) walk(node.children, id)
    }
  }
  walk(tree, null)
  return out
}

function ancestorIds(categoryId: string, parentById: Map<string, string>): string[] {
  const out: string[] = []
  let cur = parentById.get(lowerId(categoryId))
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    out.push(cur)
    cur = parentById.get(cur)
  }
  return out
}

function pushUnique(list: string[], url: string): void {
  if (!url || list.includes(url)) return
  list.push(url)
}

/** Ảnh SP vừa xem → chính danh mục + tổ tiên (L3 xem thì L2/L1 cũng nhận). Thứ tự = mới xem trước. */
export function buildViewedImagesByCategory(input: {
  viewedIds: string[]
  imagesByInventoryId: Map<string, string>
  categoryIdsByInventoryId: Map<string, string[]>
  parentIdByCategory: Map<string, string>
}): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const rawId of input.viewedIds) {
    const inv = lowerId(rawId)
    const url = normalizeShopImageUrl(input.imagesByInventoryId.get(inv) || '')
    if (!url) continue
    const cats = input.categoryIdsByInventoryId.get(inv) ?? []
    for (const cat of cats) {
      const ids = [lowerId(cat), ...ancestorIds(cat, input.parentIdByCategory)]
      for (const id of ids) {
        const list = out.get(id) ?? []
        pushUnique(list, url)
        out.set(id, list)
      }
    }
  }
  return out
}

function hashSeed(value: string): number {
  let h = 2166136261
  const s = String(value || '')
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickStableRandom(pool: string[], seed: string): string | undefined {
  if (!pool.length) return undefined
  return pool[hashSeed(seed) % pool.length]
}

function collectBranchUrls(ids: string[], byCategory: Map<string, string[]>, used: Set<string>): string[] {
  const pool: string[] = []
  for (const id of ids) {
    for (const url of byCategory.get(lowerId(id)) ?? []) {
      if (!url || used.has(url) || pool.includes(url)) continue
      pool.push(url)
    }
  }
  return pool
}

/**
 * Ô danh mục thiếu ảnh:
 * 1. Ảnh SP khách vừa xem trong danh mục đó (hoặc nhánh con).
 * 2. Một ảnh SP đại diện ngẫu nhiên (ổn định theo id danh mục) trong nhánh.
 * Ảnh đã có trên danh mục giữ nguyên. Tránh trùng URL giữa các ô khi còn ảnh khác.
 */
export function assignCategoryHubImages(input: {
  tiles: CategoryHubImageTile[]
  descendantIds: Map<string, string[]>
  viewedImagesByCategory: Map<string, string[]>
  sampleImagesByCategory: Map<string, string[]>
}): CategoryHubImageTile[] {
  const used = new Set<string>()
  return input.tiles.map((tile) => {
    const own = normalizeShopImageUrl(tile.imageUrl)
    if (own) {
      used.add(own)
      return { ...tile, imageUrl: own }
    }
    const ids = [tile.id, ...(input.descendantIds.get(lowerId(tile.id)) ?? [])]
    const viewed = collectBranchUrls(ids, input.viewedImagesByCategory, used)
    if (viewed[0]) {
      used.add(viewed[0])
      return { ...tile, imageUrl: viewed[0] }
    }
    const samples = collectBranchUrls(ids, input.sampleImagesByCategory, used)
    const picked = pickStableRandom(samples, tile.id)
    if (picked) {
      used.add(picked)
      return { ...tile, imageUrl: picked }
    }
    return { ...tile, imageUrl: own }
  })
}

export async function fetchCategorySampleImagesFromPg(partnerId: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!isPgConfigured()) return out
  try {
    const rows = await pgQuery<{ category_id: string; image_url: string }>(
      `select pic.category_id::text as category_id, coalesce(mpi.image_url, '') as image_url
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_inventory mpi on mpi.id = pic.inventory_id
       join public.messaging_partner_categories c on c.id = pic.category_id
       where c.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and coalesce(mpi.image_url, '') <> ''
       order by mpi.sort_order asc, mpi.updated_at desc
       limit 4000`,
      [partnerId]
    )
    for (const row of rows) {
      const url = normalizeShopImageUrl(row.image_url)
      if (!url) continue
      const id = lowerId(row.category_id)
      const list = out.get(id) ?? []
      if (list.length >= 12) continue
      if (list.includes(url)) continue
      list.push(url)
      out.set(id, list)
    }
  } catch (e) {
    console.warn('[fetchCategorySampleImagesFromPg]', e)
  }
  return out
}

async function fetchInventoryCategoryIdsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  const ids = inventoryIds.map(lowerId).filter(Boolean)
  if (!isPgConfigured() || !ids.length) return out
  try {
    const rows = await pgQuery<{ inventory_id: string; category_id: string }>(
      `select pic.inventory_id::text as inventory_id, pic.category_id::text as category_id
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_categories c on c.id = pic.category_id
       where c.partner_id = $1::uuid
         and pic.inventory_id = any($2::uuid[])`,
      [partnerId, ids]
    )
    for (const row of rows) {
      const inv = lowerId(row.inventory_id)
      const cat = lowerId(row.category_id)
      if (!inv || !cat) continue
      const list = out.get(inv) ?? []
      if (!list.includes(cat)) list.push(cat)
      out.set(inv, list)
    }
  } catch (e) {
    console.warn('[fetchInventoryCategoryIdsFromPg]', e)
  }
  return out
}

export async function resolveCategoryHubTileImages(input: {
  partnerId: string
  accountKey?: string | null
  tree: PartnerCategoryTreeNode[]
  tiles: CategoryHubImageTile[]
}): Promise<CategoryHubImageTile[]> {
  if (!input.tiles.length) return input.tiles
  const descendantIds = categoryDescendantIdMap(input.tree)
  const parentIdByCategory = categoryParentIdMap(input.tree)
  const accountKey = (input.accountKey || '').trim()

  const [samples, state] = await Promise.all([
    fetchCategorySampleImagesFromPg(input.partnerId),
    accountKey
      ? fetchPartnerVisitorPersonalizationFromPg({
          partnerId: input.partnerId,
          accountKey,
        })
      : Promise.resolve(null),
  ])

  const viewedIds = state?.recently_viewed_ids ?? []
  let viewedImagesByCategory = new Map<string, string[]>()
  if (viewedIds.length) {
    const rows = (await fetchPartnerInventoryRowsByIdsInOrderFromPg(input.partnerId, viewedIds)) ?? []
    const imagesByInventoryId = new Map<string, string>()
    for (const row of rows) {
      const url = normalizeShopImageUrl(row.image_url)
      if (url) imagesByInventoryId.set(lowerId(row.id), url)
    }
    const categoryIdsByInventoryId = await fetchInventoryCategoryIdsFromPg(input.partnerId, viewedIds)
    viewedImagesByCategory = buildViewedImagesByCategory({
      viewedIds,
      imagesByInventoryId,
      categoryIdsByInventoryId,
      parentIdByCategory,
    })
  }

  return assignCategoryHubImages({
    tiles: input.tiles,
    descendantIds,
    viewedImagesByCategory,
    sampleImagesByCategory: samples,
  })
}
