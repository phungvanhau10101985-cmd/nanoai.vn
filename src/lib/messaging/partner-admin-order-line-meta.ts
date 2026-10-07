import { inventoryAdminWebHref, isChinaSourceProductUrl } from '@/lib/messaging/inventory-admin-web-href'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isOrderLineUuidToken(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Mã khách thấy trên đơn — cùng thứ tự 188: SKU lúc đặt, rồi mã kho, rồi remarketing. Không hiện UUID nội bộ. */
export function orderLineDisplaySku(line: {
  product_sku_snapshot?: string | null
  inventory_sku?: string | null
  inventory_remarketing_id?: string | null
}): string {
  for (const raw of [line.product_sku_snapshot, line.inventory_sku, line.inventory_remarketing_id]) {
    const value = String(raw ?? '').trim()
    if (value && !isOrderLineUuidToken(value)) return value
  }
  return ''
}

export function orderLineChinaSourceUrl(line: {
  source_url?: string | null
  product_url?: string | null
}): string {
  for (const raw of [line.source_url, line.product_url]) {
    const value = String(raw ?? '').trim()
    if (value && isChinaSourceProductUrl(value)) return value
  }
  return ''
}

export function orderLineShopHref(input: {
  siteSlug: string
  websitePublicUrl?: string | null
  inventoryId?: string | null
  productName?: string | null
  productUrl?: string | null
}): string {
  return inventoryAdminWebHref(input.siteSlug, input.websitePublicUrl, {
    id: String(input.inventoryId || ''),
    name: input.productName,
    product_url: input.productUrl,
  })
}
