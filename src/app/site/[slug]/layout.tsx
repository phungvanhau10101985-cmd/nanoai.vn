import { Fraunces, Outfit } from 'next/font/google'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { PartnerSiteCustomDomainProvider } from '@/lib/partner-website/shop/partner-site-custom-domain-context'

const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--pw-font-display',
  display: 'swap',
})

const ui = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pw-font-ui',
  display: 'swap',
})

export default function PartnerSiteSlugLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))

  return (
    <PartnerSiteCustomDomainProvider active={onCustomDomain}>
      <div className={`${display.variable} ${ui.variable}`}>{children}</div>
    </PartnerSiteCustomDomainProvider>
  )
}
