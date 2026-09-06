import { fetchPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import {
  fetchActiveInventoryByShopL3PairsFromPg,
  fetchCohortViewedInventoryIdsFromPg,
  fetchInventoryCategorySignalsFromPg,
  fetchInventorySameShopSignalsFromPg,
  fetchPopularInventoryIdsFromPg,
  fetchVisitorProfileHintFromPg,
  upsertVisitorProfileHintFromPg,
  type InventorySameShopSignal,
} from '@/lib/db/messaging-partner-recommendation-pg'
import { fetchPartnerInventoryCardsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import {
  HOME_RECOMMENDATION_COHORT_LIMIT,
  HOME_RECOMMENDATION_SHOP_LIMIT,
  SAME_CATEGORY_HISTORY_WINDOW,
  SAME_CATEGORY_MAX_PER_PAGE,
  SAME_CATEGORY_RECENT_WINDOW,
  SAME_SHOP_MAX_POOL,
  allowedShopL3PairsFromRecent,
  buildWeightedCategoryCycle,
  inferApparelGenderFromName,
  mixShopAndCohortProducts,
  pickRoundRobinFromQueues,
  seededShuffle,
  shopL3PairKey,
  type SameAgeGenderCohortMode,
} from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'
import type { PartnerInventoryShopCardRow } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { normalizeShopImageUrl } from '@/lib/partner-website/shop/inventory-shop-detail'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'
import { applyPartnerSiteSaleToShopProduct } from '@/lib/partner-website/promotions/partner-site-sale-display'
import { loadPartnerSiteSaleOverlay } from '@/lib/partner-website/promotions/partner-site-sale-attach'

const HTTP_RE = /^https?:\/\//i

function numberOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const text = String(value).trim()
  return text || null
}

function mapInventoryRowToPersonalizationProduct(
  siteSlug: string,
  row: PartnerInventoryShopCardRow
): PartnerSitePersonalizationProduct | null {
  const imageUrl = normalizeShopImageUrl(row.image_url)
  if (!imageUrl) return null
  const detailPath = partnerSiteProductPath(siteSlug, row.id, { name: (row.name ?? '').trim() || 'Product' })
  const rawProductUrl = (row.product_url ?? '').trim()
  return {
    inventory_id: row.id,
    name: (row.name ?? '').trim() || 'Product',
    price_hint: (row.price_hint ?? '').trim(),
    image_url: imageUrl,
    product_url: HTTP_RE.test(rawProductUrl) ? rawProductUrl : `https://shop.local${detailPath}`,
    detail_path: detailPath,
    sku: (row.sku ?? '').trim() || null,
    priceAmount: numberOrNull(row.price_amount),
    salePriceAmount: numberOrNull(row.sale_price_amount),
    saleStartsAt: isoOrNull(row.sale_starts_at),
    saleEndsAt: isoOrNull(row.sale_ends_at),
    isClearance: row.is_clearance === true,
    likesCount: Math.max(0, Math.round(Number(row.likes_count ?? 0)) || 0),
    purchasesCount: Math.max(0, Math.round(Number(row.purchases_count ?? 0)) || 0),
    ratingScore: Number(row.rating_score ?? 0) || 0,
  }
}

export type PartnerSiteHomeRecommendationBlock = {
  products: PartnerSitePersonalizationProduct[]
  personalized: boolean
  cohort_mode: SameAgeGenderCohortMode
  cohort_badge_product_ids: string[]
  same_shop_seed: number | null
  same_shop_used: number
  has_more: boolean
}

function birthYearFromIso(iso: string | null | undefined): number | null {
  const y = Number.parseInt(String(iso || '').slice(0, 4), 10)
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null
}

async function resolveVisitorDemographics(input: {
  partnerId: string
  accountKey: string
  linkedUserId?: string | null
  loggedIn?: boolean
  email?: string | null
}): Promise<{ gender: 'male' | 'female' | null; birthYear: number | null; loggedIn: boolean }> {
  const loggedIn = input.loggedIn ?? Boolean(input.linkedUserId)
  const hint = await fetchVisitorProfileHintFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  let gender = hint?.gender ?? null
  let birthYear = hint?.birthYear ?? null
  const email = (input.email ?? '').trim().toLowerCase()
  if (email) {
    const customer = await fetchPartnerCustomerProfileByEmailFromPg({
      partnerId: input.partnerId,
      emailNormalized: email,
    })
    gender = customer?.gender ?? gender
    birthYear = birthYearFromIso(customer?.date_of_birth) ?? birthYear
  }
  if (input.linkedUserId) {
    const profile = await fetchNanoaiChatProfileFromPg(input.linkedUserId)
    const fromProfile = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null
    gender = fromProfile ?? gender
    birthYear = birthYearFromIso(profile?.birthDate) ?? birthYear
    if (gender) {
      await upsertVisitorProfileHintFromPg({
        partnerId: input.partnerId,
        accountKey: input.accountKey,
        gender,
        birthYear,
      })
    }
  }
  return { gender, birthYear, loggedIn }
}

function signalOf<T>(map: Map<string, T>, inventoryId: string): T | null {
  return map.get(inventoryId.toLowerCase()) ?? null
}

/** 188: cùng shop Trung Quốc VÀ cùng L3 của 8 SP vừa xem — không lấy cùng shop khác cấp 3. */
async function sameShopAndL3Products(input: {
  partnerId: string
  siteSlug: string
  viewedIds: string[]
  limit: number
  seed: number
  offset?: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const historyIds = input.viewedIds.slice(0, SAME_CATEGORY_HISTORY_WINDOW)
  if (!historyIds.length) return []
  const signals = await fetchInventorySameShopSignalsFromPg(input.partnerId, historyIds)
  const recentIds = historyIds.slice(0, SAME_CATEGORY_RECENT_WINDOW)
  const allowedPairs = allowedShopL3PairsFromRecent(
    recentIds.map((id) => {
      const sig = signalOf(signals, id)
      return { shop: sig?.sourceShopKey, l3: sig?.l3Key }
    })
  )
  const shopsLower = new Set(
    [...allowedPairs].map((pair) => pair.split('\t')[0] || '').filter(Boolean)
  )
  if (!allowedPairs.size || !shopsLower.size) return []

  const historyShopKeys = historyIds.map((id) => signalOf(signals, id)?.sourceShopKey || '')
  const recentShopKeys = recentIds.map((id) => signalOf(signals, id)?.sourceShopKey || '')
  const { cycle, maxPerOverrides } = buildWeightedCategoryCycle(
    historyShopKeys,
    recentShopKeys,
    shopsLower
  )
  if (!cycle.length) return []

  const candidates = await fetchActiveInventoryByShopL3PairsFromPg({
    partnerId: input.partnerId,
    pairs: [...allowedPairs].map((pair) => {
      const [shop, l3] = pair.split('\t')
      return { shop: shop || '', l3: l3 || '' }
    }),
    limit: SAME_SHOP_MAX_POOL,
  })
  const candidateSignals = await fetchInventorySameShopSignalsFromPg(
    input.partnerId,
    candidates.map((row) => row.id)
  )
  const queues = new Map<string, PartnerSitePersonalizationProduct[]>()
  for (const shop of shopsLower) {
    const same: PartnerSitePersonalizationProduct[] = []
    for (const row of candidates) {
      const sig = signalOf<InventorySameShopSignal>(candidateSignals, row.id)
      const pair = shopL3PairKey(sig?.sourceShopKey, sig?.l3Key)
      if (!sig || sig.sourceShopKey !== shop || !pair || !allowedPairs.has(pair)) continue
      const mapped = mapInventoryRowToPersonalizationProduct(input.siteSlug, row)
      if (mapped) same.push(mapped)
    }
    if (same.length) queues.set(shop, seededShuffle(same, input.seed + shop.length))
  }
  return pickRoundRobinFromQueues({
    queues,
    cycle,
    pageSize: input.limit,
    maxPer: SAME_CATEGORY_MAX_PER_PAGE,
    maxPerOverrides,
    offset: input.offset,
  })
}

async function cohortProducts(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  gender: 'male' | 'female'
  birthYear: number | null
  excludeIds: Set<string>
  limit: number
  seed: number
}): Promise<{ products: PartnerSitePersonalizationProduct[]; mode: SameAgeGenderCohortMode }> {
  const exact =
    input.birthYear != null
      ? await fetchCohortViewedInventoryIdsFromPg({
          partnerId: input.partnerId,
          excludeAccountKey: input.accountKey,
          gender: input.gender,
          birthYear: input.birthYear,
          limit: HOME_RECOMMENDATION_COHORT_LIMIT,
        })
      : { inventoryIds: [], matchedVisitors: 0 }
  let ids = exact.inventoryIds
  let mode: SameAgeGenderCohortMode = exact.matchedVisitors > 0 ? 'exact_cohort' : 'gender_peers'
  if (!ids.length) {
    const peers = await fetchCohortViewedInventoryIdsFromPg({
      partnerId: input.partnerId,
      excludeAccountKey: input.accountKey,
      gender: input.gender,
      birthYear: null,
      limit: HOME_RECOMMENDATION_COHORT_LIMIT,
    })
    ids = peers.inventoryIds
    mode = peers.matchedVisitors > 0 ? 'gender_peers' : 'popular_fallback'
  }
  const filtered = ids.filter((id) => !input.excludeIds.has(id.toLowerCase()))
  if (!filtered.length) return { products: [], mode }
  const rows =
    (await fetchPartnerInventoryCardsByIdsInOrderFromPg(
      input.partnerId,
      seededShuffle(filtered, input.seed).slice(0, input.limit)
    )) ?? []
  const products: PartnerSitePersonalizationProduct[] = []
  for (const row of rows) {
    if (!row.is_active) continue
    const mapped = mapInventoryRowToPersonalizationProduct(input.siteSlug, row)
    if (mapped) products.push(mapped)
    if (products.length >= input.limit) break
  }
  return { products, mode }
}

async function popularFallbackProducts(input: {
  partnerId: string
  siteSlug: string
  excludeIds: string[]
  limit: number
  balanceGender: boolean
}): Promise<PartnerSitePersonalizationProduct[]> {
  const ids = await fetchPopularInventoryIdsFromPg({
    partnerId: input.partnerId,
    excludeIds: input.excludeIds,
    limit: input.limit * 3,
  })
  const rows = (await fetchPartnerInventoryCardsByIdsInOrderFromPg(input.partnerId, ids)) ?? []
  const signals = await fetchInventoryCategorySignalsFromPg(
    input.partnerId,
    rows.map((row) => row.id)
  )
  const mapped = rows
    .map((row) => {
      const product = mapInventoryRowToPersonalizationProduct(input.siteSlug, row)
      if (!product) return null
      const gender =
        signalOf(signals, row.id)?.gender || inferApparelGenderFromName(row.name)
      return { product, gender }
    })
    .filter((x): x is { product: PartnerSitePersonalizationProduct; gender: 'male' | 'female' | null } => Boolean(x))

  if (!input.balanceGender) {
    return mapped.map((x) => x.product).slice(0, input.limit)
  }
  const male = mapped.filter((x) => x.gender === 'male').map((x) => x.product)
  const female = mapped.filter((x) => x.gender === 'female').map((x) => x.product)
  const other = mapped.filter((x) => !x.gender).map((x) => x.product)
  const out: PartnerSitePersonalizationProduct[] = []
  let i = 0
  while (out.length < input.limit && (male.length || female.length || other.length)) {
    const take = i % 2 === 0 ? male.shift() || other.shift() : female.shift() || other.shift()
    if (take) out.push(take)
    i += 1
    if (i > input.limit * 4) break
  }
  return out
}

export async function getSiteHomeRecommendationBlock(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  linkedUserId?: string | null
  loggedIn?: boolean
  email?: string | null
  limit?: number
  offset?: number
  mixSeed?: number | null
  /** 188 «Xem thêm»: chỉ thêm cùng shop TQ + L3, không trộn lại cohort. */
  sameShopOnly?: boolean
}): Promise<PartnerSiteHomeRecommendationBlock> {
  const limit = Math.max(1, Math.min(48, Math.floor(Number(input.limit) || HOME_RECOMMENDATION_SHOP_LIMIT)))
  const offset = Math.max(0, Math.floor(Number(input.offset) || 0))
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const viewedIds = state?.recently_viewed_ids ?? []
  const demo = await resolveVisitorDemographics({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    linkedUserId: input.linkedUserId,
    loggedIn: input.loggedIn ?? Boolean(input.linkedUserId),
    email: input.email,
  })
  const seed =
    input.mixSeed != null && Number.isFinite(Number(input.mixSeed))
      ? Math.floor(Number(input.mixSeed)) >>> 0
      : Math.floor(Math.random() * 0x7fffffff)
  const shopOnly = Boolean(input.sameShopOnly) || offset > 0
  const shop = await sameShopAndL3Products({
    partnerId: input.partnerId,
    siteSlug: input.siteSlug,
    viewedIds,
    limit: limit + 1,
    seed,
    offset: shopOnly ? offset : 0,
  })
  const hasMoreShop = shop.length > limit
  const shopPage = shop.slice(0, limit)
  const viewedSet = new Set(viewedIds.map((id) => id.toLowerCase()))

  const applySale = async (rows: PartnerSitePersonalizationProduct[]) => {
    const overlay = await loadPartnerSiteSaleOverlay(input.partnerId).catch(() => null)
    if (!overlay) return rows
    return rows.map((product) => {
      const sold = applyPartnerSiteSaleToShopProduct(product, overlay.state, {
        clearanceEnabled: overlay.clearanceEnabled,
        clearancePercent: overlay.clearancePercent,
      })
      return { ...product, ...sold }
    })
  }

  if (shopOnly) {
    return {
      products: await applySale(shopPage),
      personalized: viewedIds.length > 0 || Boolean(demo.gender),
      cohort_mode: demo.loggedIn
        ? demo.gender
          ? 'gender_peers'
          : 'profile_incomplete'
        : 'requires_login',
      cohort_badge_product_ids: [],
      same_shop_seed: seed,
      same_shop_used: shopPage.length,
      has_more: hasMoreShop,
    }
  }

  let cohort: PartnerSitePersonalizationProduct[] = []
  let cohortMode: SameAgeGenderCohortMode = demo.loggedIn
    ? demo.gender
      ? 'gender_peers'
      : 'profile_incomplete'
    : 'requires_login'
  if (demo.loggedIn && !demo.gender) {
    cohortMode = 'profile_incomplete'
  } else if (demo.gender) {
    const sampled = await cohortProducts({
      partnerId: input.partnerId,
      siteSlug: input.siteSlug,
      accountKey: input.accountKey,
      gender: demo.gender,
      birthYear: demo.birthYear,
      excludeIds: viewedSet,
      limit: HOME_RECOMMENDATION_COHORT_LIMIT,
      seed,
    })
    cohort = sampled.products
    cohortMode = sampled.mode
    if (!cohort.length && shopPage.length) {
      cohortMode = demo.loggedIn && demo.birthYear == null ? 'profile_incomplete' : sampled.mode
    }
  } else if (!shopPage.length) {
    cohort = await popularFallbackProducts({
      partnerId: input.partnerId,
      siteSlug: input.siteSlug,
      excludeIds: viewedIds,
      limit,
      balanceGender: true,
    })
    cohortMode = cohort.length ? 'popular_fallback' : 'requires_login'
  }

  if (!shopPage.length && !cohort.length) {
    cohort = await popularFallbackProducts({
      partnerId: input.partnerId,
      siteSlug: input.siteSlug,
      excludeIds: viewedIds,
      limit,
      balanceGender: !demo.gender,
    })
    if (cohort.length && cohortMode === 'requires_login') cohortMode = 'popular_fallback'
  }

  const mixed = mixShopAndCohortProducts(
    shopPage.map((p) => ({ ...p, inventoryId: p.inventory_id })),
    cohort.map((p) => ({ ...p, inventoryId: p.inventory_id })),
    seed
  ).slice(0, limit)
  const shopIds = new Set(shopPage.map((p) => p.inventory_id.toLowerCase()))
  const cohortBadge = mixed
    .filter((p) => !shopIds.has(p.inventory_id.toLowerCase()))
    .map((p) => p.inventory_id)

  return {
    products: await applySale(mixed),
    personalized: viewedIds.length > 0 || Boolean(demo.gender),
    cohort_mode: cohortMode,
    cohort_badge_product_ids: cohortBadge,
    same_shop_seed: seed,
    same_shop_used: shopPage.length,
    has_more: hasMoreShop,
  }
}
