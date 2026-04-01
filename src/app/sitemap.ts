import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getAllFeatureSeo } from '@/lib/feature-seo'

export default function sitemap(): MetadataRoute.Sitemap {
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
  ]

  const featurePages: MetadataRoute.Sitemap = getAllFeatureSeo()
    .map((seo) => ({
      url: `${baseUrl}${seo.path}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }))

  return [...staticPages, ...featurePages]
}
