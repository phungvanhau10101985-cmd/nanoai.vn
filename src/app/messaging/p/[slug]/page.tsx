import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { WebLocale } from '@/lib/i18n/config'
import { Toaster } from '@/components/ui/toaster'
import { PartnerGuestChatClient } from './partner-guest-chat-client'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

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

  const db = createServiceRoleClient()
  const { data: partner } = await db
    .from('messaging_partners')
    .select('display_name, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (!partner?.is_active) {
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

export default async function PartnerGuestChatPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { slug } = await props.params
  const search = await props.searchParams
  const requestHeaders = headers()
  const isIframeRequest = requestHeaders.get('sec-fetch-dest') === 'iframe'
  if (isReservedMessagingGuestSlug(slug)) notFound()

  const db = createServiceRoleClient()
  const { data: partner } = await db
    .from('messaging_partners')
    .select('display_name, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (!partner?.is_active) notFound()

  const { t } = getServerDictionary()

  return (
    <>
      <Toaster />
      <PartnerGuestChatClient
        slug={slug}
        shopDisplayName={partner.display_name}
        t={t.partnerGuestChat}
        isEmbedded={isIframeRequest || String(search.embed || '') === '1'}
      />
    </>
  )
}
