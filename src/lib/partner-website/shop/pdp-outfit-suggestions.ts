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
  listPublishedOutfitPickBackfillFromPg,
  loadPartnerOutfitPicksFromPg,
  savePartnerOutfitPicksFromPg,
  storedOutfitPayloadIsServable,
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
  isOutfitSlotId,
  outfitSectionTitle,
  outfitSlotLabel,
  outfitSlotSearchPatterns,
  pickOutfitListingCategory,
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
  /** Query failed. Do not persist. Caller should retry. */
  unavailable?: boolean
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

type OutfitComputeResult = { ok: boolean; payload: PartnerOutfitPickPayload }

const outfitEnsureInflight = new Map<string, Promise<{ unavailable: boolean; payload: PartnerOutfitPickPayload | null }>>()

function markComputeOk(payload: PartnerOutfitPickPayload): PartnerOutfitPickPayload {
  return { ...payload, computeOk: true }
}

/**
 * One compute per product at a time. A failed query is not written, so the next
 * open retries instead of serving a stuck empty row for 7 days.
 */
function ensurePartnerOutfitPicks(partnerId: string, inventoryId: string) {
  const key = `${partnerId}:${inventoryId}`
  const pending = outfitEnsureInflight.get(key)
  if (pending) return pending
  const job = (async () => {
    const stored = await loadPartnerOutfitPicksFromPg(partnerId, inventoryId)
    if (stored && storedOutfitPayloadIsServable(stored)) {
      return { unavailable: false, payload: stored }
    }
    const computed = await computeOutfitSlotPicks({ partnerId, inventoryId })
    if (!computed.ok) {
      console.warn('[outfit-picks] compute failed', partnerId, inventoryId)
      return { unavailable: true, payload: null }
    }
    await savePartnerOutfitPicksFromPg(partnerId, inventoryId, computed.payload)
    return { unavailable: false, payload: computed.payload }
  })().finally(() => {
    outfitEnsureInflight.delete(key)
  })
  outfitEnsureInflight.set(key, job)
  return job
}

/** Saved row only. PDP HTML uses this so the first paint does not recompute. */
export async function readSavedPartnerOutfitSuggestions(input: {
  partnerId: string
  siteSlug: string
  inventoryId: string
  locale: WebLocale
}): Promise<PartnerOutfitSuggestions | null> {
  const inventoryId = String(input.inventoryId || '').trim()
  if (!inventoryId) return null
  const stored = await loadPartnerOutfitPicksFromPg(input.partnerId, inventoryId)
  if (!stored || !storedOutfitPayloadIsServable(stored) || !stored.applicable) return null
  const trimmed = filterStoredOutfitPayload(stored, { limit: OUTFIT_FETCH_LIMIT })
  const view = await assembleOutfitSuggestions(trimmed, input)
  return view.applicable ? view : null
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
  const ensured = await ensurePartnerOutfitPicks(input.partnerId, inventoryId)
  if (ensured.unavailable || !ensured.payload) {
    return { ...emptySuggestions(), unavailable: true }
  }
  const trimmed = filterStoredOutfitPayload(ensured.payload, { onlySlot: input.slot ?? null, limit })
  return assembleOutfitSuggestions(trimmed, {
    partnerId: input.partnerId,
    siteSlug: input.siteSlug,
    locale: input.locale,
  })
}

/** Fill saved outfits for published shops before a customer opens the PDP. */
export async function warmPublishedShopOutfitPicks(limit = 6): Promise<{
  scanned: number
  saved: number
  failed: number
  skipped: number
}> {
  const targets = await listPublishedOutfitPickBackfillFromPg(limit)
  let saved = 0
  let failed = 0
  let skipped = 0
  for (const target of targets) {
    const ensured = await ensurePartnerOutfitPicks(target.partnerId, target.inventoryId)
    if (ensured.unavailable) {
      failed += 1
      continue
    }
    if (ensured.payload?.computeOk === true) saved += 1
    else skipped += 1
  }
  if (targets.length) {
    console.info('[outfit-picks] warm', { scanned: targets.length, saved, failed, skipped })
  }
  return { scanned: targets.length, saved, failed, skipped }
}

async function computeOutfitSlotPicks(input: {
  partnerId: string
  inventoryId: string
}): Promise<OutfitComputeResult> {
  const empty: PartnerOutfitPickPayload = { applicable: false, reason: 'no_slots', anchor: null, slots: [] }
  try {
    return await computeOutfitSlotPicksInner(input, empty)
  } catch (e) {
    console.warn('[outfit-picks] compute threw', input.partnerId, input.inventoryId, e)
    return { ok: false, payload: empty }
  }
}

async function computeOutfitSlotPicksInner(
  input: { partnerId: string; inventoryId: string },
  empty: PartnerOutfitPickPayload
): Promise<OutfitComputeResult> {
  const [matchRows, cats] = await Promise.all([
    fetchPartnerInventoryOutfitMatchByIdsFromPg(input.partnerId, [input.inventoryId]),
    fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: true }),
  ])
  if (matchRows == null) return { ok: false, payload: empty }
  const row = matchRows.find((item) => item.id === input.inventoryId)
  if (!row) return { ok: true, payload: markComputeOk(empty) }
  const classified = classifyOutfitAnchor([row.category_l1, row.category_l2, row.category_l3, row.name])
  if (!classified.role) {
    return {
      ok: true,
      payload: markComputeOk({
        applicable: false,
        reason: 'no_slots',
        anchor: { id: row.id, role: null, gender: classified.gender },
        slots: [],
      }),
    }
  }
  const slotIds = slotsForOutfitAnchor(classified.role, classified.gender)
  if (!slotIds.length) {
    return {
      ok: true,
      payload: markComputeOk({
        applicable: false,
        reason: 'no_slots',
        anchor: { id: row.id, role: classified.role, gender: classified.gender },
        slots: [],
      }),
    }
  }

  const anchorSubject = matchRowToSubject(row)
  const slots: PartnerOutfitPickSlot[] = []
  for (const slot of slotIds) {
    const picked = await computeOutfitSlotPicksForRole({
      partnerId: input.partnerId,
      slot,
      excludeId: row.id,
      anchor: anchorSubject,
      anchorGender: classified.gender,
      listingCat: pickOutfitListingCategory(cats ?? [], slot, classified.gender),
    })
    if (picked === 'error') return { ok: false, payload: empty }
    if (picked && picked.items.length) slots.push(picked)
  }
  if (!slots.length) {
    return {
      ok: true,
      payload: markComputeOk({
        applicable: false,
        reason: 'no_slots',
        anchor: { id: row.id, role: classified.role, gender: classified.gender },
        slots: [],
      }),
    }
  }
  return {
    ok: true,
    payload: markComputeOk({
      applicable: true,
      reason: null,
      anchor: { id: row.id, role: classified.role, gender: classified.gender },
      slots,
    }),
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
}): Promise<PartnerOutfitPickSlot | null | 'error'> {
  const l1Names = targetOutfitCat1Names(input.slot, input.anchorGender)
  const patterns = outfitSlotQueryPatterns(input.anchor, input.slot)
  const rows = await fetchPartnerInventoryCardsForOutfitSlotFromPg(input.partnerId, {
    categoryL1Names: l1Names,
    namePatterns: patterns,
    excludeId: input.excludeId,
    limit: SLOT_POOL,
  })
  if (rows == null) return 'error'
  const collected = rows.filter((row) => candidatePassesSlot(input.slot, row, input.anchor))
  if (collected.length < 8) {
    const extra = await fetchPartnerInventoryCardsForOutfitSlotFromPg(input.partnerId, {
      categoryL1Names: l1Names,
      namePatterns: input.slot === 'dress' ? ['%váy%', '%đầm%', '%vay%'] : [],
      excludeId: input.excludeId,
      limit: SLOT_POOL,
    })
    if (extra == null) {
      if (!collected.length) return 'error'
    } else {
      const seen = new Set(collected.map((row) => row.id))
      for (const row of extra) {
        if (seen.has(row.id) || !candidatePassesSlot(input.slot, row, input.anchor)) continue
        seen.add(row.id)
        collected.push(row)
      }
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
  const [cardRows, cats] = await Promise.all([
    ids.length ? fetchPartnerInventoryCardsByIdsInOrderFromPg(input.partnerId, ids) : Promise.resolve([]),
    fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: true }),
  ])
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
    const gender = payload.anchor?.gender ?? 'unisex'
    const listingCat = cats ? pickOutfitListingCategory(cats, slot.id, gender) : null
    slots.push({
      id: slot.id,
      label: outfitSlotLabel(slot.id, input.locale),
      listingHref: listingHrefForSlot(input.siteSlug, listingCat, cats ? null : slot.listingPath),
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
