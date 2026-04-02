import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { WebLocale } from '@/lib/i18n/config'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { Toaster } from '@/components/ui/toaster'
import { MyMessagingChatsClient } from './my-messaging-chats-client'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

const PATH = '/messaging/my-chats'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getCurrentWebLocale()
  const { t } = getServerDictionary()
  const m = t.messagingMyChats
  return buildMetadata({
    title: m.pageTitle,
    description: m.pageDescription,
    path: PATH,
    noIndex: true,
    locale: OG_LOCALE[locale] ?? 'vi_VN',
  })
}

export default async function MyMessagingChatsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    redirect(`/auth/login?next=${encodeURIComponent(sanitizeLoginNext(PATH))}`)
  }

  const db = createServiceRoleClient()
  const { items, error } = await listWidgetChatsForLinkedUser(db, user.id)

  const { t } = getServerDictionary()

  if (error) {
    return (
      <>
        <Toaster />
        <MyMessagingChatsClient t={t.messagingMyChats} initialError={error} initialItems={[]} />
      </>
    )
  }

  return (
    <>
      <Toaster />
      <MyMessagingChatsClient t={t.messagingMyChats} initialItems={items} />
    </>
  )
}
