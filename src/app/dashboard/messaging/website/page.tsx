import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PartnerWebsiteDashboardClient } from './partner-website-dashboard-client'
import { PartnerWebsiteDashboardShell } from '@/components/partner-website/partner-website-dashboard-shell'
import { loadPartnerWebsiteDashboardData } from '@/lib/partner-website/load-partner-website-dashboard'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getServerDictionary()
  const copy = t.partnerMessaging
  return buildMetadata({
    title: copy.messagingWebsiteLink,
    description: copy.pageDescription,
    path: '/dashboard/messaging/website',
    noIndex: true,
  })
}

export default async function DashboardPartnerWebsitePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const locale = await getCurrentWebLocale()
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  const pw = getPartnerWebsiteCopy(locale)
  const sp = searchParams ? await searchParams : {}
  const partnerRaw = sp?.partner
  const requestedPartner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw
  const requestedPartnerId = isValidUuidString(String(requestedPartner ?? '').trim())
    ? String(requestedPartner).trim()
    : ''

  const data = await loadPartnerWebsiteDashboardData({
    userId: user.id,
    locale,
    requestedPartnerId,
  })

  if (requestedPartnerId) {
    const match = data.partners.find((p) => p.id === requestedPartnerId)
    if (match?.slug) {
      redirect(partnerWebsiteDashboardPath(match.slug))
    }
  }

  if (data.partners.length === 1 && data.partners[0]?.slug) {
    redirect(partnerWebsiteDashboardPath(data.partners[0].slug))
  }

  const activePartner = data.partners.find((p) => p.id === data.initialPartnerId)

  return (
    <PartnerWebsiteDashboardShell
      title={pm.messagingWebsiteLink}
      description={pw.pageDescription}
      inboxLabel={pm.goToInbox}
      settingsLabel={pm.messagingSettingsLink}
      ordersLabel={pm.messagingOrdersLink}
      partnerId={activePartner?.id}
    >
      <PartnerWebsiteDashboardClient
        locale={locale}
        partners={data.partners}
        hadPartnersWithoutWebsitePerm={data.allPartners.length > 0 && data.partners.length === 0}
        initialWebsites={data.initialWebsites}
        initialPartnerId={data.initialPartnerId}
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
