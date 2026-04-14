import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchGuestWidgetUiLocaleForPartnerFromPg } from '@/lib/db/customer-care-pg'
import { resolveGuestExternalThreadIdFromCookies } from '@/lib/messaging/resolve-guest-external-thread-server'
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
  const g = getDictionary(locale).partnerGuestChat
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

  const cookieLocale = getCurrentWebLocale()
  let uiLocale: WebLocale = cookieLocale
  if (isPgConfigured()) {
    const extId = await resolveGuestExternalThreadIdFromCookies()
    const dbRaw = await fetchGuestWidgetUiLocaleForPartnerFromPg(partner.id, extId)
    const dbNorm = normalizeWebLocale(dbRaw ?? '')
    if (dbNorm) uiLocale = dbNorm
  }
  const dict = getDictionary(uiLocale)
  const guestPurchaseFlow = await fetchGuestPurchaseFlowForPartnerFromPg(partner.id)

  return (
    <>
      <Toaster />
      <PartnerGuestChatClient
        slug={slug}
        shopDisplayName={partner.display_name}
        uiLocale={uiLocale}
        t={dict.partnerGuestChat}
        orderDetailT={dict.messagingMyOrders}
        initialChatList={chatList}
        guestPurchaseFlow={guestPurchaseFlow}
      />
    </>
  )
}
