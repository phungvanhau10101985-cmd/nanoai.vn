import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { fetchPartnerInventoryCardsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchInventorySameShopSignalsFromPg } from '@/lib/db/messaging-partner-recommendation-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { fetchPartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import {
  applyPartnerFlashPercentToPrice,
  applyPartnerFlashSaleToProduct,
  emptyPartnerFlashSaleAssignment,
  FLASH_SALE_CANDIDATE_LIMIT,
  FLASH_SALE_MAX_COUNT,
  FLASH_SALE_MIN_SHOW,
  FLASH_SALE_RECENT_VIEWS,
  partnerFlashSaleIdentityKey,
  partnerFlashSalePercentForProduct,
  partnerFlashSaleProductId,
  partnerFlashSaleStableSeed,
  pickEvenShopProducts,
  resolvePartnerFlashSaleSlot,
  type PartnerFlashSaleAssignment,
} from '@/lib/partner-website/promotions/partner-flash-sale'
import { PARTNER_SALE_DEFAULT_TIMEZONE } from '@/lib/partner-website/promotions/partner-sale-calendar'
import { shopL3PairKey } from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SAME_SHOP_SQL_KEY = `lower(trim(coalesce(
  nullif(trim(coalesce(mpi.source_shop_name_chinese, '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'shop_name_chinese', '')), ''),
  nullif(trim(coalesce(mpi.source_shop_id, '')), ''),
  nullif(trim(coalesce(mpi.source_shop_name, '')), '')
)))`

const SAME_SHOP_SQL_L3 = `lower(trim(coalesce(
  nullif(trim(coalesce(mpi.category_l3, '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'sub_subcategory', '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'category_l3', '')), '')
)))`

type CachedAssignment = {
  expiresAt: number
  productIds: string[]
  percentById: Record<string, number>
}

const assignmentCache = new Map<string, CachedAssignment>()

function cacheKey(partnerId: string, identity: string, slotKey: string): string {
  return `flash-sale:${partnerId}:${identity}:${slotKey}`
}

function asUuidList(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = raw.trim()
    if (!UUID_RE.test(id)) continue
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

type FlashCandidate = { id: string; groupKey: string }

async function fetchFlashSaleCandidatesFromPg(input: {
  partnerId: string
  pairs: Array<{ shop: string; l3: string }>
}): Promise<FlashCandidate[]> {
  const shops: string[] = []
  const l3s: string[] = []
  const seen = new Set<string>()
  for (const pair of input.pairs) {
    const key = shopL3PairKey(pair.shop, pair.l3)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const [shop, l3] = key.split('\t')
    if (!shop || !l3) continue
    shops.push(shop)
    l3s.push(l3)
  }
  if (!isPgConfigured() || !shops.length) return []
  try {
    const rows = await pgQuery<{ id: string; shop: string; l3: string }>(
      `with pairs(shop, l3) as (
         select * from unnest($2::text[], $3::text[]) as t(shop, l3)
       )
       select mpi.id::text as id, p.shop, p.l3
       from public.messaging_partner_inventory mpi
       join pairs p
         on ${SAME_SHOP_SQL_KEY} = p.shop
        and (
          ${SAME_SHOP_SQL_L3} = p.l3
          or exists (
            select 1
            from public.messaging_partner_inventory_categories pic
            join public.messaging_partner_categories c on c.id = pic.category_id
            where pic.inventory_id = mpi.id
              and c.partner_id = $1::uuid
              and c.depth >= 3
              and lower(trim(c.name)) = p.l3
          )
        )
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and coalesce(mpi.is_clearance, false) = false
       order by coalesce(mpi.purchases_count, 0) desc, mpi.id desc
       limit $4`,
      [input.partnerId, shops, l3s, FLASH_SALE_CANDIDATE_LIMIT]
    )
    return rows.map((row) => ({
      id: row.id,
      groupKey: shopL3PairKey(row.shop, row.l3) || `${row.shop}\t${row.l3}`,
    }))
  } catch (error) {
    console.warn('[fetchFlashSaleCandidatesFromPg]', error)
    return []
  }
}

async function buildAssignment(input: {
  partnerId: string
  accountKey: string
  slot: PartnerFlashSaleAssignment['slot']
}): Promise<PartnerFlashSaleAssignment> {
  const empty = emptyPartnerFlashSaleAssignment(input.slot)
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const viewedIds = asUuidList(state?.recently_viewed_ids ?? []).slice(0, FLASH_SALE_RECENT_VIEWS)
  if (!viewedIds.length) return empty

  const signals = await fetchInventorySameShopSignalsFromPg(input.partnerId, viewedIds)
  const pairs: Array<{ shop: string; l3: string; key: string }> = []
  const seenPairs = new Set<string>()
  for (const id of viewedIds) {
    const hit = signals.get(id.toLowerCase())
    const key = shopL3PairKey(hit?.sourceShopKey, hit?.l3Key)
    if (!key || seenPairs.has(key)) continue
    seenPairs.add(key)
    const [shop, l3] = key.split('\t')
    if (!shop || !l3) continue
    pairs.push({ shop, l3, key })
  }
  if (!pairs.length) return empty

  const candidates = await fetchFlashSaleCandidatesFromPg({
    partnerId: input.partnerId,
    pairs,
  })
  const groupOrder = pairs.map((pair) => pair.key)
  const groupQueues: Record<string, FlashCandidate[]> = Object.fromEntries(
    groupOrder.map((key) => [key, [] as FlashCandidate[]])
  )
  const allowed = new Set(pairs.map((pair) => pair.key))
  for (const row of candidates) {
    if (!row.groupKey || !allowed.has(row.groupKey)) continue
    groupQueues[row.groupKey]?.push(row)
  }

  const seed = partnerFlashSaleStableSeed(input.accountKey, input.slot.key)
  const available = Object.values(groupQueues).reduce((sum, q) => sum + q.length, 0)
  const target = Math.min(FLASH_SALE_MAX_COUNT, available)
  const picked = pickEvenShopProducts(groupQueues, groupOrder, {
    target,
    seed,
    idOf: (row) => row.id,
  })
  const productIds = picked.map((row) => row.id).filter(Boolean)
  const percentById: Record<string, number> = {}
  for (const id of productIds) {
    percentById[id.toLowerCase()] = partnerFlashSalePercentForProduct(id, input.slot.key)
  }
  return { productIds, percentById, slot: input.slot }
}

export async function getPartnerFlashSaleAssignmentFromPg(input: {
  partnerId: string
  accountKey?: string | null
  timezone?: string | null
  now?: Date
  enabled?: boolean
}): Promise<PartnerFlashSaleAssignment> {
  const now = input.now ?? new Date()
  const timezone = input.timezone?.trim() || PARTNER_SALE_DEFAULT_TIMEZONE
  const slot = resolvePartnerFlashSaleSlot(now, timezone)
  const identity = partnerFlashSaleIdentityKey(input.accountKey)
  const enabled =
    input.enabled ??
    (await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null))?.flashSaleEnabled !== false
  if (!enabled || !identity || !isPgConfigured()) {
    return emptyPartnerFlashSaleAssignment(slot)
  }

  const key = cacheKey(input.partnerId, identity, slot.key)
  const cached = assignmentCache.get(key)
  if (cached && cached.expiresAt > Date.now() && cached.productIds.length) {
    return {
      productIds: cached.productIds,
      percentById: cached.percentById,
      slot,
    }
  }

  const built = await buildAssignment({
    partnerId: input.partnerId,
    accountKey: identity,
    slot,
  })
  if (!built.productIds.length) {
    assignmentCache.delete(key)
    return built
  }
  const ttlMs = Math.max(5_000, built.slot.endAt.getTime() - now.getTime())
  assignmentCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    productIds: built.productIds,
    percentById: built.percentById,
  })
  return built
}

export async function listPartnerFlashSaleBlockFromPg(input: {
  partnerId: string
  accountKey?: string | null
  timezone?: string | null
  now?: Date
}): Promise<{
  assignment: PartnerFlashSaleAssignment
  rows: Awaited<ReturnType<typeof fetchPartnerInventoryCardsByIdsInOrderFromPg>>
  enabled: boolean
}> {
  const config = await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null)
  const enabled = config?.flashSaleEnabled !== false
  const assignment = await getPartnerFlashSaleAssignmentFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    timezone: input.timezone || config?.timezone,
    now: input.now,
    enabled,
  })
  if (!enabled || assignment.productIds.length < FLASH_SALE_MIN_SHOW) {
    return { assignment, rows: [], enabled }
  }
  const rows =
    (await fetchPartnerInventoryCardsByIdsInOrderFromPg(input.partnerId, assignment.productIds)) ?? []
  const sellable = rows.filter((row) => row && row.is_clearance !== true)
  if (sellable.length < FLASH_SALE_MIN_SHOW) {
    return { assignment, rows: [], enabled }
  }
  return { assignment, rows: sellable, enabled }
}

export async function overlayPartnerFlashSaleOnProducts<
  T extends Parameters<typeof applyPartnerFlashSaleToProduct>[0],
>(input: {
  partnerId: string
  accountKey?: string | null
  timezone?: string | null
  products: T[]
  now?: Date
}): Promise<T[]> {
  if (!input.products.length) return input.products
  const config = await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null)
  if (config?.flashSaleEnabled === false) return input.products
  const assignment = await getPartnerFlashSaleAssignmentFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    timezone: input.timezone || config?.timezone,
    now: input.now,
    enabled: config?.flashSaleEnabled !== false,
  })
  if (!assignment.productIds.length) return input.products
  return input.products.map((product) => applyPartnerFlashSaleToProduct(product, assignment))
}

export function partnerFlashSalePercentForLine(
  assignment: PartnerFlashSaleAssignment | null | undefined,
  inventoryId: string | null | undefined
): number | null {
  if (!assignment || !inventoryId) return null
  const id = partnerFlashSaleProductId({ id: inventoryId })
  const percent = assignment.percentById[id]
  return percent ? percent : null
}

export function applyPartnerFlashSaleUnitPrice(input: {
  listUnitPrice: number
  currentEffective: number
  isClearance?: boolean
  inventoryId?: string | null
  assignment: PartnerFlashSaleAssignment | null | undefined
}): number {
  if (input.isClearance) return input.currentEffective
  const percent = partnerFlashSalePercentForLine(input.assignment, input.inventoryId)
  if (!percent) return input.currentEffective
  const flash = applyPartnerFlashPercentToPrice(input.listUnitPrice, percent, input.assignment?.slot.endAt ?? null)
  // Parity 188: flash replaces calendar / inventory sale on that SKU. Google lock still wins later.
  return flash.displayPrice
}
