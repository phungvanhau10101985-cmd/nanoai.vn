import Link from 'next/link'
import type { Metadata } from 'next'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { isValidUuidString } from '@/lib/validate-uuid'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'
import { PartnerMessagingOrdersClient } from '../partner-messaging-orders-client'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getCurrentWebLocale()
  const o = getDictionary(locale).partnerMessagingOrders
  return buildMetadata({
    title: o.pageTitle,
    description: o.pageDescription,
    path: '/dashboard/messaging/orders',
    noIndex: true,
  })
}

export default async function DashboardMessagingOrdersPage() {
  const { t, locale } = getServerDictionary()
  const pm = t.partnerMessaging
  const o = t.partnerMessagingOrders
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) rows = fromPg.filter((p) => p.industry_key !== 'hotel')
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <ClipboardList className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
              {o.pageTitle}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{o.introLine}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/messaging">{pm.goToInbox}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/messaging/settings">{pm.messagingSettingsLink}</Link>
            </Button>
          </div>
        </div>
      </div>
      <PartnerMessagingOrdersClient initialPartners={rows ?? []} ordersT={o} locale={locale} />
    </div>
  )
}
