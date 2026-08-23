/** 188-com-vn `mix_shop_and_cohort_products` + same-shop weighted cycle — ported for partner inventory. */

export const SAME_CATEGORY_HISTORY_WINDOW = 40
export const SAME_CATEGORY_RECENT_WINDOW = 8
export const SAME_CATEGORY_MAX_PER_PAGE = 8
export const SAME_CATEGORY_STREAK_THRESHOLD = 8
export const SAME_CATEGORY_STREAK_WEIGHT = 5
export const SAME_CATEGORY_DOMINANT_MAX = 14
export const HOME_RECOMMENDATION_SHOP_LIMIT = 12
export const HOME_RECOMMENDATION_COHORT_LIMIT = 30

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
}): T[] {
  const page: T[] = []
  const counts = new Map<string, number>()
  if (!input.cycle.length) return page
  let cycleIdx = 0
  let noProgress = 0
  while (page.length < input.pageSize) {
    if (noProgress >= input.cycle.length) break
    const shop = input.cycle[cycleIdx % input.cycle.length]!
    cycleIdx += 1
    const queue = input.queues.get(shop)
    const cap = Math.max(1, input.maxPerOverrides?.[shop] ?? input.maxPer)
    if (!queue?.length || (counts.get(shop) ?? 0) >= cap) {
      noProgress += 1
      continue
    }
    page.push(queue.shift()!)
    counts.set(shop, (counts.get(shop) ?? 0) + 1)
    noProgress = 0
  }
  return page
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
