import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'

/**
 * Nhận diện trang chữ dạng blog / chính sách / hướng dẫn (Vận chuyển, Đổi trả, FAQ…).
 * Dùng một nguồn này cho: ô AI viết bài, schema Article, đồng bộ CMS text — tránh nhầm
 * với home / listing / PDP / giỏ / sale catalog.
 */

/** pageKey visual = trang chữ SEO Article (không gồm sale/lookbook catalog). */
export const PARTNER_TEXT_ARTICLE_PAGE_KEYS = [
  'about',
  'contact',
  'faq',
  'shipping',
  'returns',
  'payment',
  'privacy',
  'terms',
  'thank_you',
  'stores',
  'size_guide',
  'blog',
] as const

export type PartnerTextArticlePageKey = (typeof PARTNER_TEXT_ARTICLE_PAGE_KEYS)[number]

/** Info routes mang tính catalog — không gắn ô viết bài Article. */
export const PARTNER_INFO_CATALOG_PAGE_KEYS = ['sale', 'lookbook'] as const

export type PartnerTextArticleKind = 'about' | 'policy' | 'guide' | 'faq' | 'blog' | 'contact' | 'cms'

const ARTICLE_KIND_BY_PAGE: Partial<Record<PartnerTextArticlePageKey, PartnerTextArticleKind>> = {
  about: 'about',
  contact: 'contact',
  faq: 'faq',
  shipping: 'policy',
  returns: 'policy',
  payment: 'policy',
  privacy: 'policy',
  terms: 'policy',
  thank_you: 'guide',
  stores: 'guide',
  size_guide: 'guide',
  blog: 'blog',
}

/** Attr gắn vào DOM/HTML để nhận diện ổn định (Sửa nhanh + live). */
export const PW_TEXT_ARTICLE_ATTR = 'data-pw-text-article'
export const PW_ARTICLE_KIND_ATTR = 'data-pw-article-kind'

const TEXT_ARTICLE_KEY_SET = new Set<string>(PARTNER_TEXT_ARTICLE_PAGE_KEYS)
const CATALOG_INFO_KEY_SET = new Set<string>(PARTNER_INFO_CATALOG_PAGE_KEYS)

/** Trang shop không bao giờ là bài viết text. */
const NEVER_TEXT_ARTICLE_PAGE_KEYS = new Set<string>([
  'home',
  'products',
  'product_detail',
  'collection',
  'cart',
  'checkout',
  'account',
  'orders',
  'addresses',
  'wishlist',
  'recently_viewed',
  'sale',
  'lookbook',
  'landing',
])

export function isPartnerTextArticlePageKey(pageKey: string | null | undefined): boolean {
  const key = String(pageKey || '').trim()
  return TEXT_ARTICLE_KEY_SET.has(key)
}

export function isPartnerInfoCatalogPageKey(pageKey: string | null | undefined): boolean {
  return CATALOG_INFO_KEY_SET.has(String(pageKey || '').trim())
}

export function resolvePartnerTextArticleKind(input: {
  pageKey?: string | null
  cmsSlug?: string | null
}): PartnerTextArticleKind {
  const cms = String(input.cmsSlug || '').trim().toLowerCase()
  if (cms) return 'cms'
  const key = String(input.pageKey || '').trim() as PartnerTextArticlePageKey
  return ARTICLE_KIND_BY_PAGE[key] || 'policy'
}

/**
 * HTML đã stamp mã nhận diện trang chữ / info article.
 * Không đoán bằng chữ nút hay class marketing.
 */
export function htmlLooksLikePartnerTextArticle(html: string): boolean {
  const raw = String(html || '')
  if (!raw.trim()) return false
  if (new RegExp(`\\b${PW_TEXT_ARTICLE_ATTR}=["']1["']`, 'i').test(raw)) return true
  if (/data-pw-page=["']info["']/i.test(raw) && /data-pw-info-article|data-pw-info-title|data-pw-info-body/i.test(raw)) {
    return true
  }
  if (/data-pw-info-article/i.test(raw) && /data-pw-info-body|data-pw-info-title/i.test(raw)) return true
  if (/class=["'][^"']*\bpw-shop-info\b/i.test(raw)) return true
  return false
}

/** HTML rõ ràng là storefront thương mại — không coi là bài viết. */
export function htmlLooksLikePartnerCommerceShell(html: string): boolean {
  const raw = String(html || '')
  if (/data-pw-page=["'](home|listing|product|cart|account)["']/i.test(raw)) return true
  if (/data-pw-catalog\b|data-pw-el=["']card-buy["']|data-pw-el=["']card-cart["']/i.test(raw)) return true
  if (/class=["'][^"']*\bpw-product-grid\b/i.test(raw)) return true
  return false
}

/**
 * Một hàm quyết định: có áp dụng ô AI viết bài + schema Article không.
 * Ưu tiên mã stamp / pageKey / cmsSlug; tránh nhầm trang bán hàng.
 */
export function isPartnerTextArticlePage(input: {
  pageKey?: string | null
  cmsSlug?: string | null
  html?: string | null
}): boolean {
  const pageKey = String(input.pageKey || '').trim()
  const cmsSlug = String(input.cmsSlug || '').trim()
  const html = String(input.html || '')

  if (pageKey && NEVER_TEXT_ARTICLE_PAGE_KEYS.has(pageKey)) return false
  if (isPartnerInfoCatalogPageKey(pageKey)) return false

  if (cmsSlug) {
    // CMS tùy chỉnh = bài chữ; trừ khi HTML rõ là catalog.
    if (html && htmlLooksLikePartnerCommerceShell(html) && !htmlLooksLikePartnerTextArticle(html)) {
      return false
    }
    return true
  }

  if (isPartnerTextArticlePageKey(pageKey)) return true

  if (html) {
    if (htmlLooksLikePartnerTextArticle(html)) return true
    if (htmlLooksLikePartnerCommerceShell(html)) return false
  }

  return false
}

/** Gắn mã nhận diện vào HTML trang chữ (idempotent). */
export function stampPartnerTextArticleMarkersInHtml(
  html: string,
  input?: { pageKey?: string | null; cmsSlug?: string | null }
): string {
  if (!html.trim()) return html
  if (!isPartnerTextArticlePage({ pageKey: input?.pageKey, cmsSlug: input?.cmsSlug, html })) {
    return html
  }
  const kind = resolvePartnerTextArticleKind({
    pageKey: input?.pageKey,
    cmsSlug: input?.cmsSlug,
  })
  let out = html
  if (!/data-pw-page=/i.test(out) && /<body\b/i.test(out)) {
    out = out.replace(/<body\b([^>]*)>/i, `<body$1 data-pw-page="info">`)
  } else if (/data-pw-page=["'](?!info)[^"']*["']/i.test(out) && isPartnerTextArticlePageKey(input?.pageKey)) {
    out = out.replace(/\bdata-pw-page=(["'])[^"']*\1/i, 'data-pw-page="info"')
  }
  if (new RegExp(`\\b${PW_TEXT_ARTICLE_ATTR}=`, 'i').test(out)) {
    out = out.replace(
      new RegExp(`\\b${PW_TEXT_ARTICLE_ATTR}=(["'])[\\s\\S]*?\\1`, 'i'),
      `${PW_TEXT_ARTICLE_ATTR}="1"`
    )
  } else if (/data-pw-page=["']info["']/i.test(out)) {
    out = out.replace(
      /(<[^>]*\bdata-pw-page=["']info["'][^>]*)(>)/i,
      `$1 ${PW_TEXT_ARTICLE_ATTR}="1"$2`
    )
  } else if (/<body\b/i.test(out)) {
    out = out.replace(/<body\b([^>]*)>/i, `<body$1 ${PW_TEXT_ARTICLE_ATTR}="1">`)
  }
  if (new RegExp(`\\b${PW_ARTICLE_KIND_ATTR}=`, 'i').test(out)) {
    out = out.replace(
      new RegExp(`\\b${PW_ARTICLE_KIND_ATTR}=(["'])[\\s\\S]*?\\1`, 'i'),
      `${PW_ARTICLE_KIND_ATTR}="${kind}"`
    )
  } else if (new RegExp(`\\b${PW_TEXT_ARTICLE_ATTR}=`, 'i').test(out)) {
    out = out.replace(
      new RegExp(`(<[^>]*\\b${PW_TEXT_ARTICLE_ATTR}=["']1["'][^>]*)(>)`, 'i'),
      `$1 ${PW_ARTICLE_KIND_ATTR}="${kind}"$2`
    )
  }
  return out
}

/** Alias cũ: mọi pageKey trong map CMS info (gồm sale/lookbook). */
export function isVisualInfoCmsPageKey(pageKey: string | null | undefined): boolean {
  return isPartnerTextArticlePageKey(pageKey) || isPartnerInfoCatalogPageKey(pageKey)
}
