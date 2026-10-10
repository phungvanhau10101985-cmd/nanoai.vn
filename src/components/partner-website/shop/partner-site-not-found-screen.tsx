import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PartnerSiteHomeRedirect } from '@/components/partner-website/shop/partner-site-home-redirect'
import {
  readPartnerCustomDomainFromHeaders,
  readPartnerSiteSlugFromHeaders,
  partnerSiteSlugFromPathname,
  readLoginNextFromHeaders,
} from '@/lib/auth/app-request-headers'
import { isShopCustomDomainHost } from '@/lib/messaging/partner-custom-domain-platform-host'
import { partnerWebsite404Copy } from '@/lib/partner-website/partner-website-system-pages'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerShopNotFoundHomePath } from '@/lib/partner-website/shop/partner-site-not-found'

function readShopNotFoundSlug(): { slug: string; customDomain: boolean } {
  const headerStore = headers()
  const customHost = readPartnerCustomDomainFromHeaders((name) => headerStore.get(name))
  const host =
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headerStore.get('host')?.split(',')[0]?.trim() ||
    ''
  const customDomain = Boolean(customHost) || isShopCustomDomainHost(host)
  const fromHeader = readPartnerSiteSlugFromHeaders((name) => headerStore.get(name))
  const path = readLoginNextFromHeaders((name) => headerStore.get(name)).split('?')[0] || ''
  const slug = fromHeader || partnerSiteSlugFromPathname(path)
  return { slug, customDomain }
}

/**
 * Next.js serializes every `not-found` element into the RSC payload of every page in its segment,
 * so this screen must stay tiny — no shop chrome shell. It only shows while redirecting home.
 */
export async function PartnerSiteNotFoundScreen({ slug: slugProp }: { slug?: string } = {}) {
  const resolved = readShopNotFoundSlug()
  const slug = (slugProp || resolved.slug).trim()
  const customDomain = resolved.customDomain
  if (!slug) {
    redirect('/')
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    redirect('/')
  }

  const homeHref = partnerShopNotFoundHomePath(shop.site.siteSlug, customDomain)
  const copy = partnerWebsite404Copy(shop.site.locale)
  const theme = shop.site.theme
  const logoUrl = theme?.logoUrl || shop.site.logoUrl || ''
  const text = theme?.textColor || '#1a1a1a'
  const muted = theme?.mutedColor || '#6b7280'
  const buy = theme?.buyButtonColor || theme?.primaryColor || '#ff3333'

  return (
    <>
      <PartnerSiteHomeRedirect href={homeHref} />
      <main
        lang={shop.site.locale || 'vi'}
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 16px',
          textAlign: 'center',
          background: theme?.backgroundColor || '#f5f5f5',
          color: text,
          fontFamily: theme?.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ width: 'min(440px, 100%)' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={shop.site.title || ''}
              style={{ display: 'block', margin: '0 auto 20px', maxHeight: 56, maxWidth: 180, objectFit: 'contain' }}
            />
          ) : null}
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: muted }}>
            {copy.codeLabel}
          </p>
          <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(1.35rem, 2.4vw, 1.7rem)', lineHeight: 1.25, color: text }}>
            {copy.heading}
          </h1>
          <p style={{ margin: '0 0 22px', color: muted, fontSize: '0.98rem', lineHeight: 1.55 }}>{copy.body}</p>
          <a
            href={homeHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 999,
              background: buy,
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            {copy.homeCta}
          </a>
        </div>
      </main>
    </>
  )
}
