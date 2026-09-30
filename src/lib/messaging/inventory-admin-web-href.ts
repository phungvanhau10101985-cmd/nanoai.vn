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
  if (/^https?:\/\//i.test(raw) && !isChinaSourceProductUrl(raw)) return raw
  return ''
}

export function isChinaSourceProductUrl(raw: string): boolean {
  const value = raw.trim()
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const host = new URL(value).hostname.toLowerCase()
    return (
      host === '1688.com' ||
      host.endsWith('.1688.com') ||
      host === 'taobao.com' ||
      host.endsWith('.taobao.com') ||
      host === 'tmall.com' ||
      host.endsWith('.tmall.com')
    )
  } catch {
    return /(^|\.)(1688|taobao|tmall)\./i.test(value)
  }
}

/**
 * «Xem chi tiết» trên thẻ chat.
 * URL shop / web khách (không phải nguồn TQ) giữ nguyên.
 * Link 1688 / Taobao / Tmall đổi sang PDP shop khi có inventory id.
 */
export function guestChatProductDetailHref(
  siteSlug: string,
  websitePublicUrl: string | null | undefined,
  product: InventoryAdminWebProduct
): string {
  const raw = String(product.product_url ?? '').trim()
  if (/^https?:\/\//i.test(raw) && !isChinaSourceProductUrl(raw)) return raw
  return inventoryAdminWebHref(siteSlug, websitePublicUrl, product)
}
