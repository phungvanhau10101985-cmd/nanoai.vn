import type { Metadata } from 'next'
import { resolvePartnerSiteAbsoluteUrl } from './partner-site-absolute-url'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

/**
 * Metadata riêng cho trang shop công khai `/site/{slug}/...` (và alias trên custom domain).
 *
 * Khác `buildMetadata()` (dùng cho trang platform NanoAI) ở 2 điểm quan trọng phát hiện khi audit
 * SEO danh mục/PDP so với 188-com-vn:
 * 1. KHÔNG append " | NanoAI" vào title — mỗi shop là 1 thương hiệu riêng, không phải trang của
 *    nền tảng. Caller tự ghép tên shop vào title nếu cần (category/products page đã làm vậy).
 * 2. Canonical/OG url dùng `resolvePartnerSiteAbsoluteUrl` (đọc header custom domain) thay vì
 *    origin tĩnh của platform — tránh canonical trỏ sai domain khi shop dùng domain riêng.
 * 3. OG image ưu tiên ảnh THẬT (ảnh sản phẩm/danh mục/logo shop) thay vì ảnh generic tự sinh
 *    `/og?title=...` (ảnh đó được thiết kế cho trang marketing NanoAI, không phù hợp cho shop khách).
 */
export interface PartnerSiteSEOConfig {
  siteSlug: string
  /** Subpath tương đối gốc shop, vd '/', '/products', '/c/ao-thun', '/products/ao-thun-nam-123'. */
  path: string
  title: string
  description: string
  /** Tên hiển thị của shop — dùng cho og:site_name. */
  siteName: string
  noIndex?: boolean
  /** Ảnh thật (sản phẩm/danh mục/logo shop). Nếu bỏ trống sẽ dùng ảnh mặc định của platform. */
  image?: string | null
  keywords?: string[]
  locale?: string
  type?: 'website' | 'article'
  /** Query canonical đã whitelist (min_price, max_price, page, size, sort, color). */
  search?: string
}

export function buildPartnerSiteMetadata(config: PartnerSiteSEOConfig): Metadata {
  const {
    siteSlug,
    path,
    title,
    description,
    siteName,
    noIndex = false,
    image,
    keywords = [],
    locale = 'vi_VN',
    type = 'website',
    search,
  } = config

  const urlBase = resolvePartnerSiteAbsoluteUrl(siteSlug, path)
  const url = search ? `${urlBase.split('?')[0]}?${search}` : urlBase
  const origin = (() => {
    try {
      return new URL(url).origin
    } catch {
      return defaultPublicOrigin()
    }
  })()
  const keywordsStr = keywords.length > 0 ? keywords.join(', ') : undefined
  const resolvedOgImage = image?.trim() || `${defaultPublicOrigin()}/og-image.png`
  // S0.10 — hreflang self-tag from site locale (vi/en/zh/ja/ko or og locale like vi_VN).
  const hreflang = String(locale || 'vi')
    .trim()
    .toLowerCase()
    .replace(/[_-].*$/, '')
    .replace(/[^a-z]/g, '')
    .slice(0, 8) || 'vi'

  return {
    title,
    description,
    keywords: keywordsStr,
    metadataBase: new URL(origin),
    alternates: {
      canonical: url,
      languages: { [hreflang]: url },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      type,
      locale,
      url,
      siteName,
      title,
      description,
      images: [{ url: resolvedOgImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [resolvedOgImage],
    },
  }
}
