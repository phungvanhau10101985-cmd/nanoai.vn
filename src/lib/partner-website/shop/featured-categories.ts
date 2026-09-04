import { withLiveCategoryBindCache } from '@/lib/cache/partner-shop-cache'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'
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
  partnerCategoryNavHref,
  splitPartnerCategoryNavTree,
  takePartnerHorizontalNavTree,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { inferApparelGenderFromName } from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'
import { resolveCategoryHubTileImages } from '@/lib/partner-website/shop/category-hub-images'
import {
  partnerSiteCategoryHubPath,
  partnerSiteCategoryPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export const FEATURED_CATEGORY_TILE_DEFAULT = 10
export const FEATURED_CATEGORY_TILE_MAX = 20
export const FEATURED_CATEGORY_ROWS_DEFAULT = 2
export const NAV_RECENT_VIEW_PILL_LIMIT = 8
export const PW_PERSONALIZE_NAV_ATTR = 'data-pw-personalize-nav'
export const PW_PERSONALIZE_NAV_RECENT = 'recent-categories'

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

/** Hàng pill live — vừa xem hoặc L1 fallback. Cùng shape HTML + React. */
export type LiveNavRowItem = {
  id: string
  name: string
  href: string
  children: LiveNavRowItem[]
}

export type FeaturedCategoryBlock = {
  tiles: FeaturedCategoryTile[]
  /** Hàng pill header: danh mục chứa SP vừa xem. Rỗng → dùng nav_row L1. */
  nav_pills: FeaturedCategoryTile[]
  /** Hàng pill đã resolve để first paint (vừa xem hoặc L1). */
  nav_row: LiveNavRowItem[]
  show_nav_all: boolean
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
  if (c.level === 3 && c.viewed) score += 60
  if (c.level === 2 && c.viewed) score += 20
  for (const vn of viewedNames) score += tokenOverlapScore(c.name, vn) * 12
  return score
}

/**
 * L3 chứa SP vừa xem, theo thứ tự xem. Gắn L2 (chưa có L3) → mọi L3 con còn hàng.
 * Không bung cả cây L1 (quá rộng).
 */
export function collectViewedFeaturedL3Ids(input: {
  candidates: FeaturedCategoryCandidate[]
  directIds?: Set<string>
  /** Id danh mục theo thứ tự SP vừa xem (mới nhất trước). */
  orderedDirectIds?: string[]
}): string[] {
  const direct = new Set(
    [...(input.directIds ?? []), ...(input.orderedDirectIds ?? [])].map((id) => id.toLowerCase())
  )
  if (!direct.size) return []
  const byId = new Map(input.candidates.map((c) => [c.id.toLowerCase(), c]))
  const out: string[] = []
  const used = new Set<string>()
  const add = (id: string) => {
    const key = id.toLowerCase()
    const c = byId.get(key)
    if (!c || c.level !== 3 || used.has(key)) return
    used.add(key)
    out.push(c.id)
  }
  const l3ChildrenOf = (parent: FeaturedCategoryCandidate) =>
    input.candidates
      .filter((c) => c.level === 3 && categoryPathIsAncestor(parent.path, c.path))
      .sort((a, b) => b.productCount - a.productCount)
  const consider = (rawId: string) => {
    const c = byId.get(String(rawId || '').toLowerCase())
    if (!c) return
    if (c.level === 3) {
      add(c.id)
      return
    }
    if (c.level !== 2) return
    const children = l3ChildrenOf(c)
    if (children.some((ch) => direct.has(ch.id.toLowerCase()))) return
    for (const ch of children) add(ch.id)
  }
  const order = (input.orderedDirectIds?.length ? input.orderedDirectIds : [...direct]).map((id) =>
    String(id || '').toLowerCase()
  )
  for (const id of order) consider(id)
  return out
}

/**
 * Mọi ô = L3 chứa SP vừa xem trước. Hết L3 vừa xem thì L3 phổ biến cùng giới, rồi L2 / L1.
 * Không để ô đầu L2 «Đầm» còn ô cạnh giữ chữ mẫu Túi xách / Giày dép.
 */
export function pickFeaturedCategoryTiles(input: {
  candidates: FeaturedCategoryCandidate[]
  viewedNames?: string[]
  gender: FeaturedCategoryGender | null
  limit: number
  /** Id danh mục gắn SP vừa xem — ô này lên trước, rồi mới trám phổ biến. */
  directIds?: Set<string>
  orderedDirectIds?: string[]
}): FeaturedCategoryCandidate[] {
  const limit = Math.max(4, Math.min(FEATURED_CATEGORY_TILE_MAX, Math.floor(Number(input.limit) || FEATURED_CATEGORY_TILE_DEFAULT)))
  const viewedNames = input.viewedNames ?? []
  const byId = new Map(input.candidates.map((c) => [c.id, c]))
  const recentL3 = collectViewedFeaturedL3Ids({
    candidates: input.candidates,
    directIds: input.directIds,
    orderedDirectIds: input.orderedDirectIds,
  })
  const picked: FeaturedCategoryCandidate[] = []
  const used = new Set<string>()
  for (const id of recentL3) {
    if (picked.length >= limit) break
    const c = byId.get(id)
    if (!c || used.has(c.id)) continue
    used.add(c.id)
    picked.push(c)
  }
  const matching = input.gender
    ? input.candidates.filter((c) => c.gender === input.gender)
    : input.candidates
  const unisex = input.gender ? input.candidates.filter((c) => c.gender == null) : []
  const ranked = [...matching].sort((a, b) => scoreCandidate(b, viewedNames) - scoreCandidate(a, viewedNames))
  const fillLevel = (pool: FeaturedCategoryCandidate[], level: 1 | 2 | 3) => {
    for (const c of pool) {
      if (picked.length >= limit) break
      if (c.level !== level || used.has(c.id)) continue
      used.add(c.id)
      picked.push(c)
    }
  }
  fillLevel(ranked, 3)
  if (picked.length < limit) {
    fillLevel(
      unisex.sort((a, b) => scoreCandidate(b, viewedNames) - scoreCandidate(a, viewedNames)),
      3
    )
  }
  fillLevel(ranked, 2)
  if (picked.length < limit) {
    fillLevel(
      unisex.sort((a, b) => scoreCandidate(b, viewedNames) - scoreCandidate(a, viewedNames)),
      2
    )
  }
  fillLevel(ranked, 1)
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

function categoryPathIsAncestor(parentPath: string, childPath: string): boolean {
  const parent = String(parentPath || '').replace(/^\/+|\/+$/g, '')
  const child = String(childPath || '').replace(/^\/+|\/+$/g, '')
  if (!parent || !child) return false
  return child === parent || child.startsWith(`${parent}/`)
}

/** Hàng nav dưới ô tìm: chỉ danh mục chứa SP vừa xem (L2 → L3 → L1). */
export function pickRecentViewNavPills(input: {
  candidates: FeaturedCategoryCandidate[]
  /** Id danh mục gắn SP vừa xem (không kể con cháu cùng nhánh). */
  directIds?: Set<string>
  limit?: number
}): FeaturedCategoryCandidate[] {
  const limit = Math.max(1, Math.min(12, Math.floor(Number(input.limit) || NAV_RECENT_VIEW_PILL_LIMIT)))
  const direct = input.directIds
  const viewed = input.candidates.filter((c) =>
    direct?.size ? direct.has(c.id.toLowerCase()) : c.viewed
  )
  if (!viewed.length) return []
  const used = new Set<string>()
  const out: FeaturedCategoryCandidate[] = []
  const hasAncestorPicked = (c: FeaturedCategoryCandidate) =>
    out.some((p) => p.level < c.level && categoryPathIsAncestor(p.path, c.path))
  const take = (level: 1 | 2 | 3, skipIfCovered: boolean) => {
    const pool = viewed.filter((c) => c.level === level).sort((a, b) => b.productCount - a.productCount)
    for (const c of pool) {
      if (out.length >= limit) break
      if (used.has(c.id)) continue
      if (skipIfCovered && (hasAncestorPicked(c) || (level === 1 && out.length))) continue
      used.add(c.id)
      out.push(c)
    }
  }
  take(2, false)
  take(3, true)
  take(1, true)
  return out
}

function treeNodeToLiveNavRow(
  siteSlug: string,
  locale: WebLocale,
  node: PartnerCategoryTreeNode
): LiveNavRowItem {
  const kho = isPartnerKhoSaleNavNode(node)
  const copy = getPartnerSiteShopCopy(locale)
  return {
    id: node.id,
    name: kho ? copy.khoSaleNavLabel : resolvePartnerCategoryDisplayName(node, locale),
    href: partnerCategoryNavHref(siteSlug, node),
    children: (node.children || []).map((child) => treeNodeToLiveNavRow(siteSlug, locale, child)),
  }
}

export function liveNavRowFromBlockInput(input: {
  siteSlug: string
  locale: WebLocale
  navPills: FeaturedCategoryTile[]
  tree: PartnerCategoryTreeNode[]
}): { nav_row: LiveNavRowItem[]; show_nav_all: boolean } {
  if (input.navPills.length) {
    return {
      nav_row: input.navPills.map((tile) => ({
        id: tile.id,
        name: tile.short_name || tile.name,
        href: tile.href,
        children: [],
      })),
      show_nav_all: false,
    }
  }
  const l1 = takePartnerHorizontalNavTree(input.tree)
  return {
    nav_row: l1.map((node) => treeNodeToLiveNavRow(input.siteSlug, input.locale, node)),
    show_nav_all: input.tree.length > l1.length,
  }
}

function tilesFromCandidates(
  siteSlug: string,
  picked: FeaturedCategoryCandidate[],
  imageById?: Map<string, string>
): FeaturedCategoryTile[] {
  return picked.map((c) => ({
    id: c.id,
    name: c.name,
    short_name: shortFeaturedCategoryName(c.name),
    path: c.path,
    href: partnerSiteCategoryPath(siteSlug, c.path),
    image_url: imageById?.get(c.id) || c.imageUrl,
    product_count: c.productCount,
    level: c.level,
  }))
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


async function getSiteFeaturedCategoryBlockUncached(input: {
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
    nav_pills: [],
    nav_row: [],
    show_nav_all: false,
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
  const orderedDirectIds: string[] = []
  for (const id of viewedIds) {
    const sig = signals.get(id.toLowerCase())
    if (sig?.subKey) {
      viewedCategoryIds.add(sig.subKey.toLowerCase())
      orderedDirectIds.push(sig.subKey)
    }
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
    directIds: viewedCategoryIds,
    orderedDirectIds,
  })
  const navPills = tilesFromCandidates(
    input.siteSlug,
    pickRecentViewNavPills({
      candidates,
      directIds: viewedCategoryIds,
      limit: NAV_RECENT_VIEW_PILL_LIMIT,
    })
  )
  const navResolved = liveNavRowFromBlockInput({
    siteSlug: input.siteSlug,
    locale,
    navPills,
    tree,
  })
  if (!picked.length) {
    return {
      ...empty(),
      nav_pills: navPills,
      nav_row: navResolved.nav_row,
      show_nav_all: navResolved.show_nav_all,
      gender,
      gender_label: featuredCategoryGenderLabel(gender),
      source,
    }
  }

  const withImages = await resolveCategoryHubTileImages({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
    tree,
    tiles: picked.map((c) => ({ id: c.id, imageUrl: c.imageUrl })),
  })
  const imageById = new Map(withImages.map((t) => [t.id, t.imageUrl]))
  const tiles: FeaturedCategoryTile[] = tilesFromCandidates(input.siteSlug, picked, imageById)
  const withImg = tiles.filter((t) => t.image_url)
  const withoutImg = tiles.filter((t) => !t.image_url)
  return {
    tiles: [...withImg, ...withoutImg].slice(0, limit),
    nav_pills: navPills,
    nav_row: navResolved.nav_row,
    show_nav_all: navResolved.show_nav_all,
    gender,
    gender_label: featuredCategoryGenderLabel(gender),
    source,
    hub_href: hub,
  }
}

/** Pill + ô danh mục nổi bật — cache 45s / khách. HTML live và API cùng một bản. */
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
  return withLiveCategoryBindCache({
    partnerId: input.partnerId,
    slug: input.siteSlug,
    accountKey: input.accountKey,
    linkedUserId: input.linkedUserId,
    locale,
    limit,
    load: () => getSiteFeaturedCategoryBlockUncached({ ...input, locale, limit }),
  })
}
