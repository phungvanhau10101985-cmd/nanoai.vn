import { partnerSiteHomePath } from './partner-site-shop-paths'

/** Public SW filename on a shop custom domain — must not collide with NanoAI `public/sw.js`. */
export const PARTNER_SHOP_PWA_SW_PUBLIC_FILE = 'pw-shop-sw.js'

export const PARTNER_PWA_ICON_SIZES = [180, 192, 512] as const
export type PartnerPwaIconSize = (typeof PARTNER_PWA_ICON_SIZES)[number]

export function isPartnerPwaIconSize(value: string): value is `${PartnerPwaIconSize}` {
  return value === '180' || value === '192' || value === '512'
}

export function partnerPwaManifestColor(value: unknown, fallback: string): string {
  const color = typeof value === 'string' ? value.trim() : ''
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback
}

export function partnerSitePwaStartUrl(siteSlug: string, customDomain: boolean): string {
  const home = partnerSiteHomePath(siteSlug, { customDomain })
  return customDomain || home.endsWith('/') ? home : `${home}/`
}

export function partnerSitePwaManifestPath(siteSlug: string, customDomain: boolean): string {
  if (customDomain) return '/manifest.webmanifest'
  return `/site/${encodeURIComponent(siteSlug.trim())}/manifest.webmanifest`
}

export function partnerSitePwaSwPath(siteSlug: string, customDomain: boolean): string {
  if (customDomain) return `/${PARTNER_SHOP_PWA_SW_PUBLIC_FILE}`
  return `/site/${encodeURIComponent(siteSlug.trim())}/sw.js`
}

export function partnerSitePwaIconPath(
  siteSlug: string,
  size: PartnerPwaIconSize,
  customDomain: boolean,
  opts?: { maskable?: boolean }
): string {
  const tail = `/pwa-icon/${size}${opts?.maskable ? '?purpose=maskable' : ''}`
  if (customDomain) return tail
  return `/site/${encodeURIComponent(siteSlug.trim())}${tail}`
}

export function partnerSitePwaScope(startUrl: string): string {
  return startUrl.endsWith('/') ? startUrl : `${startUrl}/`
}

export function buildPartnerShopWebManifest(input: {
  siteSlug: string
  name: string
  description?: string
  customDomain: boolean
  backgroundColor: unknown
  themeColor: unknown
  locale?: string
}): Record<string, unknown> {
  const name = input.name.trim() || 'Shop'
  const startUrl = partnerSitePwaStartUrl(input.siteSlug, input.customDomain)
  const slug = input.siteSlug.trim().toLowerCase()
  const icon = (size: 192 | 512, maskable: boolean) => ({
    src: partnerSitePwaIconPath(slug, size, input.customDomain, { maskable }),
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: maskable ? 'maskable' : 'any',
  })

  return {
    name,
    short_name: name.slice(0, 24),
    description: (input.description || name).trim() || name,
    id: `nanoai-shop:${slug}`,
    start_url: startUrl,
    scope: partnerSitePwaScope(startUrl),
    display: 'standalone',
    background_color: partnerPwaManifestColor(input.backgroundColor, '#ffffff'),
    theme_color: partnerPwaManifestColor(input.themeColor, '#111827'),
    lang: input.locale?.trim() || 'vi',
    prefer_related_applications: false,
    icons: [icon(192, false), icon(512, false), icon(192, true), icon(512, true)],
  }
}

export function buildPartnerShopServiceWorkerSource(input: {
  siteSlug: string
  startUrl: string
}): string {
  const slug = input.siteSlug.trim().toLowerCase()
  const cacheName = `pw-shop-shell-v3-${slug}`
  const home = input.startUrl
  return `
/* Partner shop SW — per-tenant shell (${slug}) */
const CACHE = ${JSON.stringify(cacheName)};
const SHELL = ${JSON.stringify(home)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('pw-shop-shell-') && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(SHELL).then((r) => r || Response.error()))
    );
  }
});
`.trim()
}
