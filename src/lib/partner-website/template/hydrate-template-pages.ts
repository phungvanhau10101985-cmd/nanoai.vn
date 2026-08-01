import type { PartnerWebsitePage } from '@/lib/partner-website/template/partner-website-template-types'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

function inventoryImageUrl(row: { image_url?: string | null }): string {
  return row.image_url?.trim() || ''
}

export async function hydratePartnerWebsitePages(
  partnerId: string,
  pages: PartnerWebsitePage[],
  siteSlug?: string
): Promise<PartnerWebsitePage[]> {
  const slug = siteSlug?.trim() ?? ''
  const next = pages.map((p) => ({
    ...p,
    sections: p.sections.map((s) => ({ ...s, props: { ...s.props } })),
  }))

  for (const page of next) {
    for (const section of page.sections) {
      if (section.type !== 'products-v1') continue
      if (section.props.useInventory !== true) continue

      const limit = typeof section.props.limit === 'number' ? section.props.limit : 8
      const inv = await fetchPartnerInventoryActivePageWithCountFromPg(partnerId, 0, limit)
      const rows = inv?.rows ?? []
      if (!rows.length) continue

      section.props.products = rows.map((row) => {
        const productUrl = (row.product_url ?? '').trim()
        const inventoryId = row.id
        return {
          name: row.name?.trim() || row.sku || 'Product',
          price: row.price_hint?.trim() || '',
          description: row.description?.trim()?.slice(0, 160) || row.stock_note?.trim()?.slice(0, 80) || '',
          imageUrl: inventoryImageUrl(row),
          ctaText: section.props.productCtaText ?? 'View',
          inventoryId,
          productUrl,
          detailPath: slug && inventoryId ? partnerSiteProductPath(slug, inventoryId) : '',
        }
      })
    }
  }

  return next
}
