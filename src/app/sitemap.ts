import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getAllFeatureSeo } from '@/lib/feature-seo'
import { listPublishedPartnerWebsiteSlugsFromPg } from '@/lib/db/messaging-partner-websites-pg'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/so-do-trang-web`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/thu-do-online`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/support-chat`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.65,
    },
  ]

  const featurePages: MetadataRoute.Sitemap = getAllFeatureSeo().map((seo) => ({
    url: `${baseUrl}${seo.path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // S0.5 — point crawlers at each published tenant sitemap (products/categories). No /lp while Landing paused.
  const partnerSlugs = await listPublishedPartnerWebsiteSlugsFromPg(500)
  const partnerSitemaps: MetadataRoute.Sitemap = partnerSlugs.map((slug) => ({
    url: `${baseUrl}/site/${encodeURIComponent(slug)}/sitemap.xml`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...featurePages, ...partnerSitemaps]
}
