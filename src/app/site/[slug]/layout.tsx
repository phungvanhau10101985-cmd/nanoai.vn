import type { Metadata } from 'next'
import { Fraunces, Outfit } from 'next/font/google'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { PartnerSiteCustomDomainProvider } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'

const display = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '700', '800'],
  variable: '--pw-font-display',
  display: 'swap',
})

const ui = Outfit({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pw-font-ui',
  display: 'swap',
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  if (!site?.logoUrl) return {}

  return {
    icons: {
      icon: [{ url: site.logoUrl }],
      shortcut: [{ url: site.logoUrl }],
      apple: [{ url: site.logoUrl }],
    },
  }
}

export default function PartnerSiteSlugLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))

  return (
    <PartnerSiteCustomDomainProvider active={onCustomDomain}>
      <div className={`${display.variable} ${ui.variable}`}>{children}</div>
    </PartnerSiteCustomDomainProvider>
  )
}
