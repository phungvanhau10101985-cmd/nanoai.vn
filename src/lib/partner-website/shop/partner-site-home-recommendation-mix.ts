/** 188-com-vn `mix_shop_and_cohort_products` + same-shop weighted cycle — ported for partner inventory. */

export const SAME_CATEGORY_HISTORY_WINDOW = 40
export const SAME_CATEGORY_RECENT_WINDOW = 8
export const SAME_CATEGORY_MAX_PER_PAGE = 8
export const SAME_CATEGORY_STREAK_THRESHOLD = 8
export const SAME_CATEGORY_STREAK_WEIGHT = 5
export const SAME_CATEGORY_DOMINANT_MAX = 14
/** 188 `get_products_same_shop_as_recent_views` default page. */
export const HOME_RECOMMENDATION_SHOP_LIMIT = 24
export const HOME_RECOMMENDATION_COHORT_LIMIT = 30
/** 188 `SAME_SHOP_MAX_POOL` — candidate cap for (shop TQ, L3) pairs. */
export const SAME_SHOP_MAX_POOL = 1500

export function normalizeSameShopKey(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase()
}

/** 188 `_shop_l3_pair` — both Chinese shop and L3 required. */
export function shopL3PairKey(shop: string | null | undefined, l3: string | null | undefined): string | null {
  const shopKey = normalizeSameShopKey(shop)
  const l3Key = normalizeSameShopKey(l3)
  if (!shopKey || !l3Key) return null
  return `${shopKey}\t${l3Key}`
}

export function allowedShopL3PairsFromRecent(
  recent: Array<{ shop?: string | null; l3?: string | null }>
): Set<string> {
  const out = new Set<string>()
  for (const item of recent) {
    const key = shopL3PairKey(item.shop, item.l3)
    if (key) out.add(key)
  }
  return out
}

export type SameAgeGenderCohortMode =
  | 'requires_login'
  | 'profile_incomplete'
  | 'exact_cohort'
  | 'gender_peers'
  | 'popular_fallback'

export type RecommendationIdentity = {
  inventoryId: string
}

export function nextSeededUint32(state: number): number {
  return ((Math.imul(state, 1664525) + 1013904223) >>> 0)
}

export function mixShopAndCohortProducts<T extends RecommendationIdentity>(
  shopProducts: T[],
  cohortProducts: T[],
  mixSeed: number | null
): T[] {
  const seen = new Set<string>()
  const shop: T[] = []
  for (const p of shopProducts) {
    const id = p.inventoryId.toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    shop.push(p)
  }
  const cohortOnly: T[] = []
  for (const p of cohortProducts) {
    const id = p.inventoryId.toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    cohortOnly.push(p)
  }
  if (!cohortOnly.length) return shop
  let rng = (mixSeed ?? 1) >>> 0
  const mixed = [...shop]
  for (const product of cohortOnly) {
    rng = nextSeededUint32(rng)
    const insertAt = rng % (mixed.length + 1)
    mixed.splice(insertAt, 0, product)
  }
  return mixed
}

export function detectLeadingCategoryStreak(
  recentCategoryKeys: Array<string | null>
): { key: string | null; length: number } {
  let streakKey: string | null = null
  let streakLen = 0
  for (const key of recentCategoryKeys) {
    const shop = (key || '').trim().toLowerCase()
    if (!shop) break
    if (streakKey == null) {
      streakKey = shop
      streakLen = 1
    } else if (shop === streakKey) {
      streakLen += 1
    } else {
      break
    }
  }
  return { key: streakKey, length: streakLen }
}

export function buildWeightedCategoryCycle(
  historyCategoryKeys: string[],
  recentCategoryKeys: string[],
  knownKeys: Set<string>
): { cycle: string[]; maxPerOverrides: Record<string, number> } {
  const maxPerOverrides: Record<string, number> = {}
  const streak = detectLeadingCategoryStreak(recentCategoryKeys)
  const historyOrder: string[] = []
  const seen = new Set<string>()
  for (const raw of historyCategoryKeys) {
    const key = raw.trim().toLowerCase()
    if (!key || !knownKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    historyOrder.push(key)
  }

  if (
    streak.length >= SAME_CATEGORY_STREAK_THRESHOLD &&
    streak.key &&
    knownKeys.has(streak.key)
  ) {
    const others = historyOrder.filter((k) => k !== streak.key)
    if (others.length) {
      maxPerOverrides[streak.key] = SAME_CATEGORY_DOMINANT_MAX
      return {
        cycle: Array(SAME_CATEGORY_STREAK_WEIGHT).fill(streak.key).concat(others),
        maxPerOverrides,
      }
    }
  }

  const freq = new Map<string, number>()
  const order: string[] = []
  for (const raw of historyCategoryKeys) {
    const key = raw.trim().toLowerCase()
    if (!key || !knownKeys.has(key)) continue
    freq.set(key, (freq.get(key) ?? 0) + 1)
    if (!order.includes(key)) order.push(key)
  }
  const cycle: string[] = []
  for (const key of order) {
    const n = freq.get(key) ?? 0
    for (let i = 0; i < n; i += 1) cycle.push(key)
  }
  return { cycle, maxPerOverrides }
}

export function pickRoundRobinFromQueues<T>(input: {
  queues: Map<string, T[]>
  cycle: string[]
  pageSize: number
  maxPer: number
  maxPerOverrides?: Record<string, number>
  /** 188 page offset — cap per shop resets every `pageSize` items. */
  offset?: number
}): T[] {
  const page: T[] = []
  if (!input.cycle.length) return page
  const pageSize = Math.max(1, Math.floor(input.pageSize))
  const skip = Math.max(0, Math.floor(input.offset || 0))
  const need = skip + pageSize
  let cycleIdx = 0
  let produced = 0
  let itemsInPage = 0
  let noProgress = 0
  let counts = new Map<string, number>()
  while (produced < need) {
    if (itemsInPage >= pageSize) {
      counts = new Map()
      itemsInPage = 0
      noProgress = 0
    }
    if (noProgress >= input.cycle.length) break
    const shop = input.cycle[cycleIdx % input.cycle.length]!
    cycleIdx += 1
    const queue = input.queues.get(shop)
    const cap = Math.max(1, input.maxPerOverrides?.[shop] ?? input.maxPer)
    if (!queue?.length || (counts.get(shop) ?? 0) >= cap) {
      noProgress += 1
      continue
    }
    const item = queue.shift()!
    if (produced >= skip) page.push(item)
    counts.set(shop, (counts.get(shop) ?? 0) + 1)
    produced += 1
    itemsInPage += 1
    noProgress = 0
  }
  return page
}

/** 188 `appendNewShopProductsToMix` — «Xem thêm» chỉ nối thêm cùng shop, không xáo lại cohort. */
export function appendNewShopProductsToMix<T extends RecommendationIdentity>(
  current: T[],
  shopBatch: T[]
): T[] {
  if (!shopBatch.length) return current
  const seen = new Set(current.map((p) => p.inventoryId.toLowerCase()).filter(Boolean))
  const extra: T[] = []
  for (const p of shopBatch) {
    const id = p.inventoryId.toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    extra.push(p)
  }
  return extra.length ? [...current, ...extra] : current
}

export function inferApparelGenderFromName(name: string): 'male' | 'female' | null {
  const s = name.trim().toLowerCase()
  if (!s) return null
  if (/(^|[\s/_-])(nữ|nu|women|woman|female|lady|ladies|女|여성)([\s/_-]|$)/i.test(s)) return 'female'
  if (/(^|[\s/_-])(nam|men|man|male|男|남성)([\s/_-]|$)/i.test(s)) return 'male'
  return null
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let rng = seed >>> 0 || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    rng = nextSeededUint32(rng)
    const j = rng % (i + 1)
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}
