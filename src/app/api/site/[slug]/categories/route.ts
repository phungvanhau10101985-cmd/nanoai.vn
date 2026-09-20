import { NextResponse } from 'next/server'
import {
  fetchDirectProductCountsByCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { buildPartnerStorefrontVisibleCategoryTree } from '@/lib/partner-website/category/partner-category-types'
import { splitPartnerCategoryNavTree } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

/** W4.8 — cây danh mục active công khai, dùng để dựng mega menu thật (thay nhãn hardcode). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [flat, counts] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true }),
    fetchDirectProductCountsByCategoryFromPg(shop.partnerId),
  ])
  if (flat === null) return NextResponse.json({ error: 'Could not load categories' }, { status: 500 })

  const { tree } = buildPartnerStorefrontVisibleCategoryTree(flat, counts)
  const { menuTree, seoSizeNodes } = splitPartnerCategoryNavTree(tree, shop.site.locale)
  return NextResponse.json(
    { tree, menuTree, seoSizes: seoSizeNodes },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
  )
}
