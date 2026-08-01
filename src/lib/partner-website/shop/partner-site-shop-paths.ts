export function partnerSiteHomePath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}`
}

export function partnerSiteProductsPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/products`
}

export function partnerSiteProductPath(siteSlug: string, inventoryId: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/products/${encodeURIComponent(inventoryId.trim())}`
}

export function partnerSiteCartPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/cart`
}

export function partnerSiteOrdersPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/orders`
}

export function partnerSiteProductsApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/products`
}

export function partnerSiteSessionApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/session`
}

export function partnerSitePersonalizationApiPath(siteSlug: string, subpath: string): string {
  const base = `/api/site/${encodeURIComponent(siteSlug.trim())}/personalization`
  const tail = subpath.replace(/^\/+/, '')
  return tail ? `${base}/${tail}` : base
}
