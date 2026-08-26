import { NextResponse } from 'next/server'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import {
  buildPartnerCategoryTree,
  prunePartnerCategoriesMissingAncestors,
} from '@/lib/partner-website/category/partner-category-types'
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

  const flat = await fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true })
  if (flat === null) return NextResponse.json({ error: 'Could not load categories' }, { status: 500 })

  const tree = buildPartnerCategoryTree(prunePartnerCategoriesMissingAncestors(flat))
  const { menuTree, seoSizeNodes } = splitPartnerCategoryNavTree(tree)
  return NextResponse.json(
    { tree, menuTree, seoSizes: seoSizeNodes },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
  )
}
