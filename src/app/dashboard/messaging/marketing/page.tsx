import Link from 'next/link'
import type { Metadata } from 'next'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { isValidUuidString } from '@/lib/validate-uuid'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { isMarketingEligibleIndustry } from '@/lib/messaging/partner-marketing-segment'
import { PartnerMarketingCampaignsClient } from '../partner-marketing-campaigns-client'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getServerDictionary()
  const m = t.partnerMessagingMarketing
  return buildMetadata({
    title: m.pageTitle,
    description: m.pageDescription,
    path: '/dashboard/messaging/marketing',
    noIndex: true,
  })
}

export default async function DashboardMessagingMarketingPage() {
  const { t, locale } = getServerDictionary()
  const pm = t.partnerMessaging
  const m = t.partnerMessagingMarketing
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) rows = fromPg.filter((p) => isMarketingEligibleIndustry(p.industry_key))
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-3 md:space-y-4">
      <div className="section-surface flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 md:pb-4">
        <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
            <Megaphone className="h-4 w-4" aria-hidden />
          </span>
          <span className="leading-snug">{m.pageTitle}</span>
        </h1>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/messaging">{pm.goToInbox}</Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/messaging/settings">{pm.messagingSettingsLink}</Link>
          </Button>
        </div>
      </div>
      <PartnerMarketingCampaignsClient
        initialPartners={rows ?? []}
        marketingT={m}
        locale={locale}
      />
    </div>
  )
}
