import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { fetchMessagingPartnerByIdFromPg, fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerMessagingSettingsClient } from '../partner-messaging-settings-client'
import { MessagingDashboardNavLinks } from '../messaging-dashboard-nav-links'
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
  const partnerIdForNav =
    partnerParam && isValidUuidString(String(partnerParam).trim()) ? String(partnerParam).trim() : undefined
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
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-3 py-0 sm:py-0 md:space-y-3 lg:py-0 xl:py-0">
      <div className="sticky top-[var(--site-header-height,3rem)] z-40 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur-md sm:px-4 md:top-[var(--site-header-height,3.5rem)]">
        <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
            <Settings className="h-4 w-4" aria-hidden />
          </span>
          <span className="leading-snug">{pm.messagingSettingsPageTitle}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <MessagingDashboardNavLinks
            inboxLabel={pm.goToInbox}
            settingsLabel={pm.messagingSettingsLink}
            ordersLabel={pm.messagingOrdersLink}
            analyticsLabel={pm.messagingAnalyticsLink}
            active="settings"
            partnerId={partnerIdForNav}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">{t.menu.dashboard}</Link>
          </Button>
        </div>
      </div>
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
