import { fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerMessagingInboxClient } from './partner-messaging-inbox-client'
import { MessagingInboxScrollLock } from './messaging-inbox-scroll-lock'

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
    <MessagingInboxScrollLock>
      {/* Mobile: giảm padding shell để tối đa chiều cao vùng chat; desktop gần layout cũ */}
      <div className="mx-auto flex h-[calc(100dvh-4.25rem)] max-h-[100dvh] w-full max-w-7xl min-h-0 flex-col overflow-hidden px-2 pb-1 pt-2 sm:px-4 sm:pb-2 sm:pt-3 md:h-[calc(100dvh-4.75rem)] md:px-6 md:pb-3 md:pt-4 lg:px-8">
        <div className="flex min-h-0 flex-1 flex-col">
          <PartnerMessagingInboxClient initialPartners={rows ?? []} t={pm} />
        </div>
      </div>
    </MessagingInboxScrollLock>
  )
}
