import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// LƯU Ý: Production cần set NEXT_PUBLIC_BASE_URL=https://nanoai.vn khi build. Nếu để localhost, Host/Sitemap sẽ sai.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/auth/', '/auth/callback', '/auth/signout', '/wallet', '/test'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/auth/', '/auth/callback', '/auth/signout', '/wallet', '/test'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
