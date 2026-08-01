import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchGuestWidgetUiLocaleForPartnerFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { resolveGuestExternalThreadIdFromCookies } from '@/lib/messaging/resolve-guest-external-thread-server'
import { Toaster } from '@/components/ui/toaster'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import { partnerGuestTrackingFromPartner } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { EmbedGuestChatViewport, guestChatEmbedPopupChrome } from '../../embed-guest-chat-viewport'
import { PartnerGuestChatClient } from '../../partner-guest-chat-client'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchGuestPurchaseConfigForPartnerFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { runMetaViewContentForConsultInventoryPage } from '@/lib/tracking/meta-view-content-consult-server'
import { parseVndAmountFromPriceHint } from '@/lib/tracking/parse-vnd-from-price-hint'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

function firstSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key]
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v ?? '').trim()
}

/** Mô tả meta ~150–160 ký tự: tên SP + đoạn mô tả kho (ưu tiên mô tả, ghi chú tư vấn). */
function buildConsultProductMetaDescription(input: {
  productName: string
  shopName: string
  description: string
  consultNote: string
  fallbackFromDictionary: string
}): string {
  const name = input.productName.trim() || 'Sản phẩm'
  const raw = [input.description, input.consultNote]
    .map((s) => String(s ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' — ')
  const snippet =
    raw.length > 155 ? `${raw.slice(0, 152).trim()}…` : raw
  if (snippet.length >= 24) {
    const out = `${name}. ${snippet} — ${input.shopName} · NanoAI`
    return out.length > 165 ? `${out.slice(0, 162)}…` : out
  }
  return input.fallbackFromDictionary.replace('{shop}', input.shopName)
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; inventoryId: string }>
}): Promise<Metadata> {
  const { slug, inventoryId } = await props.params
  const locale = getCurrentWebLocale()
  const g = getDictionary(locale).partnerGuestChat
  const path = `/messaging/p/${slug}/tu-van/${inventoryId}`

  if (isReservedMessagingGuestSlug(slug) || !UUID_RE.test(inventoryId.trim())) {
    return buildMetadata({
      title: g.notFoundTitle,
      description: g.notFoundDescription,
      path,
      noIndex: true,
      locale: OG_LOCALE[locale] ?? 'vi_VN',
    })
  }

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner || !isPgConfigured()) {
    return buildMetadata({
      title: g.notFoundTitle,
      description: g.notFoundDescription,
      path,
      noIndex: true,
      locale: OG_LOCALE[locale] ?? 'vi_VN',
    })
  }

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, inventoryId.trim())
  if (!row) {
    return buildMetadata({
      title: g.notFoundTitle,
      description: g.notFoundDescription,
      path,
      noIndex: true,
      locale: OG_LOCALE[locale] ?? 'vi_VN',
    })
  }

  const productName = (row.name ?? '').trim() || inventoryId.slice(0, 8)
  const title = `${productName} — ${partner.display_name}`
  const description = buildConsultProductMetaDescription({
    productName,
    shopName: partner.display_name,
    description: row.description ?? '',
    consultNote: row.consult_note ?? '',
    fallbackFromDictionary: g.metaDescription,
  })

  const rawImg = (row.image_url ?? '').trim()
  let ogImage: string | undefined
  if (rawImg && !/\s/.test(rawImg)) {
    if (/^https?:\/\//i.test(rawImg)) ogImage = rawImg
    else if (rawImg.startsWith('/')) ogImage = `${defaultPublicOrigin()}${rawImg}`
  }

  return buildMetadata({
    title,
    description,
    path,
    keywords: ['NanoAI', 'chat', 'tư vấn', productName, partner.display_name],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: true,
    ...(ogImage ? { ogImage } : {}),
  })
}

export default async function PartnerGuestConsultByInventoryPage(props: {
  params: Promise<{ slug: string; inventoryId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const { slug, inventoryId } = await props.params
  if (isReservedMessagingGuestSlug(slug)) notFound()
  if (!UUID_RE.test(inventoryId.trim())) notFound()

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) notFound()

  const row = isPgConfigured()
    ? await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, inventoryId.trim())
    : null
  if (!row) notFound()

  const user = await getUserOrBypass()
  const chatList =
    user?.id
      ? (
          await listWidgetChatsForLinkedUser(user.id, {
            accountEmailNormalized: user.email,
          })
        ).items
      : []

  const rawSp = props.searchParams
  const sp = rawSp
    ? await (rawSp instanceof Promise ? rawSp : Promise.resolve(rawSp))
    : {}
  const urlNorm = normalizeWebLocale(firstSearchParam(sp, 'ui_locale'))

  const cookieLocale = getCurrentWebLocale()
  let uiLocale: WebLocale = cookieLocale

  let dbNorm: WebLocale | null = null
  if (isPgConfigured()) {
    const extId = await resolveGuestExternalThreadIdFromCookies()
    const dbRaw = await fetchGuestWidgetUiLocaleForPartnerFromPg(partner.id, extId)
    dbNorm = normalizeWebLocale(dbRaw ?? '')
  }

  if (urlNorm) uiLocale = urlNorm
  else if (dbNorm) uiLocale = dbNorm
  const dict = getDictionary(uiLocale)
  const guestPurchaseConfig = await fetchGuestPurchaseConfigForPartnerFromPg(partner.id)

  const metaViewContent = isPgConfigured()
    ? await runMetaViewContentForConsultInventoryPage({
        partnerId: partner.id,
        inventoryRow: row,
        eventSourcePath: `/messaging/p/${slug}/tu-van/${inventoryId.trim()}`,
      })
    : null

  const imageUrl = (row.image_url ?? '').trim()
  const productUrl = (row.product_url ?? '').trim()
  const sku = (row.sku ?? '').trim()
  const remarketingId = (row.remarketing_id ?? '').trim()
  const ga4InitialViewItem = {
    itemId: sku || remarketingId || row.id,
    itemName: (row.name ?? '').trim() || sku || row.id,
    value: parseVndAmountFromPriceHint(row.price_hint),
  }

  const adsTracking = partnerGuestTrackingFromPartner(partner)

  const popupChrome = guestChatEmbedPopupChrome(sp)

  return (
    <>
      <Toaster />
      <PartnerSiteShopTrackingBootstrap tracking={adsTracking} />
      <EmbedGuestChatViewport popupChrome={popupChrome}>
        <PartnerGuestChatClient
          slug={slug}
          shopDisplayName={partner.display_name}
          uiLocale={uiLocale}
          t={dict.partnerGuestChat}
          toolT={dict.tool}
          orderDetailT={dict.messagingMyOrders}
          initialChatList={chatList}
          guestPurchaseFlow={guestPurchaseConfig.flow}
          guestExternalCartUrlTemplate={guestPurchaseConfig.externalCartUrlTemplate}
          consultFromInventory={{
            inventoryId: row.id,
            sku: sku || undefined,
            imageUrl: imageUrl || undefined,
            productUrl: productUrl || undefined,
          }}
          metaViewContent={metaViewContent}
          adsTracking={adsTracking}
          ga4InitialViewItem={ga4InitialViewItem}
        />
      </EmbedGuestChatViewport>
    </>
  )
}
