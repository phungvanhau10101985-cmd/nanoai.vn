import Link from 'next/link'
import type { Metadata } from 'next'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { isValidUuidString } from '@/lib/validate-uuid'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { ClipboardList } from 'lucide-react'
import { PartnerMessagingOrdersClient } from '../partner-messaging-orders-client'

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Quan ly don hang chat',
    description: 'Danh sach don hang duoc tao trong widget chat.',
    path: '/dashboard/messaging/orders',
    noIndex: true,
  })
}

export default async function DashboardMessagingOrdersPage() {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersByOwnerFromPg>>> = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersByOwnerFromPg(user.id)
    if (fromPg !== null) rows = fromPg
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <Toaster />
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <ClipboardList className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
              Quan ly don hang chat
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Theo doi don da tao trong khung chat, xac nhan thu cong khi can va cap nhat trang thai.
            </p>
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
      <PartnerMessagingOrdersClient initialPartners={rows ?? []} />
    </div>
  )
}
