import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { Building2 } from 'lucide-react'
import { BusinessChannelsHubClient } from './business-channels-hub-client'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  return buildMetadata({
    title: pm.pageTitle,
    description: pm.messagingInboxDescription,
    path: '/dashboard/messaging',
    noIndex: true,
  })
}

export default async function DashboardMessagingPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) rows = fromPg
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <div className="section-surface space-y-1.5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Building2 className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
          Kênh kinh doanh
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Chọn kênh để đi vào quản lý chính. Mỗi kênh vận hành độc lập theo lĩnh vực kinh doanh.
        </p>
      </div>
      <div className="section-surface">
        <div className="mx-auto w-full max-w-7xl">
          <BusinessChannelsHubClient partners={rows ?? []} />
        </div>
      </div>
    </div>
  )
}
