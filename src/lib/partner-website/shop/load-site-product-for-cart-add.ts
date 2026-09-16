import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByRemarketingIdForPartnerFromPg,
  fetchPartnerInventoryRowBySkuForPartnerFromPg,
  type MessagingPartnerInventoryRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPartnerInventoryUuid } from '@/lib/partner-website/shop/partner-site-product-slug'
import { inventoryRowToShopProduct, type PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

async function resolveInventoryRowForCartAddSku(
  partnerId: string,
  sku: string
): Promise<MessagingPartnerInventoryRow | null> {
  const key = sku.trim()
  if (!key) return null
  if (isPartnerInventoryUuid(key)) {
    return fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, key)
  }
  const found =
    (await fetchPartnerInventoryRowBySkuForPartnerFromPg(partnerId, key)) ||
    (await fetchPartnerInventoryRowByRemarketingIdForPartnerFromPg(partnerId, key)) ||
    (await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, key))
  if (!found?.id) return null
  return (await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, found.id)) || found
}

export async function loadSiteProductForCartAddSku(input: {
  partnerId: string
  siteSlug: string
  sku: string
}): Promise<PartnerSiteShopProduct | null> {
  const row = await resolveInventoryRowForCartAddSku(input.partnerId, input.sku)
  if (!row) return null
  return inventoryRowToShopProduct(input.siteSlug, row, { pdp: true })
}
