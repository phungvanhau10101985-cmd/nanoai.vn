import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { fetchMessagingPartnerByIdFromPg, fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerMessagingSettingsClient } from '../partner-messaging-settings-client'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { resolveDeepSeekChatModel } from '@/lib/deepseek-api'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  return buildMetadata({
    title: pm.messagingSettingsPageTitle,
    description: pm.pageDescription,
    path: '/dashboard/messaging/settings',
    noIndex: true,
  })
}

export default async function DashboardMessagingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, t } = getServerDictionary()
  const pm = t.partnerMessaging
  const pmAi = t.partnerMessagingAi
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const sp = searchParams ? await searchParams : {}
  const partnerParamRaw = sp?.partner
  const partnerParam = Array.isArray(partnerParamRaw) ? partnerParamRaw[0] : partnerParamRaw
  if (partnerParam && isValidUuidString(String(partnerParam).trim()) && isPgConfigured()) {
    const info = await fetchMessagingPartnerByIdFromPg(String(partnerParam).trim())
    // Hotel partners have their own hospitality settings (rooms, AI concierge,
    // reports) — we never render fashion inventory/FAQ on them.
    if (info?.industry_key === 'hotel') {
      redirect(`/dashboard/hospitality/settings?partner=${encodeURIComponent(String(partnerParam).trim())}`)
    }
  }

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) rows = fromPg.filter((p) => p.industry_key !== 'hotel')
  }

  const partnerAiLlmModel = resolveDeepSeekChatModel()
  const appOrigin = getPublicOriginFromAppRouterHeaders(headers())

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col py-0">
      <PartnerMessagingSettingsClient
        initialPartners={rows ?? []}
        locale={locale}
        t={pm}
        tAi={pmAi}
        partnerAiLlmModel={partnerAiLlmModel}
        appOrigin={appOrigin}
      />
    </div>
  )
}
