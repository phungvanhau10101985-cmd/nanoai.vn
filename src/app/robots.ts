import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Production: set NEXT_PUBLIC_BASE_URL (domain thật) khi build để host/sitemap đúng.
export default function robots(): MetadataRoute.Robots {
  const disallowPaths = [
    '/api/',
    '/admin/',
    '/dashboard/',
    '/auth/',
    '/auth/callback',
    '/auth/signout',
    '/wallet',
    '/test',
    // Shop consultation pages are private business surfaces, not SEO landing pages.
    '/messaging/p/',
    '/messaging/my-chats',
    '/messaging/my-orders',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowPaths,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: disallowPaths,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
