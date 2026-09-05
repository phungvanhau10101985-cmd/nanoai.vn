import {
  assignInventoryToCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
  fetchPartnerCategoryByIdFromPg,
  insertPartnerCategoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { slugifyPartnerCategoryName } from '@/lib/partner-website/category/partner-category-types'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import {
  categoryNeedsSeoFill,
  fillPartnerCategoriesSeoIfEmpty,
  loadPartnerCategoryShopSeoContext,
  type PartnerCategoryShopSeoContext,
} from '@/lib/partner-website/category/partner-category-fill-seo'
import { buildPartnerCategorySeoTitle } from '@/lib/partner-website/category/partner-category-seo-ai'
import { resolveCategorySiblingBySeoIntent } from '@/lib/partner-website/category/partner-category-seo-intent'
import { shouldSkipPartnerCategoryImportName } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'
import { proposeProductStudioCategoryPath } from '@/lib/partner-website/category/partner-category-taxonomy-propose'

export type PlaceProductCategoryHint = {
  productName: string
  productType?: string
  gender?: string
  material?: string
  style?: string
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
}

export type PlaceProductCategoryResult = {
  ok: boolean
  categoryId: string | null
  createdIds: string[]
  reusedIds: string[]
  warnings: string[]
  error?: string
}

type PlaceSession = {
  partnerId: string
  rows: PartnerCategoryRow[]
  shop: PartnerCategoryShopSeoContext
  createdIds: Set<string>
  reusedIds: Set<string>
  needsSeoIds: Set<string>
  intentCache: Map<string, string | null>
  warnings: string[]
}

async function startSession(partnerId: string): Promise<PlaceSession | null> {
  const listed = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
  if (listed === null) return null
  const shop = await loadPartnerCategoryShopSeoContext(partnerId)
  return {
    partnerId,
    rows: [...listed],
    shop,
    createdIds: new Set(),
    reusedIds: new Set(),
    needsSeoIds: new Set(),
    intentCache: new Map(),
    warnings: [],
  }
}

function markTouched(session: PlaceSession, row: PartnerCategoryRow, created: boolean) {
  if (created) session.createdIds.add(row.id)
  else session.reusedIds.add(row.id)
  if (created || categoryNeedsSeoFill(row)) session.needsSeoIds.add(row.id)
}

async function ensureLevel(
  session: PlaceSession,
  parentId: string | null,
  name: string,
  opts?: { aiGenerated?: boolean }
): Promise<PartnerCategoryRow | null> {
  const trimmed = name.trim().slice(0, 200)
  if (!trimmed) return parentId ? session.rows.find((c) => c.id === parentId) ?? null : null
  if (shouldSkipPartnerCategoryImportName(trimmed)) {
    return parentId ? session.rows.find((c) => c.id === parentId) ?? null : null
  }

  const matched = await resolveCategorySiblingBySeoIntent({
    rows: session.rows,
    parentId,
    name: trimmed,
    cache: session.intentCache,
  })
  if (matched) {
    markTouched(session, matched, false)
    return matched
  }

  const created = await insertPartnerCategoryFromPg({
    partnerId: session.partnerId,
    parentId,
    name: trimmed,
    slug: slugifyPartnerCategoryName(trimmed),
    isActive: true,
    sortOrder: session.rows.filter((c) => (c.parentId ?? null) === parentId).length,
    seoTitle: buildPartnerCategorySeoTitle(trimmed, session.shop.shopDisplayName),
    aiGenerated: opts?.aiGenerated === true,
  })
  if (!created.ok) {
    const again = await fetchPartnerCategoriesFlatFromPg(session.partnerId, { activeOnly: false })
    if (again) {
      session.rows.splice(0, session.rows.length, ...again)
      const raced = await resolveCategorySiblingBySeoIntent({
        rows: session.rows,
        parentId,
        name: trimmed,
        cache: session.intentCache,
      })
      if (raced) {
        markTouched(session, raced, false)
        return raced
      }
    }
    session.warnings.push(`place_category: create "${trimmed}" failed (${created.error})`)
    return null
  }
  session.rows.push(created.row)
  markTouched(session, created.row, true)
  return created.row
}

async function resolveHintPath(
  session: PlaceSession,
  hint: PlaceProductCategoryHint,
  opts?: { aiGenerated?: boolean }
): Promise<PartnerCategoryRow | null> {
  const l1Name = (hint.categoryL1 ?? '').trim()
  if (!l1Name || shouldSkipPartnerCategoryImportName(l1Name)) return null
  const n1 = await ensureLevel(session, null, l1Name, opts)
  if (!n1) return null
  const l2Name = (hint.categoryL2 ?? '').trim()
  if (l2Name && shouldSkipPartnerCategoryImportName(l2Name)) return n1
  const n2 = l2Name ? await ensureLevel(session, n1.id, l2Name, opts) : n1
  if (!n2) return n1
  const l3Name = (hint.categoryL3 ?? '').trim()
  if (l3Name && shouldSkipPartnerCategoryImportName(l3Name)) return n2
  const n3 = l3Name ? await ensureLevel(session, n2.id, l3Name, opts) : n2
  return n3 ?? n2
}

function fallbackCategoryNamesFromProduct(hint: PlaceProductCategoryHint): {
  categoryL1: string
  categoryL2: string
  categoryL3?: string
} {
  const genderRaw = (hint.gender ?? '').trim().toLowerCase()
  const gender =
    /^(nam|men|male|mens)$/.test(genderRaw) ? 'nam' : /^(nu|nữ|women|female|womens)$/.test(genderRaw) ? 'nữ' : ''
  const style = (hint.style ?? '').trim()
  const type = (hint.productType ?? 'other').trim()
  if (type === 'shoes') {
    return {
      categoryL1: gender ? `Giày dép ${gender}` : 'Giày dép',
      categoryL2: style || 'Giày',
    }
  }
  if (type === 'accessory') {
    return { categoryL1: 'Phụ kiện', categoryL2: style || 'Phụ kiện thời trang' }
  }
  if (type === 'household') {
    return { categoryL1: 'Gia dụng', categoryL2: style || 'Đồ gia dụng' }
  }
  if (type === 'food') {
    return { categoryL1: 'Thực phẩm', categoryL2: style || 'Đồ ăn' }
  }
  if (type === 'apparel') {
    return {
      categoryL1: gender ? `Thời trang ${gender}` : 'Thời trang',
      categoryL2: style || 'Áo',
    }
  }
  return {
    categoryL1: 'Sản phẩm',
    categoryL2: style || hint.productName.trim().slice(0, 40) || 'Khác',
  }
}

async function finishSession(
  session: PlaceSession,
  sampleProductNames: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const filled = await fillPartnerCategoriesSeoIfEmpty({
    partnerId: session.partnerId,
    categoryIds: [...session.needsSeoIds],
    shop: session.shop,
    sampleProductNames,
    concurrency: 2,
  })
  if (!filled.ok) return { ok: false, error: filled.error }
  return { ok: true }
}

function toResult(
  session: PlaceSession,
  categoryId: string | null,
  extra?: { error?: string }
): PlaceProductCategoryResult {
  return {
    ok: !extra?.error,
    categoryId,
    createdIds: [...session.createdIds],
    reusedIds: [...session.reusedIds],
    warnings: session.warnings,
    error: extra?.error,
  }
}

/**
 * Import Excel 41 cột / Open Catalog / sync ngoài — tìm hoặc tạo L1/L2/L3,
 * không trùng ý định SEO, rồi sinh SEO cho trang danh mục còn trống.
 * Excel 12 cột không đi qua đây (không có category_l1).
 */
export async function placeImportedInventoryInCategoryTreeBatch(
  partnerId: string,
  items: Array<{
    inventoryId: string
    categoryL1?: string | null
    categoryL2?: string | null
    categoryL3?: string | null
    productName?: string
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const work = items.filter((item) => item.inventoryId && (item.categoryL1 ?? '').trim())
  if (work.length === 0) return { ok: true }
  const session = await startSession(partnerId)
  if (!session) return { ok: false, error: 'db_error' }

  const pathCache = new Map<string, string | null>()
  const samples: string[] = []
  for (const item of work) {
    const pathKey = [item.categoryL1, item.categoryL2, item.categoryL3]
      .map((v) => (v ?? '').trim().toLowerCase())
      .join('>')
    let leafId = pathCache.get(pathKey)
    if (leafId === undefined) {
      const leaf = await resolveHintPath(session, {
        productName: item.productName ?? '',
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        categoryL3: item.categoryL3,
      })
      leafId = leaf?.id ?? null
      pathCache.set(pathKey, leafId)
    }
    if (!leafId) continue
    await assignInventoryToCategoryFromPg(partnerId, item.inventoryId, leafId, true)
    if (item.productName?.trim() && samples.length < 8) samples.push(item.productName.trim())
  }
  return finishSession(session, samples)
}

export async function placeProductStudioInventoryInCategoryTree(input: {
  partnerId: string
  inventoryId: string
  payload: ProductStudioJobPayload
  productName: string
  preferredCategoryId?: string | null
}): Promise<PlaceProductCategoryResult> {
  const session = await startSession(input.partnerId)
  if (!session) {
    return {
      ok: false,
      categoryId: null,
      createdIds: [],
      reusedIds: [],
      warnings: ['place_category: could not read tree'],
      error: 'db_error',
    }
  }

  const preferred = (input.preferredCategoryId ?? '').trim()
  if (preferred) {
    const existing = await fetchPartnerCategoryByIdFromPg(input.partnerId, preferred)
    if (existing) {
      markTouched(session, existing, false)
      const ancestors = session.rows.filter((c) => existing.path.startsWith(`${c.path}/`) || c.id === existing.id)
      for (const node of ancestors) {
        if (categoryNeedsSeoFill(node)) session.needsSeoIds.add(node.id)
      }
      await assignInventoryToCategoryFromPg(input.partnerId, input.inventoryId, existing.id, true)
      const seo = await finishSession(session, [input.productName])
      if (!seo.ok) return toResult(session, existing.id, { error: seo.error })
      return toResult(session, existing.id)
    }
    session.warnings.push('place_category: preferred categoryId not found — classifying from product')
  }

  const proposed = await proposeProductStudioCategoryPath(input.payload, input.productName, session.rows)
  let leaf: PartnerCategoryRow | null = null
  if (proposed?.l1) {
    const byId = new Map(session.rows.map((c) => [c.id, c]))
    const takeOrCreate = async (
      level: { matchId?: string; name: string } | undefined,
      parent: PartnerCategoryRow | null,
      expectedDepth: number
    ): Promise<PartnerCategoryRow | null> => {
      if (!level) return null
      if (level.matchId) {
        const existing = byId.get(level.matchId)
        const parentOk = expectedDepth === 1 ? existing?.parentId == null : existing?.parentId === parent?.id
        if (existing && existing.depth === expectedDepth && parentOk) {
          markTouched(session, existing, false)
          return existing
        }
        session.warnings.push(
          `place_category: matchId "${level.matchId}" invalid at depth ${expectedDepth} — resolve by intent`
        )
      }
      if (!level.name.trim()) return null
      const created = await ensureLevel(session, parent?.id ?? null, level.name, { aiGenerated: true })
      if (created) byId.set(created.id, created)
      return created
    }
    const l1 = await takeOrCreate(proposed.l1, null, 1)
    const l2 = l1 ? await takeOrCreate(proposed.l2, l1, 2) : null
    const l3 = l2 ? await takeOrCreate(proposed.l3, l2, 3) : null
    leaf = l3 ?? l2 ?? l1
  }

  if (!leaf) {
    session.warnings.push('place_category: AI path unused — fallback from product type')
    leaf = await resolveHintPath(session, {
      productName: input.productName,
      ...fallbackCategoryNamesFromProduct({
        productName: input.productName,
        productType: input.payload.productType,
        gender: input.payload.gender,
        style: input.payload.style,
        material: input.payload.material,
      }),
    }, { aiGenerated: true })
  }

  if (!leaf) {
    return toResult(session, null, { error: 'place_category_failed' })
  }
  await assignInventoryToCategoryFromPg(input.partnerId, input.inventoryId, leaf.id, true)
  const seo = await finishSession(session, [input.productName])
  if (!seo.ok) return toResult(session, leaf.id, { error: seo.error })
  return toResult(session, leaf.id)
}
