import {
  fetchCategoryIdsForInventoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerInventoryPageByCategoryFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowsByCategoryL1FromPg,
  fetchPartnerInventoryRowsByTokensIlikeAnyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import type { WebLocale } from '@/lib/i18n/config'
import {
  inventoryRowToShopProduct,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  classifyOutfitAnchor,
  inferOutfitGender,
  inferOutfitRole,
  isOutfitSlotId,
  outfitMatchReasons,
  outfitNameOverlap,
  outfitSectionTitle,
  outfitSlotLabel,
  outfitSlotSearchTokens,
  rowMatchesOutfitSlot,
  scoreOutfitCandidate,
  slotsForOutfitAnchor,
  targetOutfitCat1Names,
  type OutfitGender,
  type OutfitNotApplicableReason,
  type OutfitSlotId,
} from '@/lib/partner-website/shop/pdp-outfit-roles'
import { partnerSiteCategoryPath, partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerOutfitItem = {
  product: PartnerSiteShopProduct
  matchScore: number
  reasons: string[]
}

export type PartnerOutfitSlot = {
  id: OutfitSlotId
  label: string
  listingHref: string
  items: PartnerOutfitItem[]
}

export type PartnerOutfitSuggestions = {
  applicable: boolean
  reason: OutfitNotApplicableReason | null
  anchor: {
    id: string
    role: OutfitSlotId | null
    roleLabel: string
    gender: OutfitGender
    title: string
  } | null
  slots: PartnerOutfitSlot[]
}

function categoryAncestorNames(cat: PartnerCategoryRow, byId: Map<string, PartnerCategoryRow>): string[] {
  const names: string[] = []
  let cur: PartnerCategoryRow | undefined = cat
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    names.unshift(cur.name)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return names
}

function effectivePrice(p: PartnerSiteShopProduct): number | null {
  const sale = p.salePriceAmount
  const base = p.priceAmount
  if (sale != null && sale > 0) return sale
  if (base != null && base > 0) return base
  return null
}

function samePriceBand(a: number | null, b: number | null): boolean {
  if (a == null || b == null || a <= 0 || b <= 0) return false
  return Math.abs(a - b) <= Math.max(300_000, a * 0.35)
}

export async function fetchPartnerOutfitSuggestions(input: {
  partnerId: string
  siteSlug: string
  inventoryId: string
  locale: WebLocale
  limit?: number
  slot?: OutfitSlotId | null
}): Promise<PartnerOutfitSuggestions> {
  const empty: PartnerOutfitSuggestions = {
    applicable: false,
    reason: 'no_slots',
    anchor: null,
    slots: [],
  }
  const inventoryId = String(input.inventoryId || '').trim()
  const limit = Math.min(48, Math.max(1, Math.floor(input.limit ?? 12)))
  if (!inventoryId) return empty

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(input.partnerId, inventoryId)
  if (!row) return empty
  const product = inventoryRowToShopProduct(input.siteSlug, row)
  if (!product) return empty

  const [links, cats] = await Promise.all([
    fetchCategoryIdsForInventoryFromPg(inventoryId),
    fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: true }),
  ])
  const byId = new Map((cats ?? []).map((c) => [c.id, c]))
  const primary = (links ?? []).find((l) => l.isPrimary) ?? (links ?? [])[0]
  const primaryCat = primary ? byId.get(primary.categoryId) : null
  const catNames = primaryCat ? categoryAncestorNames(primaryCat, byId) : []
  const classified = classifyOutfitAnchor([
    product.categoryL1,
    product.categoryL2,
    product.categoryL3,
    ...catNames,
    product.name,
  ])
  if (!classified.role) {
    return {
      ...empty,
      anchor: {
        id: product.id,
        role: null,
        roleLabel: '',
        gender: classified.gender,
        title: outfitSectionTitle(null, input.locale),
      },
    }
  }

  const slotIds = slotsForOutfitAnchor(classified.role, classified.gender).filter(
    (slot) => !input.slot || slot === input.slot
  )
  if (!slotIds.length) {
    return {
      applicable: false,
      reason: 'no_slots',
      anchor: {
        id: product.id,
        role: classified.role,
        roleLabel: outfitSlotLabel(classified.role, input.locale),
        gender: classified.gender,
        title: outfitSectionTitle(classified.role, input.locale),
      },
      slots: [],
    }
  }

  const categoriesBySlot = new Map<OutfitSlotId, PartnerCategoryRow[]>()
  for (const cat of cats ?? []) {
    const names = categoryAncestorNames(cat, byId)
    const role = inferOutfitRole(...names)
    if (!role || !slotIds.includes(role)) continue
    const list = categoriesBySlot.get(role) ?? []
    list.push(cat)
    categoriesBySlot.set(role, list)
  }

  const slots = await Promise.all(
    slotIds.map((slot) =>
      buildOutfitSlot({
        partnerId: input.partnerId,
        siteSlug: input.siteSlug,
        locale: input.locale,
        slot,
        excludeId: product.id,
        anchor: product,
        anchorRole: classified.role!,
        anchorGender: classified.gender,
        categories: (categoriesBySlot.get(slot) ?? []).slice(0, 4),
        categoryById: byId,
        limit,
      })
    )
  )
  const filled = slots.filter((s) => s.items.length > 0)
  return {
    applicable: filled.length > 0,
    reason: filled.length ? null : 'no_slots',
    anchor: {
      id: product.id,
      role: classified.role,
      roleLabel: outfitSlotLabel(classified.role, input.locale),
      gender: classified.gender,
      title: outfitSectionTitle(classified.role, input.locale),
    },
    slots: filled,
  }
}

async function buildOutfitSlot(input: {
  partnerId: string
  siteSlug: string
  locale: WebLocale
  slot: OutfitSlotId
  excludeId: string
  anchor: PartnerSiteShopProduct
  anchorRole: OutfitSlotId
  anchorGender: OutfitGender
  categories: PartnerCategoryRow[]
  categoryById: Map<string, PartnerCategoryRow>
  limit: number
}): Promise<PartnerOutfitSlot> {
  const seen = new Set<string>([input.excludeId])
  const pool: Array<{ product: PartnerSiteShopProduct; gender: OutfitGender }> = []

  const cat1Rows = await fetchPartnerInventoryRowsByCategoryL1FromPg(
    input.partnerId,
    targetOutfitCat1Names(input.slot, input.anchorGender),
    60
  )
  for (const row of cat1Rows ?? []) {
    if (seen.has(row.id)) continue
    const product = inventoryRowToShopProduct(input.siteSlug, row)
    if (!product) continue
    if (
      !rowMatchesOutfitSlot(
        input.slot,
        product.categoryL1,
        product.categoryL2,
        product.categoryL3,
        product.name
      )
    ) {
      continue
    }
    seen.add(row.id)
    pool.push({
      product,
      gender: inferOutfitGender(product.categoryL1, product.categoryL2, product.name),
    })
  }

  for (const cat of input.categories) {
    const page = await fetchPartnerInventoryPageByCategoryFromPg(input.partnerId, {
      offset: 0,
      limit: Math.min(24, input.limit + 4),
      categoryId: cat.id,
      sort: 'newest',
    })
    const gender = inferOutfitGender(...categoryAncestorNames(cat, input.categoryById), cat.name)
    for (const row of page?.rows ?? []) {
      if (seen.has(row.id)) continue
      const product = inventoryRowToShopProduct(input.siteSlug, row)
      if (!product) continue
      const role = inferOutfitRole(cat.name, product.name)
      if (role && role !== input.slot) continue
      seen.add(row.id)
      pool.push({ product, gender })
    }
    if (pool.length >= input.limit * 2) break
  }

  if (pool.length < input.limit) {
    const extra = await fetchPartnerInventoryRowsByTokensIlikeAnyFromPg(
      input.partnerId,
      outfitSlotSearchTokens(input.slot),
      80
    )
    for (const row of extra ?? []) {
      if (seen.has(row.id)) continue
      const product = inventoryRowToShopProduct(input.siteSlug, row)
      if (!product) continue
      if (
        !rowMatchesOutfitSlot(input.slot, product.categoryL1, product.categoryL2, product.categoryL3, product.name)
      ) {
        if (!outfitSlotSearchTokens(input.slot).some((tok) => product.name.toLowerCase().includes(tok))) {
          continue
        }
      }
      seen.add(row.id)
      pool.push({ product, gender: inferOutfitGender(product.name) })
    }
  }

  const anchorPrice = effectivePrice(input.anchor)
  const scored = pool
    .map(({ product, gender }) => {
      const candPrice = effectivePrice(product)
      const score = scoreOutfitCandidate({
        anchorPrice,
        candidatePrice: candPrice,
        anchorGender: input.anchorGender,
        candidateGender: gender,
        nameOverlap: outfitNameOverlap(input.anchor.name, product.name),
      })
      return {
        product,
        matchScore: score,
        reasons: outfitMatchReasons({
          locale: input.locale,
          samePriceBand: samePriceBand(anchorPrice, candPrice),
          sameGender: gender === input.anchorGender && gender !== 'unisex',
          destSlot: input.slot,
          srcRole: input.anchorRole,
        }),
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
  const ranked = (scored.some((item) => item.matchScore > 0) ? scored.filter((item) => item.matchScore > 0) : scored).slice(
    0,
    input.limit
  )

  const listingCat = input.categories[0]
  return {
    id: input.slot,
    label: outfitSlotLabel(input.slot, input.locale),
    listingHref: listingCat?.path
      ? partnerSiteCategoryPath(input.siteSlug, listingCat.path)
      : partnerSiteProductsPath(input.siteSlug),
    items: ranked,
  }
}

export function parseOutfitSlotParam(value: string | null | undefined): OutfitSlotId | null {
  const slot = String(value || '').trim().toLowerCase()
  return isOutfitSlotId(slot) ? slot : null
}
