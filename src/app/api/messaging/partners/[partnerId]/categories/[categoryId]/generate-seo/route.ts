import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerCategoryByIdFromPg,
  fetchPartnerCategoriesFlatFromPg,
  fetchPartnerCategoryProductSampleNamesFromPg,
  fetchDirectProductCountsByCategoryFromPg,
  setPartnerCategoryGeneratedSeoFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  resolvePartnerCategoryAncestors,
  resolvePartnerCategoryDisplayName,
} from '@/lib/partner-website/category/partner-category-types'
import { generatePartnerCategorySeoContent } from '@/lib/partner-website/category/partner-category-seo-ai'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'

type Ctx = { params: Promise<{ partnerId: string; categoryId: string }> }

/**
 * W4.12 (bổ sung) — nút admin "Tự động sinh SEO" cho 1 danh mục. Tương đương endpoint
 * `POST /category-seo/gemini-targets/run` của 188, nhưng chạy đồng bộ cho 1 danh mục/lần
 * (không cần job nền — 2 lời gọi Gemini nhanh hơn nhiều so với xử lý hàng loạt của 188).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const cid = categoryId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const category = await fetchPartnerCategoryByIdFromPg(pid, cid)
  if (!category) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as { locale?: string }
  const site = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const locale: WebLocale = normalizeWebLocale(body.locale) || site?.locale || 'vi'

  const [flat, sampleNames, counts] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(pid, { activeOnly: false }),
    fetchPartnerCategoryProductSampleNamesFromPg(cid, 6),
    fetchDirectProductCountsByCategoryFromPg(pid),
  ])
  const ancestors = flat ? resolvePartnerCategoryAncestors(flat, category) : []
  const breadcrumbNames = [...ancestors, category].map((c) => resolvePartnerCategoryDisplayName(c, locale))

  const result = await generatePartnerCategorySeoContent({
    categoryName: resolvePartnerCategoryDisplayName(category, locale),
    breadcrumbNames,
    productCount: counts?.get(cid) ?? 0,
    sampleProductNames: sampleNames,
    shopDisplayName: site?.title || category.name,
    locale,
  })

  const updated = await setPartnerCategoryGeneratedSeoFromPg(pid, cid, {
    seoDescription: result.description,
    seoBody: result.body,
    locale,
  })
  if (!updated) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ success: true, category: updated, usedAi: result.usedAi })
}
