import type { NextRequest } from 'next/server'
import {
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  type MessagingPartnerInventoryRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import { fetchMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'
import {
  appendPartnerVisitorEventInventoryIdsFromPg,
  fetchPartnerVisitorPersonalizationFromPg,
  mutatePartnerVisitorFavoriteFromPg,
  upsertPartnerVisitorRecentlyViewedFromPg,
  upsertPartnerVisitorUtmContextFromPg,
  type PartnerVisitorUtmContext,
} from '@/lib/db/messaging-partner-visitor-personalization-pg'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  getCustomerDeliveryProfile,
  listRelatedBuyProducts,
  type RelatedBuyProduct,
} from '@/lib/messaging/guest-chat-ordering'
import { headlessAccountKey } from '@/lib/messaging/partner-headless-cart-utils'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerSitePersonalizationProduct = {
  inventory_id: string
  name: string
  price_hint: string
  image_url: string
  product_url: string
  detail_path: string
  sku: string | null
}

export type PartnerSiteVisitorProfile = {
  greeting_name: string | null
  customer_name: string | null
  customer_phone: string | null
  shipping_address: string | null
  auth_mode: 'anonymous' | 'guest_account' | 'linked_user'
  utm: PartnerVisitorUtmContext
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function visitorAccountKeyFromThread(
  thread: Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>
): string | null {
  if (!thread) return null
  return (thread.guestAccountId || thread.linkedUserId || thread.externalThreadId || '').trim() || null
}

export async function resolveSiteVisitorContext(
  request: NextRequest,
  partnerId: string
): Promise<{
  accountKey: string
  thread: NonNullable<Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>>
  sessionId: string | null
}> {
  let thread = await resolveWidgetOrderThreadFromRequest(request, partnerId)
  let sessionId = readGuestSessionIdFromRequestStrictOrLoose(request)

  if (!thread) {
    if (!sessionId || !isValidMessagingGuestSessionId(sessionId)) {
      sessionId = createGuestSessionId()
    }
    thread = {
      externalThreadId: sessionId,
      linkedUserId: null,
      guestAccountId: null,
      anonymousSessionId: null,
    }
  }

  const accountKey = visitorAccountKeyFromThread(thread)!
  return { accountKey, thread, sessionId }
}

export function parsePersonalizationUtm(raw: unknown): PartnerVisitorUtmContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const pick = (k: keyof PartnerVisitorUtmContext) => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined
  }
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
    utm_term: pick('utm_term'),
  }
}

export function mapInventoryRowToPersonalizationProduct(
  siteSlug: string,
  row: MessagingPartnerInventoryRow
): PartnerSitePersonalizationProduct | null {
  const imageUrl = (row.image_url ?? '').trim()
  const productUrl = (row.product_url ?? '').trim()
  if (!/^https?:\/\//i.test(imageUrl) || !/^https?:\/\//i.test(productUrl)) return null
  return {
    inventory_id: row.id,
    name: (row.name ?? '').trim() || 'Product',
    price_hint: (row.price_hint ?? '').trim(),
    image_url: imageUrl,
    product_url: productUrl,
    detail_path: partnerSiteProductPath(siteSlug, row.id),
    sku: (row.sku ?? '').trim() || null,
  }
}

function relatedToPersonalizationProduct(
  siteSlug: string,
  item: RelatedBuyProduct
): PartnerSitePersonalizationProduct | null {
  const imageUrl = item.image_url.trim()
  const productUrl = item.product_url.trim()
  if (!/^https?:\/\//i.test(imageUrl) || !/^https?:\/\//i.test(productUrl)) return null
  const inventoryId = item.inventory_id?.trim() ?? ''
  return {
    inventory_id: inventoryId || productUrl,
    name: item.name.trim() || 'Product',
    price_hint: item.price_hint?.trim() ?? '',
    image_url: imageUrl,
    product_url: productUrl,
    detail_path: inventoryId && UUID_RE.test(inventoryId) ? partnerSiteProductPath(siteSlug, inventoryId) : '',
    sku: item.sku?.trim() || null,
  }
}

async function loadProductsByIds(
  partnerId: string,
  siteSlug: string,
  ids: string[]
): Promise<PartnerSitePersonalizationProduct[]> {
  const out: PartnerSitePersonalizationProduct[] = []
  for (const id of ids) {
    if (!UUID_RE.test(id)) continue
    const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, id)
    if (!row) continue
    const mapped = mapInventoryRowToPersonalizationProduct(siteSlug, row)
    if (mapped) out.push(mapped)
  }
  return out
}

export async function getSiteRecentlyViewedProducts(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  limit?: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const lim = Math.max(1, Math.min(24, Math.floor(Number(input.limit) || 8)))
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const ids = state?.recently_viewed_ids ?? []
  return (await loadProductsByIds(input.partnerId, input.siteSlug, ids)).slice(0, lim)
}

export async function getSiteFavoriteProducts(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  limit?: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const lim = Math.max(1, Math.min(48, Math.floor(Number(input.limit) || 8)))
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const ids = state?.favorite_ids ?? []
  return (await loadProductsByIds(input.partnerId, input.siteSlug, ids)).slice(0, lim)
}

export async function isSiteProductFavorite(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
}): Promise<boolean> {
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const key = input.inventoryId.trim().toLowerCase()
  return (state?.favorite_ids ?? []).some((id) => id.toLowerCase() === key)
}

export async function mutateSiteFavoriteProduct(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
  action: 'add' | 'remove' | 'toggle'
}): Promise<{ is_favorite: boolean } | null> {
  const result = await mutatePartnerVisitorFavoriteFromPg(input)
  if (!result) return null
  return { is_favorite: result.is_favorite }
}

function cartItemsToProductCards(raw: unknown): PartnerAiProductCard[] {
  if (!Array.isArray(raw)) return []
  const out: PartnerAiProductCard[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const card = o.card
    if (!card || typeof card !== 'object' || Array.isArray(card)) continue
    const c = card as Record<string, unknown>
    const name = typeof c.name === 'string' ? c.name.trim() : ''
    const image_url = typeof c.image_url === 'string' ? c.image_url.trim() : ''
    const product_url = typeof c.product_url === 'string' ? c.product_url.trim() : ''
    if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) continue
    const cardOut: PartnerAiProductCard = { name, image_url, product_url }
    if (typeof c.price_hint === 'string' && c.price_hint.trim()) cardOut.price_hint = c.price_hint.trim()
    if (typeof c.sku === 'string' && c.sku.trim()) cardOut.sku = c.sku.trim()
    if (typeof c.inventory_id === 'string' && UUID_RE.test(c.inventory_id.trim())) {
      cardOut.inventory_id = c.inventory_id.trim()
    }
    out.push(cardOut)
    if (out.length >= 24) break
  }
  return out
}

export async function getSiteRecommendedProducts(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  linkedUserId?: string | null
  limit?: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const lim = Math.max(1, Math.min(24, Math.floor(Number(input.limit) || 8)))
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const viewedIds = new Set((state?.recently_viewed_ids ?? []).map((id) => id.toLowerCase()))
  const favoriteIds = new Set((state?.favorite_ids ?? []).map((id) => id.toLowerCase()))

  const cartRaw = await fetchMessagingGuestCartFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const cartCards = cartItemsToProductCards(cartRaw)

  const viewedProducts = await loadProductsByIds(
    input.partnerId,
    input.siteSlug,
    state?.recently_viewed_ids ?? []
  )
  const favoriteProducts = await loadProductsByIds(
    input.partnerId,
    input.siteSlug,
    state?.favorite_ids ?? []
  )
  const viewedCards: PartnerAiProductCard[] = viewedProducts.map((p) => ({
    name: p.name,
    image_url: p.image_url,
    product_url: p.product_url,
    price_hint: p.price_hint || undefined,
    sku: p.sku || undefined,
    inventory_id: UUID_RE.test(p.inventory_id) ? p.inventory_id : undefined,
  }))

  const favoriteCards: PartnerAiProductCard[] = favoriteProducts.map((p) => ({
    name: p.name,
    image_url: p.image_url,
    product_url: p.product_url,
    price_hint: p.price_hint || undefined,
    sku: p.sku || undefined,
    inventory_id: UUID_RE.test(p.inventory_id) ? p.inventory_id : undefined,
  }))

  const recentCards = [...cartCards, ...favoriteCards, ...viewedCards]
  const related = await listRelatedBuyProducts({
    partnerId: input.partnerId,
    recentCards,
    limit: lim + viewedIds.size,
    linkedUserId: input.linkedUserId ?? null,
  })

  const out: PartnerSitePersonalizationProduct[] = []
  const seen = new Set<string>()
  for (const item of related) {
    const key = (item.inventory_id || item.product_url).toLowerCase()
    if (seen.has(key)) continue
    if (item.inventory_id && viewedIds.has(item.inventory_id.toLowerCase())) continue
    if (item.inventory_id && favoriteIds.has(item.inventory_id.toLowerCase())) continue
    seen.add(key)
    const mapped = relatedToPersonalizationProduct(input.siteSlug, item)
    if (mapped) out.push(mapped)
    if (out.length >= lim) break
  }
  return out
}

export async function getSiteVisitorProfile(input: {
  partnerId: string
  accountKey: string
  thread: NonNullable<Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>>
  email?: string | null
}): Promise<PartnerSiteVisitorProfile> {
  const state = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })
  const utm = state?.utm_context ?? {}

  let auth_mode: PartnerSiteVisitorProfile['auth_mode'] = 'anonymous'
  if (input.thread.linkedUserId) auth_mode = 'linked_user'
  else if (input.thread.guestAccountId) auth_mode = 'guest_account'

  const email = (input.email ?? '').trim().toLowerCase()
  let delivery: Awaited<ReturnType<typeof getCustomerDeliveryProfile>> = null
  if (email) {
    delivery = await getCustomerDeliveryProfile({ partnerId: input.partnerId, emailNormalized: email })
  }

  const greeting_name = delivery?.customerName?.trim() || null

  return {
    greeting_name,
    customer_name: delivery?.customerName?.trim() || null,
    customer_phone: delivery?.customerPhone?.trim() || null,
    shipping_address: delivery?.shippingAddress?.trim() || null,
    auth_mode,
    utm,
  }
}

export async function trackSiteProductView(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
}): Promise<boolean> {
  const result = await upsertPartnerVisitorRecentlyViewedFromPg(input)
  return Boolean(result)
}

export async function trackSitePersonalizationEvent(input: {
  partnerId: string
  accountKey: string
  event: string
  inventoryId?: string
  inventoryIds?: string[]
}): Promise<boolean> {
  const result = await trackSitePersonalizationEventDetailed(input)
  return result.ok
}

export async function trackSitePersonalizationEventDetailed(input: {
  partnerId: string
  accountKey: string
  event: string
  inventoryId?: string
  inventoryIds?: string[]
}): Promise<{ ok: boolean; is_favorite?: boolean }> {
  const event = input.event.trim().toLowerCase()
  if (event === 'view_product' && input.inventoryId) {
    const ok = await trackSiteProductView({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      inventoryId: input.inventoryId,
    })
    return { ok }
  }
  if (event === 'view_products' && input.inventoryIds?.length) {
    const result = await appendPartnerVisitorEventInventoryIdsFromPg({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      inventoryIds: input.inventoryIds,
    })
    return { ok: Boolean(result) }
  }
  if (
    (event === 'add_favorite' || event === 'remove_favorite' || event === 'toggle_favorite') &&
    input.inventoryId
  ) {
    const action =
      event === 'add_favorite' ? 'add' : event === 'remove_favorite' ? 'remove' : 'toggle'
    const result = await mutateSiteFavoriteProduct({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      inventoryId: input.inventoryId,
      action,
    })
    return result ? { ok: true, is_favorite: result.is_favorite } : { ok: false }
  }
  return { ok: event === 'page_view' }
}

export async function saveSiteVisitorUtmContext(input: {
  partnerId: string
  accountKey: string
  utm: PartnerVisitorUtmContext
}): Promise<PartnerVisitorUtmContext | null> {
  return upsertPartnerVisitorUtmContextFromPg(input)
}

export function headlessPersonalizationAccountKey(customerRef: string): string {
  return headlessAccountKey(customerRef)
}

export async function resolveSiteVisitorEmail(request: NextRequest): Promise<string | null> {
  const user = await getEmailSessionUser()
  return user?.email?.trim().toLowerCase() || null
}
