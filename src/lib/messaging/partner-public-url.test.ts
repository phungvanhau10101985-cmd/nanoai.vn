import { describe, expect, it } from 'vitest'
import {
  buildPartnerChatPublicUrl,
  buildPartnerSitePublicUrl,
  buildPartnerSiteSitemapUrl,
  buildPartnerSiteSitemapPagesUrl,
  buildPartnerSiteSitemapProductsUrl,
  buildGoogleSearchConsoleSitemapsUrl,
} from './partner-public-url'

describe('partner-public-url', () => {
  it('builds partner chat public URL', () => {
    expect(buildPartnerChatPublicUrl('https://nanoai.vn', 'shop-a')).toBe(
      'https://nanoai.vn/messaging/p/shop-a'
    )
    expect(buildPartnerChatPublicUrl('https://nanoai.vn/', 'shop-a', true)).toBe(
      'https://nanoai.vn/messaging/p/shop-a?embed=1'
    )
  })

  it('builds partner site public URL', () => {
    expect(buildPartnerSitePublicUrl('https://nanoai.vn', 'shop-a')).toBe(
      'https://nanoai.vn/site/shop-a'
    )
    expect(buildPartnerSitePublicUrl('https://nanoai.vn/', 'shop-a')).toBe(
      'https://nanoai.vn/site/shop-a'
    )
  })

  it('builds sitemap URLs correctly for custom domain and path based sites', () => {
    expect(buildPartnerSiteSitemapUrl('https://gudo.vn')).toBe('https://gudo.vn/sitemap.xml')
    expect(buildPartnerSiteSitemapUrl('https://gudo.vn/')).toBe('https://gudo.vn/sitemap.xml')
    expect(buildPartnerSiteSitemapUrl('https://nanoai.vn/site/my-shop')).toBe(
      'https://nanoai.vn/site/my-shop/sitemap.xml'
    )
    expect(buildPartnerSiteSitemapUrl('')).toBe('')

    expect(buildPartnerSiteSitemapPagesUrl('https://gudo.vn')).toBe(
      'https://gudo.vn/sitemap-pages.xml'
    )
    expect(buildPartnerSiteSitemapProductsUrl('https://gudo.vn', 1)).toBe(
      'https://gudo.vn/sitemap-products/1'
    )
    expect(buildPartnerSiteSitemapProductsUrl('https://gudo.vn', 2)).toBe(
      'https://gudo.vn/sitemap-products/2'
    )
  })

  it('builds Google Search Console Sitemaps deep link with encoded trailing slash resource_id', () => {
    // For custom domain: https://gudo.vn/ -> resource_id=https%3A%2F%2Fgudo.vn%2F
    expect(buildGoogleSearchConsoleSitemapsUrl('https://gudo.vn')).toBe(
      'https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fgudo.vn%2F'
    )
    expect(buildGoogleSearchConsoleSitemapsUrl('https://gudo.vn/')).toBe(
      'https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fgudo.vn%2F'
    )

    // For platform URL: https://nanoai.vn/site/my-shop/ -> resource_id=https%3A%2F%2Fnanoai.vn%2Fsite%2Fmy-shop%2F
    expect(buildGoogleSearchConsoleSitemapsUrl('https://nanoai.vn/site/my-shop')).toBe(
      'https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fnanoai.vn%2Fsite%2Fmy-shop%2F'
    )

    // Empty fallback
    expect(buildGoogleSearchConsoleSitemapsUrl('')).toBe(
      'https://search.google.com/search-console/sitemaps'
    )
  })
})
