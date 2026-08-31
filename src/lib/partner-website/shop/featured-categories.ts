import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import {
  fetchDirectProductCountsByCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchInventoryCategorySignalsFromPg,
  fetchVisitorProfileHintFromPg,
  upsertVisitorProfileHintFromPg,
} from '@/lib/db/messaging-partner-recommendation-pg'
import { fetchPartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import type { WebLocale } from '@/lib/i18n/config'
import {
  buildPartnerCategoryTree,
  prunePartnerCategoriesMissingAncestors,
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import {
  isPartnerKhoSaleNavNode,
  splitPartnerCategoryNavTree,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { inferApparelGenderFromName } from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'
import { normalizeShopImageUrl } from '@/lib/partner-website/shop/inventory-shop-detail'
import {
  partnerSiteCategoryHubPath,
  partnerSiteCategoryPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export const FEATURED_CATEGORY_TILE_DEFAULT = 10
export const FEATURED_CATEGORY_TILE_MAX = 20
export const FEATURED_CATEGORY_ROWS_DEFAULT = 2

export type FeaturedCategoryGender = 'male' | 'female'
export type FeaturedCategorySource = 'profile_gender' | 'recent_views' | 'popular_fallback'

export type FeaturedCategoryCandidate = {
  id: string
  name: string
  path: string
  level: 1 | 2 | 3
  productCount: number
  gender: FeaturedCategoryGender | null
  imageUrl: string
  viewed: boolean
}

export type FeaturedCategoryTile = {
  id: string
  name: string
  short_name: string
  path: string
  href: string
  image_url: string
  product_count: number
  level: 1 | 2 | 3
}

export type FeaturedCategoryBlock = {
  tiles: FeaturedCategoryTile[]
  gender: FeaturedCategoryGender | null
  gender_label: 'Nam' | 'Nữ' | null
  source: FeaturedCategorySource
  hub_href: string
}

function clampLevel(depth: number): 1 | 2 | 3 {
  const n = Math.floor(Number(depth) || 1)
  if (n <= 1) return 1
  if (n >= 3) return 3
  return 2
}

export function shortFeaturedCategoryName(name: string, maxLen = 22): string {
  const s = String(name || '')
    .replace(/\s+(Nam|Nữ)$/i, '')
    .trim()
  if (s.length <= maxLen) return s
  return `${s.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`
}

export function featuredCategoryGenderLabel(gender: FeaturedCategoryGender | null): 'Nam' | 'Nữ' | null {
  if (gender === 'male') return 'Nam'
  if (gender === 'female') return 'Nữ'
  return null
}

function featuredCategoryTokens(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
}

export function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(featuredCategoryTokens(a))
  if (!ta.size) return 0
  let n = 0
  for (const w of featuredCategoryTokens(b)) {
    if (ta.has(w)) n += 1
  }
  return n
}

function genderOfChain(names: string[]): FeaturedCategoryGender | null {
  for (let i = names.length - 1; i >= 0; i -= 1) {
    const g = inferApparelGenderFromName(names[i] || '')
    if (g) return g
  }
  return null
}

function subtreeProductCount(node: PartnerCategoryTreeNode, counts: Map<string, number>): number {
  let n = counts.get(node.id) ?? node.productCount ?? 0
  for (const child of node.children ?? []) n += subtreeProductCount(child, counts)
  return n
}

/** Flatten industry nav (junk / Sale kho already stripped) into scored tile candidates. */
export function flattenFeaturedCategoryCandidates(
  tree: PartnerCategoryTreeNode[],
  counts: Map<string, number>,
  locale: WebLocale,
  viewedCategoryIds: Set<string>
): FeaturedCategoryCandidate[] {
  const out: FeaturedCategoryCandidate[] = []
  const walk = (nodes: PartnerCategoryTreeNode[], ancestorNames: string[], ancestorIds: string[]) => {
    for (const node of nodes) {
      if (isPartnerKhoSaleNavNode(node)) continue
      const name = resolvePartnerCategoryDisplayName(node, locale)
      const names = [...ancestorNames, name]
      const ids = [...ancestorIds, node.id]
      const productCount = subtreeProductCount(node, counts)
      if (productCount > 0) {
        const viewed = ids.some((id) => viewedCategoryIds.has(id.toLowerCase()))
        out.push({
          id: node.id,
          name,
          path: node.path,
          level: clampLevel(node.depth),
          productCount,
          gender: genderOfChain(names),
          imageUrl: (node.imageUrl || '').trim(),
          viewed,
        })
      }
      if (node.children?.length) walk(node.children, names, ids)
    }
  }
  walk(tree, [], [])
  return out
}

function scoreCandidate(c: FeaturedCategoryCandidate, viewedNames: string[]): number {
  let score = c.productCount + (c.viewed ? 80 : 0)
  if (c.level === 2 && c.viewed) score += 60
  if (c.level === 3 && c.viewed) score -= 20
  for (const vn of viewedNames) score += tokenOverlapScore(c.name, vn) * 12
  return score
}

function takeByLevel(
  sorted: FeaturedCategoryCandidate[],
  level: 1 | 2 | 3,
  n: number,
  used: Set<string>
): FeaturedCategoryCandidate[] {
  const out: FeaturedCategoryCandidate[] = []
  for (const c of sorted) {
    if (out.length >= n) break
    if (c.level !== level || used.has(c.id)) continue
    used.add(c.id)
    out.push(c)
  }
  return out
}

/**
 * 188 hero mix: half L2 + half L3, then remaining L2/L3, then L1.
 * Gender filter prefers matching branches; unisex fills only if still short.
 */
export function pickFeaturedCategoryTiles(input: {
  candidates: FeaturedCategoryCandidate[]
  viewedNames?: string[]
  gender: FeaturedCategoryGender | null
  limit: number
}): FeaturedCategoryCandidate[] {
  const limit = Math.max(4, Math.min(FEATURED_CATEGORY_TILE_MAX, Math.floor(Number(input.limit) || FEATURED_CATEGORY_TILE_DEFAULT)))
  const viewedNames = input.viewedNames ?? []
  const matching = input.gender
    ? input.candidates.filter((c) => c.gender === input.gender)
    : input.candidates
  const unisex = input.gender ? input.candidates.filter((c) => c.gender == null) : []
  const ranked = [...matching].sort((a, b) => scoreCandidate(b, viewedNames) - scoreCandidate(a, viewedNames))
  const used = new Set<string>()
  const half = Math.max(2, Math.floor(limit / 2))
  const picked = [
    ...takeByLevel(ranked, 2, half, used),
    ...takeByLevel(ranked, 3, half, used),
  ]
  const fill = (pool: FeaturedCategoryCandidate[]) => {
    for (const c of pool) {
      if (picked.length >= limit) break
      if (used.has(c.id)) continue
      if (c.level !== 2 && c.level !== 3) continue
      used.add(c.id)
      picked.push(c)
    }
  }
  fill(ranked)
  if (picked.length < limit) fill(unisex.sort((a, b) => scoreCandidate(b, viewedNames) - scoreCandidate(a, viewedNames)))
  if (picked.length < limit) {
    for (const c of ranked) {
      if (picked.length >= limit) break
      if (used.has(c.id) || c.level !== 1) continue
      used.add(c.id)
      picked.push(c)
    }
  }
  if (picked.length < limit && input.gender) {
    for (const c of unisex.sort((a, b) => b.productCount - a.productCount)) {
      if (picked.length >= limit) break
      if (used.has(c.id)) continue
      used.add(c.id)
      picked.push(c)
    }
  }
  return picked.slice(0, limit)
}

export function inferApparelGenderFromCandidates(
  viewed: FeaturedCategoryCandidate[]
): FeaturedCategoryGender | null {
  let male = 0
  let female = 0
  for (const c of viewed) {
    if (c.gender === 'male') male += 1
    if (c.gender === 'female') female += 1
  }
  if (male > female) return 'male'
  if (female > male) return 'female'
  return null
}

function birthYearFromIso(iso: string | null | undefined): number | null {
  const y = Number.parseInt(String(iso || '').slice(0, 4), 10)
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null
}

async function resolveVisitorGender(input: {
  partnerId: string
  accountKey: string
  linkedUserId?: string | null
}): Promise<{ gender: FeaturedCategoryGender | null; source: FeaturedCategorySource }> {
  if (input.linkedUserId) {
    const profile = await fetchNanoaiChatProfileFromPg(input.linkedUserId)
    const gender = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null
    if (gender) {
      await upsertVisitorProfileHintFromPg({
        partnerId: input.partnerId,
        accountKey: input.accountKey,
        gender,
        birthYear: birthYearFromIso(profile?.birthDate),
      })
      return { gender, source: 'profile_gender' }
    }
  }
  const hint = await fetchVisitorProfileHintFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  if (hint?.gender) return { gender: hint.gender, source: 'profile_gender' }
  return { gender: null, source: 'recent_views' }
}

async function fetchCategorySampleImagesFromPg(
  partnerId: string
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!isPgConfigured()) return out
  try {
    const rows = await pgQuery<{ category_id: string; image_url: string }>(
      `select pic.category_id::text as category_id, coalesce(mpi.image_url, '') as image_url
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_inventory mpi on mpi.id = pic.inventory_id
       join public.messaging_partner_categories c on c.id = pic.category_id
       where c.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and coalesce(mpi.image_url, '') <> ''
       order by mpi.sort_order asc, mpi.updated_at desc
       limit 2500`,
      [partnerId]
    )
    for (const row of rows) {
      const url = normalizeShopImageUrl(row.image_url)
      if (!url) continue
      const id = row.category_id.toLowerCase()
      const list = out.get(id) ?? []
      if (list.length >= 8) continue
      if (list.includes(url)) continue
      list.push(url)
      out.set(id, list)
    }
  } catch (e) {
    console.warn('[fetchCategorySampleImagesFromPg]', e)
  }
  return out
}

function assignUniqueImages(
  picked: FeaturedCategoryCandidate[],
  imagesByCategory: Map<string, string[]>,
  descendantIds: Map<string, string[]>
): FeaturedCategoryCandidate[] {
  const used = new Set<string>()
  return picked.map((c) => {
    const own = normalizeShopImageUrl(c.imageUrl)
    if (own && !used.has(own)) {
      used.add(own)
      return { ...c, imageUrl: own }
    }
    const ids = [c.id, ...(descendantIds.get(c.id.toLowerCase()) ?? [])]
    for (const id of ids) {
      for (const url of imagesByCategory.get(id.toLowerCase()) ?? []) {
        if (!url || used.has(url)) continue
        used.add(url)
        return { ...c, imageUrl: url }
      }
    }
    return { ...c, imageUrl: own }
  })
}

function descendantIdMap(tree: PartnerCategoryTreeNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const walk = (node: PartnerCategoryTreeNode): string[] => {
    const ids: string[] = []
    for (const child of node.children ?? []) {
      ids.push(child.id.toLowerCase())
      ids.push(...walk(child))
    }
    out.set(node.id.toLowerCase(), ids)
    return ids
  }
  for (const root of tree) walk(root)
  return out
}

export async function getSiteFeaturedCategoryBlock(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  linkedUserId?: string | null
  locale?: WebLocale
  limit?: number
}): Promise<FeaturedCategoryBlock> {
  const locale = input.locale && ['vi', 'en', 'zh', 'ja', 'ko'].includes(input.locale) ? input.locale : 'vi'
  const limit = Math.max(4, Math.min(FEATURED_CATEGORY_TILE_MAX, Math.floor(Number(input.limit) || FEATURED_CATEGORY_TILE_DEFAULT)))
  const hub = partnerSiteCategoryHubPath(input.siteSlug)
  const empty = (): FeaturedCategoryBlock => ({
    tiles: [],
    gender: null,
    gender_label: null,
    source: 'popular_fallback',
    hub_href: hub,
  })
  if (!isPgConfigured()) return empty()

  const [flat, counts, demo, state] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: true }),
    fetchDirectProductCountsByCategoryFromPg(input.partnerId),
    resolveVisitorGender({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      linkedUserId: input.linkedUserId,
    }),
    fetchPartnerVisitorPersonalizationFromPg({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
    }),
  ])
  if (!flat?.length) return empty()

  const tree = splitPartnerCategoryNavTree(
    buildPartnerCategoryTree(prunePartnerCategoriesMissingAncestors(flat)),
    locale
  ).menuTree
  const viewedIds = state?.recently_viewed_ids ?? []
  const signals = viewedIds.length
    ? await fetchInventoryCategorySignalsFromPg(input.partnerId, viewedIds)
    : new Map()
  const viewedCategoryIds = new Set<string>()
  for (const id of viewedIds) {
    const sig = signals.get(id.toLowerCase())
    if (sig?.subKey) viewedCategoryIds.add(sig.subKey.toLowerCase())
    if (sig?.shopKey) viewedCategoryIds.add(sig.shopKey.toLowerCase())
  }

  const candidates = flattenFeaturedCategoryCandidates(tree, counts ?? new Map(), locale, viewedCategoryIds)
  const viewedCandidates = candidates.filter((c) => c.viewed)
  let gender = demo.gender
  let source: FeaturedCategorySource = demo.source
  if (!gender) {
    gender = inferApparelGenderFromCandidates(viewedCandidates)
    source = gender ? 'recent_views' : 'popular_fallback'
  }

  const picked = pickFeaturedCategoryTiles({
    candidates,
    viewedNames: viewedCandidates.map((c) => c.name),
    gender,
    limit,
  })
  if (!picked.length) {
    return { ...empty(), gender, gender_label: featuredCategoryGenderLabel(gender), source }
  }

  const images = await fetchCategorySampleImagesFromPg(input.partnerId)
  const withImages = assignUniqueImages(picked, images, descendantIdMap(tree))
  const tiles: FeaturedCategoryTile[] = withImages.map((c) => ({
    id: c.id,
    name: c.name,
    short_name: shortFeaturedCategoryName(c.name),
    path: c.path,
    href: partnerSiteCategoryPath(input.siteSlug, c.path),
    image_url: c.imageUrl,
    product_count: c.productCount,
    level: c.level,
  }))
  const withImg = tiles.filter((t) => t.image_url)
  const withoutImg = tiles.filter((t) => !t.image_url)
  return {
    tiles: [...withImg, ...withoutImg].slice(0, limit),
    gender,
    gender_label: featuredCategoryGenderLabel(gender),
    source,
    hub_href: hub,
  }
}
