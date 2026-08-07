import type { Metadata } from 'next'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { isValidUuidString } from '@/lib/validate-uuid'
import { BarChart3 } from 'lucide-react'
import { PartnerMessagingAnalyticsClient } from '../partner-messaging-analytics-client'
import { MessagingDashboardNavLinks } from '../messaging-dashboard-nav-links'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getCurrentWebLocale()
  const a = getDictionary(locale).partnerMessagingAnalytics
  return buildMetadata({
    title: a.pageTitle,
    description: a.pageDescription,
    path: '/dashboard/messaging/analytics',
    noIndex: true,
  })
}

export default async function DashboardMessagingAnalyticsPage() {
  const { t, locale } = getServerDictionary()
  const pm = t.partnerMessaging
  const a = t.partnerMessagingAnalytics
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) rows = fromPg.filter((p) => p.industry_key !== 'hotel')
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-3 md:space-y-4">
      <div className="section-surface sticky top-[var(--site-header-height,3rem)] z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/95 pb-3 backdrop-blur-md md:top-[var(--site-header-height,3.5rem)] md:pb-4">
        <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <span className="leading-snug">{a.pageTitle}</span>
        </h1>
        <MessagingDashboardNavLinks
          inboxLabel={pm.goToInbox}
          settingsLabel={pm.messagingSettingsLink}
          ordersLabel={pm.messagingOrdersLink}
          analyticsLabel={pm.messagingAnalyticsLink}
          active="analytics"
        />
      </div>
      <PartnerMessagingAnalyticsClient initialPartners={rows ?? []} analyticsT={a} locale={locale} />
    </div>
  )
}
