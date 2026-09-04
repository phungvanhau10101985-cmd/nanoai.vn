import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import {
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
  incrementPartnerInventoryLikesCountFromPg,
  type MessagingPartnerInventoryRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  appendPartnerVisitorEventInventoryIdsFromPg,
  clearPartnerVisitorRecentlyViewedFromPg,
  fetchPartnerVisitorPersonalizationFromPg,
  mutatePartnerVisitorFavoriteFromPg,
  upsertPartnerVisitorRecentlyViewedFromPg,
  upsertPartnerVisitorUtmContextFromPg,
  type PartnerVisitorUtmContext,
} from '@/lib/db/messaging-partner-visitor-personalization-pg'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import { upsertPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import { updateNanoaiChatProfilePg } from '@/lib/db/profiles-repo'
import {
  upsertVisitorProfileHintFromPg,
  fetchVisitorProfileHintFromPg,
} from '@/lib/db/messaging-partner-recommendation-pg'
import {
  assertDobChangeAllowed,
  birthYearFromIso,
  parseIsoDateOfBirth,
  parsePartnerShopGender,
  type PartnerShopGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'
import {
  createGuestSessionId,
  MESSAGING_GUEST_SESSION_COOKIE,
  MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { getCustomerDeliveryProfile } from '@/lib/messaging/guest-chat-ordering'
import { headlessAccountKey } from '@/lib/messaging/partner-headless-cart-utils'
import {
  resolveWidgetOrderThreadFromRequest,
  type WidgetOrderThreadContext,
} from '@/lib/messaging/resolve-widget-order-thread'
import { requestSkipsPartnerSiteShopAuthResume } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { normalizeShopImageUrl } from '@/lib/partner-website/shop/inventory-shop-detail'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { mergePartnerVisitorPersonalizationFromPg } from '@/lib/db/messaging-partner-recommendation-pg'
import { getSiteHomeRecommendationBlock } from '@/lib/partner-website/shop/partner-site-home-recommendation'

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
  email: string | null
  greeting_name: string | null
  customer_name: string | null
  customer_phone: string | null
  shipping_address: string | null
  gender: PartnerShopGender | null
  date_of_birth: string | null
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
  if (sessionId && sessionId !== accountKey) {
    await mergePartnerVisitorPersonalizationFromPg({
      partnerId,
      fromAccountKey: sessionId,
      toAccountKey: accountKey,
    })
  }
  return { accountKey, thread, sessionId }
}

/** RSC — đọc account key khách đã có, không mint session mới. */
export async function peekSiteVisitorAccountKey(): Promise<string> {
  const user = await getEmailSessionUser()
  const jar = cookies()
  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = jar.get(name)?.value?.trim()
      if (value) return value
    }
    return ''
  }
  const guestAccount = pick(
    MESSAGING_GUEST_ACCOUNT_COOKIE,
    MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
    MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE
  )
  if (guestAccount) return guestAccount
  if (user?.id) return user.id
  return pick(
    MESSAGING_GUEST_SESSION_COOKIE,
    MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
    MESSAGING_GUEST_SESSION_SYNC_COOKIE
  )
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
  const imageUrl = normalizeShopImageUrl(row.image_url)
  if (!imageUrl) return null
  const detailPath = partnerSiteProductPath(siteSlug, row.id, { name: (row.name ?? '').trim() || 'Product' })
  const rawProductUrl = (row.product_url ?? '').trim()
  const productUrl = /^https?:\/\//i.test(rawProductUrl)
    ? rawProductUrl
    : `https://shop.local${detailPath}`
  return {
    inventory_id: row.id,
    name: (row.name ?? '').trim() || 'Product',
    price_hint: (row.price_hint ?? '').trim(),
    image_url: imageUrl,
    product_url: productUrl,
    detail_path: detailPath,
    sku: (row.sku ?? '').trim() || null,
  }
}

async function loadProductsByIds(
  partnerId: string,
  siteSlug: string,
  ids: string[]
): Promise<PartnerSitePersonalizationProduct[]> {
  const clean = ids.filter((id) => UUID_RE.test(id))
  if (!clean.length) return []
  const rows = (await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, clean)) ?? []
  const byId = new Map(rows.map((row) => [row.id, row]))
  const out: PartnerSitePersonalizationProduct[] = []
  for (const id of clean) {
    const row = byId.get(id)
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
  const lim = Math.max(1, Math.min(48, Math.floor(Number(input.limit) || 8)))
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

const favoriteToggleInFlight = new Map<
  string,
  Promise<{ is_favorite: boolean; likes_count?: number } | null>
>()

export async function mutateSiteFavoriteProduct(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
  action: 'add' | 'remove' | 'toggle'
}): Promise<{ is_favorite: boolean; likes_count?: number } | null> {
  const lockKey = `${input.partnerId}:${input.accountKey}:${input.inventoryId.trim().toLowerCase()}:${input.action}`
  const pending = favoriteToggleInFlight.get(lockKey)
  if (pending) return pending
  let work!: Promise<{ is_favorite: boolean; likes_count?: number } | null>
  work = (async () => {
    const result = await mutatePartnerVisitorFavoriteFromPg(input)
    if (!result) return null
    let likes_count: number | undefined
    if (result.changed) {
      const next = await incrementPartnerInventoryLikesCountFromPg(
        input.partnerId,
        input.inventoryId,
        result.is_favorite ? 1 : -1
      )
      if (typeof next === 'number') likes_count = next
    }
    return { is_favorite: result.is_favorite, likes_count }
  })().finally(() => {
    if (favoriteToggleInFlight.get(lockKey) === work) favoriteToggleInFlight.delete(lockKey)
  })
  favoriteToggleInFlight.set(lockKey, work)
  return work
}

export async function getSiteRecommendedProducts(input: {
  partnerId: string
  siteSlug: string
  accountKey: string
  linkedUserId?: string | null
  limit?: number
}): Promise<PartnerSitePersonalizationProduct[]> {
  const block = await getSiteHomeRecommendationBlock(input)
  return block.products
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
  const hint = await fetchVisitorProfileHintFromPg({
    partnerId: input.partnerId,
    accountKey: input.accountKey,
  })

  return {
    email: email || null,
    greeting_name,
    customer_name: delivery?.customerName?.trim() || null,
    customer_phone: delivery?.customerPhone?.trim() || null,
    shipping_address: delivery?.shippingAddress?.trim() || null,
    gender: delivery?.gender ?? hint?.gender ?? null,
    date_of_birth: delivery?.dateOfBirth ?? null,
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
}): Promise<{ ok: boolean; is_favorite?: boolean; likes_count?: number }> {
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
    return result
      ? {
          ok: true,
          is_favorite: result.is_favorite,
          ...(typeof result.likes_count === 'number' ? { likes_count: result.likes_count } : {}),
        }
      : { ok: false }
  }
  if (event === 'clear_recently_viewed' || event === 'clear_recent') {
    const ok = await clearPartnerVisitorRecentlyViewedFromPg({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
    })
    return { ok }
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

export async function resolveSiteVisitorEmail(
  request: NextRequest,
  partnerId?: string,
  preloadedThread?: WidgetOrderThreadContext | null
): Promise<string | null> {
  if (!preloadedThread && !requestSkipsPartnerSiteShopAuthResume(request)) {
    const user = await getEmailSessionUser()
    const fromSession = user?.email?.trim().toLowerCase() || ''
    if (fromSession) return fromSession
  }

  if (!partnerId) return null
  const thread = preloadedThread ?? (await resolveWidgetOrderThreadFromRequest(request, partnerId))
  if (!thread?.guestAccountId) {
    if (preloadedThread && !requestSkipsPartnerSiteShopAuthResume(request)) {
      const user = await getEmailSessionUser()
      return user?.email?.trim().toLowerCase() || null
    }
    return null
  }
  const accountEmail = await fetchGuestAccountEmailByIdPg(partnerId, thread.guestAccountId)
  const fromAccount = accountEmail?.emailNormalized?.trim().toLowerCase() || ''
  if (fromAccount) return fromAccount
  if (preloadedThread && !requestSkipsPartnerSiteShopAuthResume(request)) {
    const user = await getEmailSessionUser()
    return user?.email?.trim().toLowerCase() || null
  }
  return null
}

export async function saveSiteVisitorProfile(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string | null
  accountKey?: string | null
  linkedUserId?: string | null
  customerName?: string
  customerPhone?: string
  shippingAddress?: string
  gender?: PartnerShopGender | null
  dateOfBirth?: string | null
}): Promise<{ ok: boolean; error?: 'DOB_INVALID' | 'DOB_DAY_LOCKED' | 'SAVE_FAILED' }> {
  const existing = await getCustomerDeliveryProfile({
    partnerId: input.partnerId,
    emailNormalized: input.emailNormalized,
  })
  const gender = input.gender === undefined ? existing?.gender ?? null : parsePartnerShopGender(input.gender)
  let dateOfBirth = existing?.dateOfBirth ?? null
  if (input.dateOfBirth !== undefined) {
    const next = parseIsoDateOfBirth(input.dateOfBirth)
    if (input.dateOfBirth && !next) return { ok: false, error: 'DOB_INVALID' }
    if (next) {
      const lock = assertDobChangeAllowed(existing?.dateOfBirth, next)
      if (!lock.ok) return { ok: false, error: lock.code }
      dateOfBirth = next
    }
  }
  const saved = await upsertPartnerCustomerProfileByEmailFromPg({
    partnerId: input.partnerId,
    emailNormalized: input.emailNormalized,
    emailRaw: input.emailRaw?.trim() || input.emailNormalized,
    customerName: input.customerName ?? existing?.customerName ?? '',
    customerPhone: input.customerPhone ?? existing?.customerPhone ?? '',
    shippingAddress: input.shippingAddress ?? existing?.shippingAddress ?? '',
    gender,
    dateOfBirth,
  })
  if (!saved) return { ok: false, error: 'SAVE_FAILED' }

  const accountKey = (input.accountKey ?? '').trim()
  if (accountKey && gender) {
    await upsertVisitorProfileHintFromPg({
      partnerId: input.partnerId,
      accountKey,
      gender,
      birthYear: birthYearFromIso(dateOfBirth),
    })
  }
  if (input.linkedUserId && gender && dateOfBirth) {
    await updateNanoaiChatProfilePg(input.linkedUserId, {
      birthDateIso: dateOfBirth,
      gender,
    })
  }
  return { ok: true }
}
