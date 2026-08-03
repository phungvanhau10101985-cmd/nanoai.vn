import {
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByIdPrefixForPartnerFromPg,
  type MessagingPartnerInventoryRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import { parsePartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'

/** Load inventory row from public product URL key (UUID or name-slug-uuid8). */
export async function resolvePartnerShopProductByKey(
  partnerId: string,
  productKey: string
): Promise<MessagingPartnerInventoryRow | null> {
  const parsed = parsePartnerSiteProductKey(productKey)
  if (!parsed) return null
  if (parsed.kind === 'uuid') {
    return fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, parsed.inventoryId)
  }
  return fetchPartnerInventoryRowByIdPrefixForPartnerFromPg(partnerId, parsed.idPrefix)
}
