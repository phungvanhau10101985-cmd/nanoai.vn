import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PartnerSiteHomeRedirect } from '@/components/partner-website/shop/partner-site-home-redirect'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import {
  readPartnerCustomDomainFromHeaders,
  readPartnerSiteSlugFromHeaders,
  partnerSiteSlugFromPathname,
  readLoginNextFromHeaders,
} from '@/lib/auth/app-request-headers'
import { isShopCustomDomainHost } from '@/lib/messaging/partner-custom-domain-platform-host'
import { partnerWebsite404Copy } from '@/lib/partner-website/partner-website-system-pages'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerShopNotFoundHomePath } from '@/lib/partner-website/shop/partner-site-not-found'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

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
  const device = inferLiveVisualRequestDevice()

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      pageKind={PW_PAGE.home}
      activeNav="home"
      hideAccountNav
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <PartnerSiteHomeRedirect href={homeHref} />
      <main
        style={{
          minHeight: '48vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 16px 88px',
          textAlign: 'center',
        }}
      >
        <div style={{ width: 'min(440px, 100%)' }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'var(--pw-muted)',
            }}
          >
            {copy.codeLabel}
          </p>
          <h1
            style={{
              margin: '0 0 10px',
              fontSize: 'clamp(1.35rem, 2.4vw, 1.7rem)',
              lineHeight: 1.25,
              color: 'var(--pw-text)',
            }}
          >
            {copy.heading}
          </h1>
          <p
            style={{
              margin: '0 0 22px',
              color: 'var(--pw-muted)',
              fontSize: '0.98rem',
              lineHeight: 1.55,
            }}
          >
            {copy.body}
          </p>
          <a
            href={homeHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 999,
              background: 'var(--pw-buy)',
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
    </PartnerSiteShopShell>
  )
}
