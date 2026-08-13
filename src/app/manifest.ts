import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { resolveActivePartnerCustomDomainByHostPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerShopWebManifest } from '@/lib/partner-website/shop/partner-site-pwa'

const shortcutIcon = [
  {
    src: '/icons/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png' as const,
    purpose: 'any' as const,
  },
]

function nanoAiManifest(): MetadataRoute.Manifest {
  return {
    name: 'NanoAI - Sáng tạo không giới hạn cùng AI',
    short_name: 'NanoAI',
    description: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    /** Cho phép xoay ngang các công cụ cần landscape; vẫn mở fullscreen kiểu app. */
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    categories: ['lifestyle', 'shopping', 'utilities'],
    lang: 'vi',
    dir: 'ltr',
    prefer_related_applications: false,
    shortcuts: [
      {
        name: 'Thử đồ AI',
        short_name: 'Thử đồ',
        description: 'Phòng thử đồ ảo',
        url: '/thu-do-online',
        icons: shortcutIcon,
      },
      {
        name: 'Tạo ảnh từ chữ',
        short_name: 'Ảnh từ chữ',
        url: '/tao-anh-tu-chu',
        icons: shortcutIcon,
      },
      {
        name: 'Học ngoại ngữ AI',
        short_name: 'Ngoại ngữ',
        url: '/hoc-tieng-anh-ai',
        icons: shortcutIcon,
      },
      {
        name: 'Giáo trình & lớp',
        short_name: 'Giáo trình',
        url: '/giao-trinh',
        icons: shortcutIcon,
      },
    ],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

/** Platform NanoAI PWA. On a shop custom domain, never fall through to NanoAI branding. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headerStore = headers()
  const customHost =
    readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)) ||
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase().split(':')[0] ||
    headerStore.get('host')?.split(',')[0]?.trim().toLowerCase().split(':')[0] ||
    ''

  if (customHost && !isPlatformAppHostname(customHost)) {
    const row = await resolveActivePartnerCustomDomainByHostPg(customHost).catch(() => null)
    const siteSlug = row?.site_slug?.trim() || ''
    if (siteSlug && row?.use_for_site !== false && row?.site_published) {
      const shop = await loadPartnerSiteShopContext(siteSlug).catch(() => null)
      if (shop) {
        const name = shop.site.title.trim() || shop.site.partnerDisplayName || 'Shop'
        return buildPartnerShopWebManifest({
          siteSlug: shop.site.siteSlug,
          name,
          description: shop.site.partnerDisplayName || name,
          customDomain: true,
          backgroundColor: shop.site.theme.backgroundColor,
          themeColor: shop.site.theme.primaryColor,
          locale: shop.site.locale,
        }) as MetadataRoute.Manifest
      }
    }
  }

  return nanoAiManifest()
}
