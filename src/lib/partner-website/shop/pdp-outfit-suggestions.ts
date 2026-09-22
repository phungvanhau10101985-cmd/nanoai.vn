import {
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerInventoryCardsByIdsInOrderFromPg,
  fetchPartnerInventoryCardsForOutfitSlotFromPg,
  fetchPartnerInventoryOutfitMatchByIdsFromPg,
  type PartnerOutfitMatchRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  filterStoredOutfitPayload,
  loadPartnerOutfitPicksFromPg,
  savePartnerOutfitPicksFromPg,
  OUTFIT_STORED_LIMIT,
  type PartnerOutfitPickPayload,
  type PartnerOutfitPickSlot,
} from '@/lib/db/messaging-partner-outfit-picks-pg'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import type { WebLocale } from '@/lib/i18n/config'
import {
  inventoryCardRowToShopProduct,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  inferOutfitPairFamilyFromSubject,
  localizeOutfitReasons,
  scoreOutfitCandidate188,
  type OutfitScoreSubject,
} from '@/lib/partner-website/shop/pdp-outfit-score'
import {
  listingQueriesForOutfitFamily,
  outfitPairFamilyCompatible,
} from '@/lib/partner-website/shop/pdp-outfit-pair-families'
import {
  classifyOutfitAnchor,
  inferOutfitRole,
  isOutfitSlotId,
  outfitSectionTitle,
  outfitSlotLabel,
  outfitSlotSearchPatterns,
  rowMatchesOutfitSlot,
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

/** 188 FETCH_LIMIT — first paint slices locally (2 mobile / 5 desktop). */
export const OUTFIT_FETCH_LIMIT = 12
const SLOT_POOL = 40

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

function matchRowToSubject(row: PartnerOutfitMatchRow): OutfitScoreSubject {
  return {
    name: row.name,
    categoryL1: row.category_l1,
    categoryL2: row.category_l2,
    categoryL3: row.category_l3,
    style: row.style,
    occasion: row.occasion,
    colorSummary: row.color_summary,
    material: row.material_note,
    priceAmount: row.price_amount,
    salePriceAmount: row.sale_price_amount,
    purchasesCount: row.purchases_count,
  }
}

function listingHrefForSlot(
  siteSlug: string,
  listingCat: PartnerCategoryRow | null,
  listingPath: string | null
): string {
  if (listingPath) return partnerSiteCategoryPath(siteSlug, listingPath)
  if (listingCat?.path) return partnerSiteCategoryPath(siteSlug, listingCat.path)
  return partnerSiteProductsPath(siteSlug)
}

function emptySuggestions(): PartnerOutfitSuggestions {
  return { applicable: false, reason: 'no_slots', anchor: null, slots: [] }
}

export async function fetchPartnerOutfitSuggestions(input: {
  partnerId: string
  siteSlug: string
  inventoryId: string
  locale: WebLocale
  limit?: number
  slot?: OutfitSlotId | null
}): Promise<PartnerOutfitSuggestions> {
  const inventoryId = String(input.inventoryId || '').trim()
  if (!inventoryId) return emptySuggestions()
  const limit = Math.min(OUTFIT_FETCH_LIMIT, Math.max(1, Math.floor(input.limit || OUTFIT_FETCH_LIMIT)))
  let stored = await loadPartnerOutfitPicksFromPg(input.partnerId, inventoryId)
  if (!stored) {
    stored = await computeOutfitSlotPicks({
      partnerId: input.partnerId,
      inventoryId,
    })
    await savePartnerOutfitPicksFromPg(input.partnerId, inventoryId, stored)
  }
  const trimmed = filterStoredOutfitPayload(stored, { onlySlot: input.slot ?? null, limit })
  return assembleOutfitSuggestions(trimmed, {
    partnerId: input.partnerId,
    siteSlug: input.siteSlug,
    locale: input.locale,
  })
}

async function computeOutfitSlotPicks(input: {
  partnerId: string
  inventoryId: string
}): Promise<PartnerOutfitPickPayload> {
  const empty: PartnerOutfitPickPayload = { applicable: false, reason: 'no_slots', anchor: null, slots: [] }
  const [matchRows, cats] = await Promise.all([
    fetchPartnerInventoryOutfitMatchByIdsFromPg(input.partnerId, [input.inventoryId]),
    fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: true }),
  ])
  const row = (matchRows ?? []).find((item) => item.id === input.inventoryId)
  if (!row) return empty
  const classified = classifyOutfitAnchor([row.category_l1, row.category_l2, row.category_l3, row.name])
  if (!classified.role) {
    return {
      applicable: false,
      reason: 'no_slots',
      anchor: { id: row.id, role: null, gender: classified.gender },
      slots: [],
    }
  }
  const slotIds = slotsForOutfitAnchor(classified.role, classified.gender)
  if (!slotIds.length) {
    return {
      applicable: false,
      reason: 'no_slots',
      anchor: { id: row.id, role: classified.role, gender: classified.gender },
      slots: [],
    }
  }

  const byId = new Map((cats ?? []).map((c) => [c.id, c]))
  const listingCatBySlot = new Map<OutfitSlotId, PartnerCategoryRow>()
  for (const cat of cats ?? []) {
    const names = categoryAncestorNames(cat, byId)
    const role = inferOutfitRole(...names)
    if (!role || !slotIds.includes(role) || listingCatBySlot.has(role)) continue
    listingCatBySlot.set(role, cat)
  }

  const anchorSubject = matchRowToSubject(row)
  const slots = await Promise.all(
    slotIds.map((slot) =>
      computeOutfitSlotPicksForRole({
        partnerId: input.partnerId,
        slot,
        excludeId: row.id,
        anchor: anchorSubject,
        anchorGender: classified.gender,
        listingCat: listingCatBySlot.get(slot) ?? null,
      })
    )
  )
  const filled = slots.filter((s): s is PartnerOutfitPickSlot => Boolean(s && s.items.length))
  if (!filled.length) {
    return {
      applicable: false,
      reason: 'no_slots',
      anchor: { id: row.id, role: classified.role, gender: classified.gender },
      slots: [],
    }
  }
  return {
    applicable: true,
    reason: null,
    anchor: { id: row.id, role: classified.role, gender: classified.gender },
    slots: filled,
  }
}

function outfitSlotQueryPatterns(anchor: OutfitScoreSubject, slot: OutfitSlotId): string[] {
  const family = inferOutfitPairFamilyFromSubject(anchor)
  const queries = listingQueriesForOutfitFamily(family, slot)
  const extras = slot === 'dress' ? ['đầm', 'váy liền', 'chân váy'] : []
  const tokens = queries.length ? [...queries, ...extras] : outfitSlotSearchPatterns(slot).map((p) => p.replace(/%/g, ''))
  return [...new Set(tokens.map((token) => token.trim().toLowerCase()).filter((token) => token.length >= 2))].map(
    (token) => `%${token.replace(/[%_]/g, '')}%`
  )
}

function candidatePassesSlot(slot: OutfitSlotId, row: PartnerOutfitMatchRow, anchor: OutfitScoreSubject): boolean {
  if (!rowMatchesOutfitSlot(slot, row.category_l1, row.category_l2, row.category_l3, row.name)) return false
  return outfitPairFamilyCompatible(
    inferOutfitPairFamilyFromSubject(anchor),
    inferOutfitPairFamilyFromSubject(matchRowToSubject(row)),
    slot
  )
}

async function computeOutfitSlotPicksForRole(input: {
  partnerId: string
  slot: OutfitSlotId
  excludeId: string
  anchor: OutfitScoreSubject
  anchorGender: OutfitGender
  listingCat: PartnerCategoryRow | null
}): Promise<PartnerOutfitPickSlot | null> {
  const l1Names = targetOutfitCat1Names(input.slot, input.anchorGender)
  const patterns = outfitSlotQueryPatterns(input.anchor, input.slot)
  let rows =
    (await fetchPartnerInventoryCardsForOutfitSlotFromPg(input.partnerId, {
      categoryL1Names: l1Names,
      namePatterns: patterns,
      excludeId: input.excludeId,
      limit: SLOT_POOL,
    })) ?? []
  let collected = rows.filter((row) => candidatePassesSlot(input.slot, row, input.anchor))
  if (collected.length < 8) {
    const extra =
      (await fetchPartnerInventoryCardsForOutfitSlotFromPg(input.partnerId, {
        categoryL1Names: l1Names,
        namePatterns: input.slot === 'dress' ? ['%váy%', '%đầm%', '%vay%'] : [],
        excludeId: input.excludeId,
        limit: SLOT_POOL,
      })) ?? []
    const seen = new Set(collected.map((row) => row.id))
    for (const row of extra) {
      if (seen.has(row.id) || !candidatePassesSlot(input.slot, row, input.anchor)) continue
      seen.add(row.id)
      collected.push(row)
    }
  }

  const ranked = collected
    .map((row) => {
      const scored = scoreOutfitCandidate188(input.anchor, matchRowToSubject(row), input.slot)
      return { row, ...scored }
    })
    .sort((a, b) => b.score - a.score || b.purchases - a.purchases)
  const scored = ranked.filter((item) => item.score > 0)
  const pool = scored.length >= Math.min(3, OUTFIT_STORED_LIMIT) ? scored : ranked
  const items = pool.slice(0, OUTFIT_STORED_LIMIT).map((item) => ({
    id: item.row.id,
    matchScore: item.score,
    reasons: item.reasons,
  }))
  if (!items.length) return null
  return {
    id: input.slot,
    listingPath: input.listingCat?.path || null,
    items,
  }
}

async function assembleOutfitSuggestions(
  payload: PartnerOutfitPickPayload,
  input: { partnerId: string; siteSlug: string; locale: WebLocale }
): Promise<PartnerOutfitSuggestions> {
  if (!payload.applicable) {
    const role = payload.anchor?.role ?? null
    return {
      applicable: false,
      reason: (payload.reason as OutfitNotApplicableReason) || 'no_slots',
      anchor: payload.anchor
        ? {
            id: payload.anchor.id,
            role,
            roleLabel: role ? outfitSlotLabel(role, input.locale) : '',
            gender: payload.anchor.gender,
            title: outfitSectionTitle(role, input.locale),
          }
        : null,
      slots: [],
    }
  }
  const ids: string[] = []
  for (const slot of payload.slots) {
    for (const item of slot.items) {
      if (item.id) ids.push(item.id)
    }
  }
  const cardRows = ids.length ? await fetchPartnerInventoryCardsByIdsInOrderFromPg(input.partnerId, ids) : []
  const byId = new Map((cardRows ?? []).map((row) => [row.id, row]))
  const slots: PartnerOutfitSlot[] = []
  for (const slot of payload.slots) {
    if (!isOutfitSlotId(slot.id)) continue
    const items: PartnerOutfitItem[] = []
    for (const item of slot.items) {
      const row = byId.get(item.id)
      if (!row) continue
      const product = inventoryCardRowToShopProduct(input.siteSlug, row)
      if (!product) continue
      items.push({
        product,
        matchScore: item.matchScore || 0,
        reasons: localizeOutfitReasons(item.reasons || [], input.locale),
      })
    }
    if (!items.length) continue
    slots.push({
      id: slot.id,
      label: outfitSlotLabel(slot.id, input.locale),
      listingHref: listingHrefForSlot(input.siteSlug, null, slot.listingPath),
      items,
    })
  }
  const role = payload.anchor?.role ?? null
  if (!slots.length) return emptySuggestions()
  return {
    applicable: true,
    reason: null,
    anchor: payload.anchor
      ? {
          id: payload.anchor.id,
          role,
          roleLabel: role ? outfitSlotLabel(role, input.locale) : '',
          gender: payload.anchor.gender,
          title: outfitSectionTitle(role, input.locale),
        }
      : null,
    slots,
  }
}

export function parseOutfitSlotParam(value: string | null | undefined): OutfitSlotId | null {
  const slot = String(value || '').trim().toLowerCase()
  return isOutfitSlotId(slot) ? slot : null
}
