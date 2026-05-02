import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
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
import { PartnerGuestGa4Config } from './partner-guest-ga4-config'
import { EmbedGuestChatViewport, guestChatEmbedPopupChrome } from './embed-guest-chat-viewport'
import { PartnerGuestChatClient } from './partner-guest-chat-client'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchGuestPurchaseFlowForPartnerFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { runMetaViewContentForConsultInventoryPage } from '@/lib/tracking/meta-view-content-consult-server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function searchParamsToQueryString(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, raw] of Object.entries(sp)) {
    if (raw === undefined) continue
    const v = Array.isArray(raw) ? raw[0] : raw
    const s = v != null ? String(v).trim() : ''
    if (s) q.set(k, s)
  }
  const t = q.toString()
  return t ? `?${t}` : ''
}

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

function firstSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key]
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v ?? '').trim()
}

export default async function PartnerGuestChatPage(props: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const { slug } = await props.params
  if (isReservedMessagingGuestSlug(slug)) notFound()

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) notFound()

  const rawSpForRedirect = props.searchParams
  const spEarly = rawSpForRedirect
    ? await (rawSpForRedirect instanceof Promise ? rawSpForRedirect : Promise.resolve(rawSpForRedirect))
    : {}

  // Hotel partners ALWAYS render on the dedicated hospitality page — the
  // fashion messaging UI (try-on, product consult, orders) is irrelevant and
  // must never leak onto a hotel workspace.
  if (partner.industry_key === 'hotel') {
    const qs = searchParamsToQueryString(spEarly)
    redirect(`/hospitality/p/${slug}${qs}`)
  }

  const user = await getUserOrBypass()
  const chatList =
    user?.id
      ? (
          await listWidgetChatsForLinkedUser(user.id, {
            accountEmailNormalized: user.email,
          })
        ).items
      : []

  const sp = spEarly
  const urlNorm = normalizeWebLocale(firstSearchParam(sp, 'ui_locale'))

  const cookieLocale = getCurrentWebLocale()
  let uiLocale: WebLocale = cookieLocale

  let dbNorm: WebLocale | null = null
  if (isPgConfigured()) {
    const extId = await resolveGuestExternalThreadIdFromCookies()
    const dbRaw = await fetchGuestWidgetUiLocaleForPartnerFromPg(partner.id, extId)
    dbNorm = normalizeWebLocale(dbRaw ?? '')
  }

  /** Trong iframe site khách, cookie locale thường không tin cậy — ưu tiên `?ui_locale=` rồi DB rồi cookie. */
  if (urlNorm) uiLocale = urlNorm
  else if (dbNorm) uiLocale = dbNorm
  const dict = getDictionary(uiLocale)
  const guestPurchaseFlow = await fetchGuestPurchaseFlowForPartnerFromPg(partner.id)

  const ctxInventory = firstSearchParam(sp, 'ctx_inventory')
  let metaViewContent = null
  if (isPgConfigured() && UUID_RE.test(ctxInventory)) {
    const inv = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, ctxInventory)
    if (inv) {
      metaViewContent = await runMetaViewContentForConsultInventoryPage({
        partnerId: partner.id,
        inventoryRow: inv,
        eventSourcePath: `/messaging/p/${slug}${searchParamsToQueryString(sp)}`,
      })
    }
  }

  const popupChrome = guestChatEmbedPopupChrome(sp)

  return (
    <>
      <Toaster />
      <PartnerGuestGa4Config measurementId={partner.ga4_measurement_id} />
      <EmbedGuestChatViewport popupChrome={popupChrome}>
        <PartnerGuestChatClient
          slug={slug}
          shopDisplayName={partner.display_name}
          uiLocale={uiLocale}
          t={dict.partnerGuestChat}
          orderDetailT={dict.messagingMyOrders}
          initialChatList={chatList}
          guestPurchaseFlow={guestPurchaseFlow}
          metaViewContent={metaViewContent}
        />
      </EmbedGuestChatViewport>
    </>
  )
}
