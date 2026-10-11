import { fetchPartnerInventoryRowsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerProfileForWebsitePg } from '@/lib/db/messaging-partner-websites-pg'
import type { PartnerLandingProductSnapshot } from '@/lib/partner-website/landing/partner-landing-types'
import { partnerSiteCatalogHitPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export async function loadPartnerLandingProductSnapshots(input: {
  partnerId: string
  siteSlug: string
  inventoryIds: string[]
}): Promise<PartnerLandingProductSnapshot[]> {
  const ids = input.inventoryIds.map((x) => x.trim()).filter(Boolean)
  if (!ids.length) return []
  const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(input.partnerId, ids)
  if (!rows?.length) return []
  const industryKey = (await fetchPartnerProfileForWebsitePg(input.partnerId))?.industryKey ?? null
  return rows.map((row) => {
    const id = row.id
    const name = row.name?.trim() || row.sku || 'Product'
    return {
      id,
      name,
      price: row.price_hint?.trim() || '',
      description: row.description?.trim() || row.stock_note?.trim() || '',
      imageUrl: row.image_url?.trim() || '',
      detailPath: partnerSiteCatalogHitPath(input.siteSlug, id, {
        name,
        industryKey,
        productUrl: row.product_url,
      }),
    }
  })
}

export function formatLandingProductsForPrompt(
  products: PartnerLandingProductSnapshot[]
): string {
  return products
    .map(
      (p, i) =>
        `${i + 1}. id=${p.id}
   name=${p.name}
   price=${p.price || 'n/a'}
   image=${p.imageUrl || 'n/a'}
   detailPath=${p.detailPath}
   description=${(p.description || '').slice(0, 240)}`
    )
    .join('\n')
}
