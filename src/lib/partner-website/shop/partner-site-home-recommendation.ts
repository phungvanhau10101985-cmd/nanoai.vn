import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import {
  fetchActiveInventoryByShopKeysFromPg,
  fetchCohortViewedInventoryIdsFromPg,
  fetchInventoryCategorySignalsFromPg,
  fetchPopularInventoryIdsFromPg,
  fetchVisitorProfileHintFromPg,
  upsertVisitorProfileHintFromPg,
  type InventoryCategorySignal,
} from '@/lib/db/messaging-partner-recommendation-pg'
import { fetchPartnerInventoryRowsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import {
  HOME_RECOMMENDATION_COHORT_LIMIT,
  HOME_RECOMMENDATION_SHOP_LIMIT,
  SAME_CATEGORY_HISTORY_WINDOW,
  SAME_CATEGORY_MAX_PER_PAGE,
  SAME_CATEGORY_RECENT_WINDOW,
  buildWeightedCategoryCycle,
  inferApparelGenderFromName,
  mixShopAndCohortProducts,
  pickRoundRobinFromQueues,
  seededShuffle,
  type SameAgeGenderCohortMode,
} from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'
import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'

const HTTP_RE = /^https?:\/\//i

function mapInventoryRowToPersonalizationProduct(
  siteSlug: string,
  row: MessagingPartnerInventoryRow
): PartnerSitePersonalizationProduct | null {
  const imageUrl = (row.image_url ?? '').trim()
  if (!HTTP_RE.test(imageUrl)) return null
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
  }
}

export type PartnerSiteHomeRecommendationBlock = {
  products: PartnerSitePersonalizationProduct[]
  personalized: boolean
  cohort_mode: SameAgeGenderCohortMode
  cohort_badge_product_ids: string[]
  same_shop_seed: number | null
}

function birthYearFromIso(iso: string | null | undefined): number | null {
  const y = Number.parseInt(String(iso || '').slice(0, 4), 10)
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null
}

async function resolveVisitorDemographics(input: {
  partnerId: string
  accountKey: string
  linkedUserId?: string | null
}): Promise<{ gender: 'male' | 'female' | null; birthYear: number | null; loggedIn: boolean }> {
  const loggedIn = Boolean(input.linkedUserId)
  if (input.linkedUserId) {
    const profile = await fetchNanoaiChatProfileFromPg(input.linkedUserId)
    const gender = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null
    const birthYear = birthYearFromIso(profile?.birthDate)
    if (gender) {
      await upsertVisitorProfileHintFromPg({
        partnerId: input.partnerId,
        accountKey: input.accountKey,
        gender,
        birthYear,
      })
    }
    return { gender, birthYear, loggedIn }
  }
  const hint = await fetchVisitorProfileHintFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  return { gender: hint?.gender ?? null, birthYear: hint?.birthYear ?? null, loggedIn: false }
}

function signalOf(
  map: Map<string, InventoryCategorySignal>,
  inventoryId: string
): InventoryCategorySignal | null {
  return map.get(inventoryId.toLowerCase()) ?? null
}

async function sameCategoryProducts(input: {
  partnerId: string
  siteSlug: string
  viewedIds: string[]
  limit: number
  seed: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const historyIds = input.viewedIds.slice(0, SAME_CATEGORY_HISTORY_WINDOW)
  if (!historyIds.length) return []
  const signals = await fetchInventoryCategorySignalsFromPg(input.partnerId, historyIds)
  const historyKeys = historyIds.map((id) => signalOf(signals, id)?.shopKey || '')
  const recentKeys = historyIds
    .slice(0, SAME_CATEGORY_RECENT_WINDOW)
    .map((id) => signalOf(signals, id)?.shopKey || '')
  const known = new Set(historyKeys.filter(Boolean))
  if (!known.size) return []
  const { cycle, maxPerOverrides } = buildWeightedCategoryCycle(historyKeys, recentKeys, known)
  if (!cycle.length) return []

  const recentSubs = new Set(
    historyIds
      .slice(0, SAME_CATEGORY_RECENT_WINDOW)
      .map((id) => signalOf(signals, id)?.subKey || '')
      .filter(Boolean)
  )
  const candidates = await fetchActiveInventoryByShopKeysFromPg({
    partnerId: input.partnerId,
    shopKeys: [...known],
    limit: 400,
  })
  const candidateSignals = await fetchInventoryCategorySignalsFromPg(
    input.partnerId,
    candidates.map((row) => row.id)
  )
  const queues = new Map<string, PartnerSitePersonalizationProduct[]>()
  for (const key of known) {
    const same: PartnerSitePersonalizationProduct[] = []
    const rest: PartnerSitePersonalizationProduct[] = []
    for (const row of candidates) {
      const sig = signalOf(candidateSignals, row.id)
      if (!sig || sig.shopKey !== key) continue
      const mapped = mapInventoryRowToPersonalizationProduct(input.siteSlug, row)
      if (!mapped) continue
      if (sig.subKey && recentSubs.has(sig.subKey)) same.push(mapped)
      else rest.push(mapped)
    }
    const queue = [
      ...seededShuffle(same, input.seed + key.length),
      ...seededShuffle(rest, input.seed + key.length * 7),
    ]
    if (queue.length) queues.set(key, queue)
  }
  return pickRoundRobinFromQueues({
    queues,
    cycle,
    pageSize: input.limit,
    maxPer: SAME_CATEGORY_MAX_PER_PAGE,
    maxPerOverrides,
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
    (await fetchPartnerInventoryRowsByIdsInOrderFromPg(
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
  const rows = (await fetchPartnerInventoryRowsByIdsInOrderFromPg(input.partnerId, ids)) ?? []
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
  limit?: number
}): Promise<PartnerSiteHomeRecommendationBlock> {
  const limit = Math.max(1, Math.min(24, Math.floor(Number(input.limit) || HOME_RECOMMENDATION_SHOP_LIMIT)))
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const viewedIds = state?.recently_viewed_ids ?? []
  const demo = await resolveVisitorDemographics({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    linkedUserId: input.linkedUserId,
  })
  const seed = Math.floor(Math.random() * 0x7fffffff)
  const shop = await sameCategoryProducts({
    partnerId: input.partnerId,
    siteSlug: input.siteSlug,
    viewedIds,
    limit,
    seed,
  })
  const viewedSet = new Set(viewedIds.map((id) => id.toLowerCase()))

  let cohort: PartnerSitePersonalizationProduct[] = []
  let cohortMode: SameAgeGenderCohortMode = demo.loggedIn
    ? demo.gender
      ? 'profile_incomplete'
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
    if (!cohort.length && shop.length) {
      cohortMode = demo.loggedIn && demo.birthYear == null ? 'profile_incomplete' : sampled.mode
    }
  } else if (!shop.length) {
    cohort = await popularFallbackProducts({
      partnerId: input.partnerId,
      siteSlug: input.siteSlug,
      excludeIds: viewedIds,
      limit,
      balanceGender: true,
    })
    cohortMode = cohort.length ? 'popular_fallback' : 'requires_login'
  }

  if (!shop.length && !cohort.length) {
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
    shop.map((p) => ({ ...p, inventoryId: p.inventory_id })),
    cohort.map((p) => ({ ...p, inventoryId: p.inventory_id })),
    seed
  ).slice(0, limit)
  const shopIds = new Set(shop.map((p) => p.inventory_id.toLowerCase()))
  const cohortBadge = mixed
    .filter((p) => !shopIds.has(p.inventory_id.toLowerCase()))
    .map((p) => p.inventory_id)

  return {
    products: mixed,
    personalized: viewedIds.length > 0 || Boolean(demo.gender),
    cohort_mode: cohortMode,
    cohort_badge_product_ids: cohortBadge,
    same_shop_seed: seed,
  }
}
