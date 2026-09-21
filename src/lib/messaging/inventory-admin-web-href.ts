import { partnerSiteStorefrontProductHref } from '@/lib/partner-website/shop/partner-site-shop-paths'

type InventoryAdminWebProduct = {
  id: string
  name?: string | null
  product_url?: string | null
}

/**
 * Link “Xem web” trong Kho hàng:
 * - website đã có domain riêng: mở PDP trên domain đó;
 * - chưa có: giữ URL `/site/{slug}` của NanoAI.
 */
export function inventoryAdminWebHref(
  siteSlug: string,
  websitePublicUrl: string | null | undefined,
  product: InventoryAdminWebProduct
): string {
  const slug = siteSlug.trim()
  if (slug) {
    const configuredUrl = String(websitePublicUrl ?? '').trim()
    if (configuredUrl) {
      try {
        const site = new URL(configuredUrl)
        const sitePath = site.pathname.replace(/\/+$/, '')
        const customDomain = sitePath === ''
        const productPath = partnerSiteStorefrontProductHref(slug, {
          inventoryId: product.id,
          productUrl: product.product_url,
          name: product.name,
          customDomain,
        })
        if (productPath) return new URL(productPath, site.origin).toString()
      } catch {
        // URL preview lỗi thì giữ fallback NanoAI bên dưới.
      }
    }

    const href = partnerSiteStorefrontProductHref(slug, {
      inventoryId: product.id,
      productUrl: product.product_url,
      name: product.name,
    })
    if (href) return href
  }

  const raw = String(product.product_url ?? '').trim()
  if (/^https?:\/\//i.test(raw) && !/(^|\.)(1688|taobao|tmall)\./i.test(raw)) return raw
  return ''
}
