import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PartnerSiteNotFoundScreen } from '@/components/partner-website/shop/partner-site-not-found-screen'
import {
  partnerSiteSlugFromPathname,
  readLoginNextFromHeaders,
  readPartnerCustomDomainFromHeaders,
  readPartnerSiteSlugFromHeaders,
} from '@/lib/auth/app-request-headers'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { isShopCustomDomainHost } from '@/lib/messaging/partner-custom-domain-platform-host'
import { partnerWebsite404Copy } from '@/lib/partner-website/partner-website-system-pages'

export const dynamic = 'force-dynamic'

export default function RootNotFound() {
  const headerStore = headers()
  const customHost = readPartnerCustomDomainFromHeaders((name) => headerStore.get(name))
  const host =
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headerStore.get('host')?.split(',')[0]?.trim() ||
    ''
  const path = readLoginNextFromHeaders((name) => headerStore.get(name)).split('?')[0] || ''
  const slug =
    readPartnerSiteSlugFromHeaders((name) => headerStore.get(name)) ||
    partnerSiteSlugFromPathname(path)
  const onShopHost = Boolean(customHost) || isShopCustomDomainHost(host)

  if (slug) {
    return <PartnerSiteNotFoundScreen slug={slug} />
  }
  if (onShopHost) {
    redirect('/')
  }

  const copy = partnerWebsite404Copy(getCurrentWebLocale())

  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div>
        <p style={{ margin: '0 0 8px', fontWeight: 700, letterSpacing: '0.12em' }}>{copy.codeLabel}</p>
        <h1 style={{ margin: '0 0 12px', fontSize: '1.5rem' }}>{copy.heading}</h1>
        <a href="/" style={{ color: 'inherit' }}>
          {copy.homeCta}
        </a>
      </div>
    </main>
  )
}
