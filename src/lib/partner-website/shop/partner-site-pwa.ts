import { partnerSiteHomePath } from './partner-site-shop-paths'

/** Public SW filename on a shop custom domain — must not collide with NanoAI `public/sw.js`. */
export const PARTNER_SHOP_PWA_SW_PUBLIC_FILE = 'pw-shop-sw.js'

export const PARTNER_PWA_ICON_SIZES = [32, 180, 192, 512] as const
export type PartnerPwaIconSize = (typeof PARTNER_PWA_ICON_SIZES)[number]

export function isPartnerPwaIconSize(value: string): value is `${PartnerPwaIconSize}` {
  return value === '32' || value === '180' || value === '192' || value === '512'
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
  customDomain?: boolean
  inboxPath?: string
  iconPath?: string
}): string {
  const slug = input.siteSlug.trim().toLowerCase()
  const cacheName = `pw-shop-shell-v4-${slug}`
  const home = input.startUrl
  const customDomain = Boolean(input.customDomain)
  const inbox =
    input.inboxPath?.trim() ||
    (customDomain ? '/account/notifications' : `/site/${encodeURIComponent(slug)}/account/notifications`)
  const icon = input.iconPath?.trim() || partnerSitePwaIconPath(slug, 192, customDomain)
  return `
/* Partner shop SW — per-tenant shell + Web Push (${slug}) */
const CACHE = ${JSON.stringify(cacheName)};
const SHELL = ${JSON.stringify(home)};
const INBOX = ${JSON.stringify(inbox)};
const ICON = ${JSON.stringify(icon)};

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

self.addEventListener('push', function (event) {
  var data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    try {
      var t = event.data && event.data.text();
      if (t) data = JSON.parse(t);
    } catch (e2) {}
  }
  var title = data.title || 'Shop';
  var body = data.body || '';
  var urlPath = data.url || INBOX;
  var origin = self.location.origin;
  var openUrl = urlPath.indexOf('http') === 0 ? urlPath : origin + (urlPath.charAt(0) === '/' ? urlPath : '/' + urlPath);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: ICON,
      tag: data.tag || 'pw-shop',
      renotify: !!data.renotify,
      data: { url: openUrl },
    }).then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        clients.forEach(function (c) {
          try { c.postMessage({ type: 'PW_SHOP_NOTIFICATIONS_REFRESH' }); } catch (e3) {}
        });
      });
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var raw = (event.notification.data && event.notification.data.url) || (self.location.origin + INBOX);
  var urlToOpen = raw.indexOf('http') === 0 ? raw : self.location.origin + (raw.charAt(0) === '/' ? raw : '/' + raw);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          return client.focus().then(function () {
            if ('navigate' in client) {
              try { return client.navigate(urlToOpen); } catch (e) {}
            }
            return self.clients.openWindow(urlToOpen);
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});
`.trim()
}
