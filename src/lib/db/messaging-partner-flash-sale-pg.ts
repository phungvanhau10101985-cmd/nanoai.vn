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
  partnerFlashSaleAssignmentSeed,
  partnerFlashSaleIdentityKey,
  partnerFlashSalePercentForProduct,
  partnerFlashSaleProductId,
  pinPartnerFlashSaleProducts,
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
  eligibleIds: string[]
}

const assignmentCache = new Map<string, CachedAssignment>()
const assignmentInflight = new Map<string, Promise<BuiltAssignment>>()

type CandidateCacheEntry = { expiresAt: number; rows: FlashCandidate[] }
const candidateCache = new Map<string, CandidateCacheEntry>()
const candidateInflight = new Map<string, Promise<{ rows: FlashCandidate[]; failed: boolean }>>()

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

type BuiltAssignment = {
  assignment: PartnerFlashSaleAssignment
  eligibleIds: string[]
  /** Query failed — not the same as “fewer than 4 deals”. */
  failed: boolean
}

function candidateCacheKey(partnerId: string, shops: string[], l3s: string[]): string {
  const pairs = shops.map((shop, index) => `${shop}\t${l3s[index]}`).sort()
  return `${partnerId}|${pairs.join('|')}`
}

async function queryFlashSaleCandidatesOnce(input: {
  partnerId: string
  shops: string[]
  l3s: string[]
}): Promise<FlashCandidate[]> {
  const rows = await pgQuery<{ id: string; shop: string; l3: string }>(
    `with pairs(shop, l3) as (
       select * from unnest($2::text[], $3::text[]) as t(shop, l3)
     ),
     base as materialized (
       select mpi.id,
              ${SAME_SHOP_SQL_KEY} as shop,
              ${SAME_SHOP_SQL_L3} as l3_text,
              coalesce(mpi.purchases_count, 0) as purchases
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and coalesce(mpi.is_clearance, false) = false
         and ${SAME_SHOP_SQL_KEY} in (select distinct shop from pairs)
     )
     select b.id::text as id, p.shop, p.l3
     from base b
     join pairs p
       on p.shop = b.shop
      and (
        b.l3_text = p.l3
        or exists (
          select 1
          from public.messaging_partner_inventory_categories pic
          join public.messaging_partner_categories c on c.id = pic.category_id
          where pic.inventory_id = b.id
            and c.partner_id = $1::uuid
            and c.depth >= 3
            and lower(trim(c.name)) = p.l3
        )
      )
     order by b.purchases desc, b.id desc
     limit $4`,
    [input.partnerId, input.shops, input.l3s, FLASH_SALE_CANDIDATE_LIMIT]
  )
  return rows.map((row) => ({
    id: row.id,
    groupKey: shopL3PairKey(row.shop, row.l3) || `${row.shop}\t${row.l3}`,
  }))
}

/** One scan per shop+L3 set. Concurrent visitors share it; a DB error is not “no deals”. */
async function fetchFlashSaleCandidatesFromPg(input: {
  partnerId: string
  pairs: Array<{ shop: string; l3: string }>
  cacheUntilMs: number
}): Promise<{ rows: FlashCandidate[]; failed: boolean }> {
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
  if (!isPgConfigured() || !shops.length) return { rows: [], failed: false }
  const key = candidateCacheKey(input.partnerId, shops, l3s)
  const cached = candidateCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { rows: cached.rows, failed: false }
  const pending = candidateInflight.get(key)
  if (pending) return pending
  const job = (async () => {
    try {
      let rows: FlashCandidate[]
      try {
        rows = await queryFlashSaleCandidatesOnce({ partnerId: input.partnerId, shops, l3s })
      } catch (error) {
        console.warn('[fetchFlashSaleCandidatesFromPg] retry', error)
        rows = await queryFlashSaleCandidatesOnce({ partnerId: input.partnerId, shops, l3s })
      }
      const ttlMs = rows.length
        ? Math.max(5_000, input.cacheUntilMs - Date.now())
        : 15_000
      candidateCache.set(key, { expiresAt: Date.now() + ttlMs, rows })
      return { rows, failed: false }
    } catch (error) {
      console.warn('[fetchFlashSaleCandidatesFromPg]', error)
      return { rows: [], failed: true }
    }
  })().finally(() => {
    if (candidateInflight.get(key) === job) candidateInflight.delete(key)
  })
  candidateInflight.set(key, job)
  return job
}

async function buildAssignment(input: {
  partnerId: string
  accountKey: string
  slot: PartnerFlashSaleAssignment['slot']
  pinInventoryIds?: string[]
}): Promise<BuiltAssignment> {
  const empty = emptyPartnerFlashSaleAssignment(input.slot)
  const pinIds = asUuidList(input.pinInventoryIds ?? [])
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  // null = query error (pool/timeout). An empty row is { recently_viewed_ids: [] }.
  if (state == null) return { assignment: empty, eligibleIds: [], failed: true }
  const recentIds = asUuidList(state.recently_viewed_ids ?? []).slice(0, FLASH_SALE_RECENT_VIEWS)
  // Cart/checkout: if login merged views too late, still seed from SKUs in the basket.
  const viewedIds = recentIds.length ? recentIds : pinIds.slice(0, FLASH_SALE_RECENT_VIEWS)
  if (!viewedIds.length) return { assignment: empty, eligibleIds: [], failed: false }

  const signalIds = asUuidList([...viewedIds, ...pinIds])
  let signals: Awaited<ReturnType<typeof fetchInventorySameShopSignalsFromPg>>
  try {
    signals = await fetchInventorySameShopSignalsFromPg(input.partnerId, signalIds, { strict: true })
  } catch {
    return { assignment: empty, eligibleIds: [], failed: true }
  }
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
  if (!pairs.length) return { assignment: empty, eligibleIds: [], failed: false }

  const loaded = await fetchFlashSaleCandidatesFromPg({
    partnerId: input.partnerId,
    pairs,
    cacheUntilMs: input.slot.endAt.getTime(),
  })
  if (loaded.failed) return { assignment: empty, eligibleIds: [], failed: true }
  const candidates = loaded.rows
  const groupOrder = pairs.map((pair) => pair.key)
  const groupQueues: Record<string, FlashCandidate[]> = Object.fromEntries(
    groupOrder.map((key) => [key, [] as FlashCandidate[]])
  )
  const allowed = new Set(pairs.map((pair) => pair.key))
  for (const row of candidates) {
    if (!row.groupKey || !allowed.has(row.groupKey)) continue
    groupQueues[row.groupKey]?.push(row)
  }

  const seed = partnerFlashSaleAssignmentSeed(input.slot.key, viewedIds)
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
  const eligibleIds = new Set(candidates.map((row) => row.id.toLowerCase()))
  for (const id of pinIds) {
    const hit = signals.get(id.toLowerCase())
    const key = shopL3PairKey(hit?.sourceShopKey, hit?.l3Key)
    if (key && allowed.has(key)) eligibleIds.add(id.toLowerCase())
  }
  return {
    assignment: { productIds, percentById, slot: input.slot },
    eligibleIds: [...eligibleIds],
    failed: false,
  }
}

export async function getPartnerFlashSaleAssignmentFromPg(input: {
  partnerId: string
  accountKey?: string | null
  timezone?: string | null
  now?: Date
  enabled?: boolean
  pinInventoryIds?: string[] | null
}): Promise<PartnerFlashSaleAssignment> {
  const now = input.now ?? new Date()
  const timezone = input.timezone?.trim() || PARTNER_SALE_DEFAULT_TIMEZONE
  const slot = resolvePartnerFlashSaleSlot(now, timezone)
  const identity = partnerFlashSaleIdentityKey(input.accountKey)
  const pinIds = asUuidList(input.pinInventoryIds ?? [])
  const enabled =
    input.enabled ??
    (await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null))?.flashSaleEnabled !== false
  if (!enabled || !identity || !isPgConfigured()) {
    return emptyPartnerFlashSaleAssignment(slot)
  }

  const loaded = await loadFlashSaleAssignment({
    partnerId: input.partnerId,
    identity,
    slot,
    now,
    pinInventoryIds: pinIds,
  })
  if (!pinIds.length || loaded.failed) return loaded.assignment
  return pinPartnerFlashSaleProducts(loaded.assignment, pinIds, [
    ...loaded.eligibleIds,
    ...loaded.assignment.productIds,
  ])
}

async function loadFlashSaleAssignment(input: {
  partnerId: string
  identity: string
  slot: PartnerFlashSaleAssignment['slot']
  now: Date
  pinInventoryIds: string[]
}): Promise<BuiltAssignment> {
  const key = cacheKey(input.partnerId, input.identity, input.slot.key)
  const cached = assignmentCache.get(key)
  if (cached && cached.expiresAt > Date.now() && cached.productIds.length) {
    return {
      assignment: {
        productIds: cached.productIds,
        percentById: cached.percentById,
        slot: input.slot,
      },
      eligibleIds: cached.eligibleIds ?? [],
      failed: false,
    }
  }
  const pending = assignmentInflight.get(key)
  if (pending) return pending
  const job = (async (): Promise<BuiltAssignment> => {
    const built = await buildAssignment({
      partnerId: input.partnerId,
      accountKey: input.identity,
      slot: input.slot,
      pinInventoryIds: input.pinInventoryIds,
    })
    if (built.failed || !built.assignment.productIds.length) {
      assignmentCache.delete(key)
      return built
    }
    const ttlMs = Math.max(5_000, built.assignment.slot.endAt.getTime() - input.now.getTime())
    assignmentCache.set(key, {
      expiresAt: Date.now() + ttlMs,
      productIds: built.assignment.productIds,
      percentById: built.assignment.percentById,
      eligibleIds: built.eligibleIds,
    })
    return built
  })().finally(() => {
    if (assignmentInflight.get(key) === job) assignmentInflight.delete(key)
  })
  assignmentInflight.set(key, job)
  return job
}

export async function listPartnerFlashSaleBlockFromPg(input: {
  partnerId: string
  accountKey?: string | null
  timezone?: string | null
  now?: Date
}): Promise<{
  assignment: PartnerFlashSaleAssignment
  rows: NonNullable<Awaited<ReturnType<typeof fetchPartnerInventoryCardsByIdsInOrderFromPg>>>
  enabled: boolean
  /** Database error. Caller must not hide the block as if there were no deals. */
  unavailable: boolean
}> {
  const config = await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null)
  const enabled = config?.flashSaleEnabled !== false
  const now = input.now ?? new Date()
  const timezone = input.timezone?.trim() || config?.timezone || PARTNER_SALE_DEFAULT_TIMEZONE
  const slot = resolvePartnerFlashSaleSlot(now, timezone)
  const identity = partnerFlashSaleIdentityKey(input.accountKey)
  if (!enabled || !identity || !isPgConfigured()) {
    return {
      assignment: emptyPartnerFlashSaleAssignment(slot),
      rows: [],
      enabled,
      unavailable: false,
    }
  }
  const loaded = await loadFlashSaleAssignment({
    partnerId: input.partnerId,
    identity,
    slot,
    now,
    pinInventoryIds: [],
  })
  if (loaded.failed) {
    return { assignment: loaded.assignment, rows: [], enabled, unavailable: true }
  }
  const assignment = loaded.assignment
  if (assignment.productIds.length < FLASH_SALE_MIN_SHOW) {
    return { assignment, rows: [], enabled, unavailable: false }
  }
  const rows =
    (await fetchPartnerInventoryCardsByIdsInOrderFromPg(input.partnerId, assignment.productIds)) ?? []
  const sellable = rows.filter((row) => row && row.is_clearance !== true)
  if (sellable.length < FLASH_SALE_MIN_SHOW) {
    return { assignment, rows: [], enabled, unavailable: false }
  }
  return { assignment, rows: sellable, enabled, unavailable: false }
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
  const flashOn = config == null || config.flashSaleEnabled
  if (!flashOn) return input.products
  const pinInventoryIds =
    input.products.length === 1 ? [partnerFlashSaleProductId(input.products[0])] : []
  const assignment = await getPartnerFlashSaleAssignmentFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    timezone: input.timezone || config?.timezone,
    now: input.now,
    enabled: flashOn,
    pinInventoryIds,
  })
  if (!assignment.productIds.length) return input.products
  return input.products.map((product) => applyPartnerFlashSaleToProduct(product, assignment, input.now?.getTime()))
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
  now?: Date
}): number {
  if (input.isClearance) return input.currentEffective
  const nowMs = input.now?.getTime() ?? Date.now()
  if (input.assignment?.slot?.endAt && input.assignment.slot.endAt.getTime() <= nowMs) {
    return input.currentEffective
  }
  const percent = partnerFlashSalePercentForLine(input.assignment, input.inventoryId)
  if (!percent) return input.currentEffective
  const flash = applyPartnerFlashPercentToPrice(input.listUnitPrice, percent, input.assignment?.slot.endAt ?? null)
  // Parity 188: flash replaces calendar / inventory sale on that SKU. Google lock still wins later.
  return flash.displayPrice
}
