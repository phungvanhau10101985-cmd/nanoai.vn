import {
  fetchPartnerCategoriesFlatFromPg,
  fetchPartnerCategoryByIdFromPg,
  fetchPartnerCategoryProductSampleNamesFromPg,
  fetchDirectProductCountsByCategoryFromPg,
  setPartnerCategoryGeneratedSeoFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import {
  resolvePartnerCategoryAncestors,
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryRow,
} from '@/lib/partner-website/category/partner-category-types'
import {
  buildPartnerCategorySeoTitle,
  generatePartnerCategorySeoContent,
  type CategorySeoAiError,
} from '@/lib/partner-website/category/partner-category-seo-ai'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'

export type PartnerCategoryShopSeoContext = {
  shopDisplayName: string
  locale: WebLocale
}

export function categoryNeedsSeoFill(row: PartnerCategoryRow): boolean {
  return !row.seoTitle.trim() || !row.seoDescription.trim() || !row.seoBody.trim()
}

export async function loadPartnerCategoryShopSeoContext(
  partnerId: string
): Promise<PartnerCategoryShopSeoContext> {
  const [site, profile] = await Promise.all([
    fetchPartnerWebsiteByPartnerIdPg(partnerId),
    fetchPartnerProfileForWebsitePg(partnerId),
  ])
  const locale = normalizeWebLocale(site?.locale) || 'vi'
  const shopDisplayName =
    site?.title?.trim() ||
    profile?.brandName?.trim() ||
    profile?.displayName?.trim() ||
    'Shop'
  return { shopDisplayName, locale }
}

export type FillPartnerCategorySeoResult =
  | { ok: true; row: PartnerCategoryRow }
  | { ok: false; error: CategorySeoAiError | 'not_found' | 'db_error' }

/**
 * Điền seo_title / seo_description / seo_body còn trống bằng AI.
 * Không ghi đè nội dung merchant đã có. AI lỗi → trả error, không dùng mẫu dự phòng.
 */
export async function fillPartnerCategorySeoIfEmpty(input: {
  partnerId: string
  categoryId: string
  shop?: PartnerCategoryShopSeoContext
  sampleProductNames?: string[]
  category?: PartnerCategoryRow
  flat?: PartnerCategoryRow[] | null
}): Promise<FillPartnerCategorySeoResult> {
  const category =
    input.category ?? (await fetchPartnerCategoryByIdFromPg(input.partnerId, input.categoryId))
  if (!category) return { ok: false, error: 'not_found' }
  if (!categoryNeedsSeoFill(category)) return { ok: true, row: category }

  const shop = input.shop ?? (await loadPartnerCategoryShopSeoContext(input.partnerId))
  const flat =
    input.flat === undefined
      ? await fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: false })
      : input.flat
  const ancestors = flat ? resolvePartnerCategoryAncestors(flat, category) : []
  const displayName = resolvePartnerCategoryDisplayName(category, shop.locale)
  const breadcrumbNames = [...ancestors, category].map((c) =>
    resolvePartnerCategoryDisplayName(c, shop.locale)
  )
  const needDescription = !category.seoDescription.trim()
  const needBody = !category.seoBody.trim()

  let seoDescription: string | undefined
  let seoBody: string | undefined
  if (needDescription || needBody) {
    const [sampleNames, counts] = await Promise.all([
      input.sampleProductNames
        ? Promise.resolve(input.sampleProductNames)
        : fetchPartnerCategoryProductSampleNamesFromPg(category.id, 6),
      fetchDirectProductCountsByCategoryFromPg(input.partnerId),
    ])
    const generated = await generatePartnerCategorySeoContent({
      categoryName: displayName,
      breadcrumbNames,
      productCount: counts?.get(category.id) ?? 0,
      sampleProductNames: sampleNames,
      shopDisplayName: shop.shopDisplayName,
      locale: shop.locale,
    })
    if (!generated.ok) return generated
    seoDescription = needDescription ? generated.description : undefined
    seoBody = needBody ? generated.body : undefined
  }

  const seoTitle = category.seoTitle.trim()
    ? undefined
    : buildPartnerCategorySeoTitle(displayName, shop.shopDisplayName)
  if (!seoTitle && !seoDescription && !seoBody) return { ok: true, row: category }

  const saved = await setPartnerCategoryGeneratedSeoFromPg(input.partnerId, category.id, {
    seoTitle,
    seoDescription,
    seoBody,
    locale: shop.locale,
  })
  if (!saved) return { ok: false, error: 'db_error' }
  return { ok: true, row: saved }
}

export async function fillPartnerCategoriesSeoIfEmpty(input: {
  partnerId: string
  categoryIds: string[]
  shop: PartnerCategoryShopSeoContext
  sampleProductNames?: string[]
  concurrency?: number
}): Promise<{ ok: true } | { ok: false; error: CategorySeoAiError | 'not_found' | 'db_error' }> {
  const unique = [...new Set(input.categoryIds.filter(Boolean))]
  if (unique.length === 0) return { ok: true }
  const flat = await fetchPartnerCategoriesFlatFromPg(input.partnerId, { activeOnly: false })
  const limit = Math.max(1, input.concurrency ?? 2)
  let index = 0
  let stopped: CategorySeoAiError | 'not_found' | 'db_error' | null = null
  async function worker() {
    while (index < unique.length && !stopped) {
      const i = index
      index += 1
      const categoryId = unique[i]
      const category = flat?.find((c) => c.id === categoryId)
      const filled = await fillPartnerCategorySeoIfEmpty({
        partnerId: input.partnerId,
        categoryId,
        shop: input.shop,
        sampleProductNames: input.sampleProductNames,
        category,
        flat,
      })
      if (!filled.ok) {
        stopped = filled.error
        return
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, unique.length) }, () => worker()))
  return stopped ? { ok: false, error: stopped } : { ok: true }
}
