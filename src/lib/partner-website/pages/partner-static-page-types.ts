/**

 * W3.3 + W3.4 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CMS trang tĩnh + SEO theo shop.

 * W3.2 — thêm các trang phụ catalog (payment/thank-you/stores/lookbook/size-guide/blog) vào builtin.

 */



/** Trang có sẵn — tạo 1 dòng với slug trùng key này để GHI ĐÈ nội dung/SEO mặc định. */

export const PARTNER_BUILTIN_PAGE_SLUGS = [

  'about',

  'contact',

  'faq',

  'sale',

  'shipping',

  'returns',

  'privacy',

  'terms',

  'payment',

  'thank-you',

  'stores',

  'lookbook',

  'size-guide',

  'blog',

  'goi-y-tuoi-gioi',

] as const

export type PartnerBuiltinPageSlug = (typeof PARTNER_BUILTIN_PAGE_SLUGS)[number]



/** Segment cấp 1 đã dùng dưới `/site/{slug}/...` — slug trang tự do KHÔNG được trùng để tránh xung đột route. */

export const PARTNER_SITE_RESERVED_SLUGS = [

  'about', 'account', 'addresses', 'blog', 'c', 'cart', 'contact', 'faq', 'login', 'lookbook', 'lp', 'orders',

  'goi-y-tuoi-gioi', 'payment', 'privacy', 'products', 'recently-viewed', 'returns', 'sale', 'shipping', 'size-guide',

  'stores', 'terms', 'thank-you',

  'wishlist', 'pages', 'sitemap.xml', 'api', 'favorites', 'da-xem',

] as const



export function isBuiltinPageSlug(slug: string): slug is PartnerBuiltinPageSlug {

  return (PARTNER_BUILTIN_PAGE_SLUGS as readonly string[]).includes(slug)

}



export function isValidCustomPageSlug(slug: string): boolean {

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return false

  if (slug.length > 80) return false

  if ((PARTNER_SITE_RESERVED_SLUGS as readonly string[]).includes(slug) && !isBuiltinPageSlug(slug)) return false

  return true

}



export type PartnerStaticPageRow = {

  id: string

  partnerId: string

  slug: string

  title: string

  content: string

  seoTitle: string

  seoDescription: string

  seoIndex: boolean

  isPublished: boolean

  createdAt: string

  updatedAt: string

}



export function splitStaticPageContentToParagraphs(content: string): string[] {

  return content

    .split(/\n{2,}/)

    .map((p) => p.trim())

    .filter(Boolean)

}


