import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PartnerWebsiteDashboardClient } from '@/app/dashboard/messaging/website/partner-website-dashboard-client'
import { PartnerWebsiteDashboardShell } from '@/components/partner-website/partner-website-dashboard-shell'
import { loadPartnerWebsiteDashboardData } from '@/lib/partner-website/load-partner-website-dashboard'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { t } = getServerDictionary()
  const copy = t.partnerMessaging
  return buildMetadata({
    title: copy.messagingWebsiteLink,
    description: copy.pageDescription,
    path: partnerWebsiteDashboardPath(slug),
    noIndex: true,
  })
}

export default async function PartnerSlugWebsiteDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const { slug } = await params
  const partnerSlug = slug.trim()
  if (!partnerSlug) notFound()

  const locale = await getCurrentWebLocale()
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  const pw = getPartnerWebsiteCopy(locale)

  const data = await loadPartnerWebsiteDashboardData({
    userId: user.id,
    locale,
    requestedSlug: partnerSlug,
  })

  const partner = data.partners.find((p) => p.slug.toLowerCase() === partnerSlug.toLowerCase())
  if (!partner) notFound()

  return (
    <PartnerWebsiteDashboardShell
      title={pm.messagingWebsiteLink}
      description={pw.pageDescription}
      inboxLabel={pm.goToInbox}
      settingsLabel={pm.messagingSettingsLink}
      ordersLabel={pm.messagingOrdersLink}
      partnerId={partner.id}
    >
      <PartnerWebsiteDashboardClient
        locale={locale}
        partners={data.partners}
        hadPartnersWithoutWebsitePerm={data.allPartners.length > 0 && data.partners.length === 0}
        initialWebsites={data.initialWebsites}
        initialPartnerId={partner.id}
        hidePartnerPicker
        lockedPartnerSlug={partner.slug}
        navLabels={{
          inbox: pm.goToInbox,
          orders: pm.messagingOrdersLink,
          marketing: pm.marketingCampaignsLink,
          settings: pm.messagingSettingsLink,
          website: pm.messagingWebsiteLink,
        }}
      />
    </PartnerWebsiteDashboardShell>
  )
}
