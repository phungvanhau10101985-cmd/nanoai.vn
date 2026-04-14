import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { WebLocale } from '@/lib/i18n/config'
import { Toaster } from '@/components/ui/toaster'
import { PartnerGuestChatClient } from './partner-guest-chat-client'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchGuestPurchaseFlowForPartnerFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const locale = getCurrentWebLocale()
  const { t } = getServerDictionary()
  const g = t.partnerGuestChat
  const path = `/messaging/p/${slug}`

  if (isReservedMessagingGuestSlug(slug)) {
    return buildMetadata({
      title: g.notFoundTitle,
      description: g.notFoundDescription,
      path,
      noIndex: true,
      locale: OG_LOCALE[locale] ?? 'vi_VN',
    })
  }

  const partner = await resolveActiveMessagingPartnerBySlug(slug)

  if (!partner) {
    return buildMetadata({
      title: g.notFoundTitle,
      description: g.notFoundDescription,
      path,
      noIndex: true,
      locale: OG_LOCALE[locale] ?? 'vi_VN',
    })
  }

  const title = `${partner.display_name} — ${g.pageTitleSuffix}`
  const description = g.metaDescription.replace('{shop}', partner.display_name)

  return buildMetadata({
    title,
    description,
    path,
    keywords: ['NanoAI', 'chat', 'customer', partner.display_name],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: true,
  })
}

export default async function PartnerGuestChatPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (isReservedMessagingGuestSlug(slug)) notFound()

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) notFound()

  const user = await getUserOrBypass()
  const chatList =
    user?.id
      ? (
          await listWidgetChatsForLinkedUser(user.id, {
            accountEmailNormalized: user.email,
          })
        ).items
      : []

  const { t } = getServerDictionary()
  const guestPurchaseFlow = await fetchGuestPurchaseFlowForPartnerFromPg(partner.id)

  const uiLocale = getCurrentWebLocale()

  return (
    <>
      <Toaster />
      <PartnerGuestChatClient
        slug={slug}
        shopDisplayName={partner.display_name}
        uiLocale={uiLocale}
        t={t.partnerGuestChat}
        orderDetailT={t.messagingMyOrders}
        initialChatList={chatList}
        guestPurchaseFlow={guestPurchaseFlow}
      />
    </>
  )
}
