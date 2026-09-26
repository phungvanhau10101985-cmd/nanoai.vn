import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { resolveRobotsPublicOrigin } from '@/lib/partner-website/shop/partner-shop-robots'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-dynamic'

// Production: set NEXT_PUBLIC_BASE_URL (domain thật) khi build để host/sitemap đúng.
// Custom domain (gudo.vn, …) must advertise that host, not the platform origin.
export default function robots(): MetadataRoute.Robots {
  const headerStore = headers()
  const requestHost =
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headerStore.get('host')?.split(',')[0]?.trim() ||
    ''
  const origin = resolveRobotsPublicOrigin({
    customDomainHost: readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)),
    requestHost,
    platformOrigin: SITE_URL,
  })
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
    '/tao-thiep-moi-cuoi-ai/khach-moi',
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
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
