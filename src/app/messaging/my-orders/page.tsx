import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { linkWidgetConversationsByGuestAccountEmailFromPg } from '@/lib/db/customer-care-pg'
import { fetchWidgetOrdersForLinkedUserFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { WebLocale } from '@/lib/i18n/config'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { Toaster } from '@/components/ui/toaster'
import { MyMessagingOrdersClient } from './my-messaging-orders-client'

const PATH = '/messaging/my-orders'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = getCurrentWebLocale()
  const { t } = getServerDictionary()
  const m = t.messagingMyOrders
  return buildMetadata({
    title: m.pageTitle,
    description: m.pageDescription,
    path: PATH,
    noIndex: true,
    locale: OG_LOCALE[locale] ?? 'vi_VN',
  })
}

export default async function MyMessagingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const user = await getUserOrBypass()
  if (!user?.id) {
    redirect(`/auth/login?next=${encodeURIComponent(sanitizeLoginNext(PATH))}`)
  }

  const sp = await searchParams
  const highlightOrderId = typeof sp?.order === 'string' ? sp.order.trim() : ''

  const email = String(user.email ?? '')
    .trim()
    .toLowerCase()
  if (email) {
    await linkWidgetConversationsByGuestAccountEmailFromPg(user.id, email)
  }
  const orders = await fetchWidgetOrdersForLinkedUserFromPg(user.id)
  const { t } = getServerDictionary()

  if (orders === null) {
    return (
      <>
        <Toaster />
        <MyMessagingOrdersClient
          t={t.messagingMyOrders}
          initialOrders={[]}
          initialError={t.messagingMyOrders.loadFailed}
          highlightOrderId={highlightOrderId}
        />
      </>
    )
  }

  return (
    <>
      <Toaster />
      <MyMessagingOrdersClient
        t={t.messagingMyOrders}
        initialOrders={orders}
        highlightOrderId={highlightOrderId}
      />
    </>
  )
}
