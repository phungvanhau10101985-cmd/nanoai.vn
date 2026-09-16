export type GuestPurchaseFlow = 'in_chat' | 'external_site' | 'external_cart_url'

/** Query `from=` trên `/cart/add/{sku}` — đóng modal thì quay lại chat NanoAI. */
export const GUEST_CART_ADD_FROM_NANOAI = 'nanoai'

export function normalizeGuestPurchaseFlow(v: unknown): GuestPurchaseFlow {
  if (v === 'external_cart_url') return 'external_cart_url'
  if (v === 'external_site') return 'external_site'
  return 'in_chat'
}

export function isGuestCartAddFromNanoAi(from: string | null | undefined): boolean {
  return String(from ?? '').trim().toLowerCase() === GUEST_CART_ADD_FROM_NANOAI
}

/** SKU trên `/cart/add/...` — một segment đã encode hoặc catch-all có `/`. */
export function decodePartnerShopCartAddSkuParam(skuSegments: string | string[] | undefined): string {
  const raw = Array.isArray(skuSegments) ? skuSegments.filter(Boolean).join('/') : String(skuSegments ?? '')
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    return decodeURIComponent(trimmed).trim().slice(0, 256)
  } catch {
    return trimmed.slice(0, 256)
  }
}

export function parseGuestExternalCartUrlTemplate(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().slice(0, 2048)
  if (!t || !/\{sku\}/i.test(t) || !/^https?:\/\//i.test(t)) return null
  try {
    const probe = t.replace(/\{sku\}/gi, 'SKU')
    const parsed = new URL(probe)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  } catch {
    return null
  }
  return t
}

/** Shop SaaS cùng hệ thống: `{publicUrl}/cart/add/{sku}?from=nanoai` — không dán tay, không API key. */
export function buildPartnerShopCartAddUrlTemplate(publicBaseUrl: string): string | null {
  const base = publicBaseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) return null
  return parseGuestExternalCartUrlTemplate(`${base}/cart/add/{sku}?from=${GUEST_CART_ADD_FROM_NANOAI}`)
}

/** Query trên iframe chat: origin+path trang host (web khách hoặc shop SaaS). */
export const GUEST_CHAT_EMBED_PAGE_PARAM = 'embed_page'

/** URL web khách đã lưu thắng mẫu SaaS khi không biết trang host — dashboard / fallback. */
export function pickGuestExternalCartUrlTemplate(
  storedTemplate: string | null | undefined,
  saasAutoTemplate: string | null | undefined
): string | null {
  return parseGuestExternalCartUrlTemplate(storedTemplate) || parseGuestExternalCartUrlTemplate(saasAutoTemplate)
}

/** Origin + pathname, bỏ query — đủ để phân nhánh giỏ. */
export function normalizeGuestChatEmbedPageUrl(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!t || !/^https?:\/\//i.test(t)) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const path = u.pathname || '/'
    return `${u.origin}${path}`
  } catch {
    return null
  }
}

/** Gắn `embed_page` vào URL iframe chat — parent origin/path lúc mở. */
export function stampGuestChatEmbedPageParam(
  chatUrl: string,
  embedPage?: string | null,
  baseHref?: string
): string {
  const t = String(chatUrl ?? '').trim()
  if (!t) return t
  const page =
    normalizeGuestChatEmbedPageUrl(embedPage) ||
    (typeof window !== 'undefined'
      ? normalizeGuestChatEmbedPageUrl(`${window.location.origin}${window.location.pathname}`)
      : null)
  if (!page) return t
  try {
    const base =
      baseHref ||
      (typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://localhost')
    const u = new URL(t, base)
    u.searchParams.set(GUEST_CHAT_EMBED_PAGE_PARAM, page)
    if (/^https?:\/\//i.test(t)) return u.toString()
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return t
  }
}

export function readGuestChatEmbedPageUrlFromWindow(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const q = new URLSearchParams(window.location.search).get(GUEST_CHAT_EMBED_PAGE_PARAM)
    const fromQ = normalizeGuestChatEmbedPageUrl(q)
    if (fromQ) return fromQ
  } catch {
    /* ignore */
  }
  try {
    if (window.parent !== window) {
      const fromParent = normalizeGuestChatEmbedPageUrl(window.parent.location.href)
      if (fromParent) return fromParent
    }
  } catch {
    /* cross-origin */
  }
  try {
    const fromRef = normalizeGuestChatEmbedPageUrl(document.referrer)
    if (fromRef) return fromRef
  } catch {
    /* ignore */
  }
  try {
    return normalizeGuestChatEmbedPageUrl(`${window.location.origin}${window.location.pathname}`)
  } catch {
    return null
  }
}

/**
 * Chat đang mở trên web shop cùng nền tảng (tên miền riêng hoặc `/site/{slug}`).
 * Không khớp web khách ngoài hệ thống (vd. 188.com.vn).
 */
export function isGuestChatOnSamePlatformShop(input: {
  embedPage?: string | null
  saasPublicUrl?: string | null
  siteSlug?: string | null
}): boolean {
  const page = normalizeGuestChatEmbedPageUrl(input.embedPage)
  if (!page) return false
  let pageUrl: URL
  try {
    pageUrl = new URL(page)
  } catch {
    return false
  }

  const saasRaw = String(input.saasPublicUrl ?? '').trim()
  if (saasRaw && /^https?:\/\//i.test(saasRaw)) {
    try {
      const saas = new URL(saasRaw)
      if (pageUrl.origin === saas.origin) {
        const saasPath = (saas.pathname || '/').replace(/\/+$/, '') || '/'
        if (saasPath === '/') return true
        if (pageUrl.pathname === saasPath || pageUrl.pathname.startsWith(`${saasPath}/`)) return true
      }
    } catch {
      /* ignore */
    }
  }

  const slug = String(input.siteSlug ?? '').trim()
  if (slug) {
    const prefix = `/site/${slug}`
    if (pageUrl.pathname === prefix || pageUrl.pathname.startsWith(`${prefix}/`)) return true
  }

  return false
}

/** Giỏ trên đúng origin+prefix đang chat (`/site/{slug}` hoặc tên miền riêng). */
export function guestCartUrlTemplateFromEmbedPage(
  embedPage?: string | null,
  siteSlug?: string | null
): string | null {
  const page = normalizeGuestChatEmbedPageUrl(embedPage)
  if (!page) return null
  let u: URL
  try {
    u = new URL(page)
  } catch {
    return null
  }
  const slug = String(siteSlug ?? '').trim()
  const prefix = slug ? `/site/${slug}` : ''
  const base =
    prefix && (u.pathname === prefix || u.pathname.startsWith(`${prefix}/`))
      ? `${u.origin}${prefix}`
      : u.origin
  return buildPartnerShopCartAddUrlTemplate(base)
}

/**
 * Hai nhánh độc lập: chat trên web cùng nền tảng → giỏ đúng tên miền đó;
 * chat trên web khách ngoài hệ thống → URL đã lưu. Không biết host thì URL đã lưu thắng.
 */
export function pickGuestCartUrlTemplateByHost(input: {
  storedTemplate?: string | null
  saasTemplate?: string | null
  saasPublicUrl?: string | null
  siteSlug?: string | null
  embedPage?: string | null
}): string | null {
  const stored = parseGuestExternalCartUrlTemplate(input.storedTemplate)
  const saas = parseGuestExternalCartUrlTemplate(input.saasTemplate)
  const saasPublic =
    String(input.saasPublicUrl ?? '').trim() ||
    (saas ? saas.replace(/\/cart\/add\/\{sku\}(?:\?from=nanoai)?$/i, '') : '') ||
    null
  if (
    isGuestChatOnSamePlatformShop({
      embedPage: input.embedPage,
      saasPublicUrl: saasPublic,
      siteSlug: input.siteSlug,
    })
  ) {
    return (
      guestCartUrlTemplateFromEmbedPage(input.embedPage, input.siteSlug) || saas
    )
  }
  return stored || saas
}

/** Ẩn ô dán URL khi shop đã có web trên hệ thống và chưa có mẫu web khách. */
export function guestPurchaseUsesSaasAutoCart(input: {
  saasLinked: boolean
  storedTemplate?: string | null
}): boolean {
  return Boolean(input.saasLinked) && !parseGuestExternalCartUrlTemplate(input.storedTemplate)
}

export type GuestPurchaseNavigateInput = {
  product_url: string
  sku?: string | null
}

/** Chuyển thẻ SP → input mua (dùng chung mọi nút Đặt hàng / Thêm giỏ). */
export function guestPurchaseInputFromProductCard(card: {
  name: string
  image_url: string
  product_url: string
  price_hint?: string
  sku?: string
  inventory_id?: string
}): GuestPurchaseNavigateInput & {
  name: string
  image_url: string
  price_hint?: string
  inventory_id?: string
} {
  const product_url = (card.product_url ?? '').trim()
  const sku = (card.sku ?? '').trim().slice(0, 128) || null
  const invId = (card.inventory_id ?? '').trim()
  return {
    name: card.name,
    image_url: card.image_url,
    product_url,
    price_hint: card.price_hint,
    sku,
    ...(invId ? { inventory_id: invId } : {}),
  }
}

export type GuestPurchaseNavigateFailure =
  | 'missing_product_url'
  | 'missing_sku'
  | 'missing_template'
  | 'invalid_template'

/** Mua / Thêm giỏ không dùng form chat — mở URL ngoài. */
export function guestPurchaseOpensExternalUrl(flow: GuestPurchaseFlow): boolean {
  return flow === 'external_site' || flow === 'external_cart_url'
}

/** Tín hiệu mua trên chat = nút Mua / Thêm giỏ / Đặt hàng. Chat mua, Tư vấn, bấm ảnh thẻ = không. */
export type GuestChatProductAction = 'buy' | 'add_cart' | 'order' | 'card_click' | 'consult' | 'view_details'

export function guestChatActionOpensExternalPurchase(
  flow: GuestPurchaseFlow,
  action: GuestChatProductAction
): boolean {
  if (action !== 'buy' && action !== 'add_cart' && action !== 'order') return false
  return guestPurchaseOpensExternalUrl(flow)
}

export function buildGuestExternalCartUrl(template: string, sku: string): string | null {
  const t = template.trim()
  const s = sku.trim().slice(0, 128)
  if (!t || !s || !/\{sku\}/i.test(t)) return null
  const url = t.replace(/\{sku\}/gi, encodeURIComponent(s))
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}

export function resolveGuestPurchaseButtonUrl(
  flow: GuestPurchaseFlow,
  cartUrlTemplate: string | null | undefined,
  input: GuestPurchaseNavigateInput
): { ok: true; url: string } | { ok: false; reason: GuestPurchaseNavigateFailure } {
  const productUrl = (input.product_url ?? '').trim()
  const sku = (input.sku ?? '').trim().slice(0, 128)

  if (flow === 'external_cart_url') {
    const built = buildGuestExternalCartUrl(cartUrlTemplate ?? '', sku)
    if (built) return { ok: true, url: built }
    if (!sku) return { ok: false, reason: 'missing_sku' }
    const tpl = (cartUrlTemplate ?? '').trim()
    if (!tpl || !/\{sku\}/i.test(tpl)) return { ok: false, reason: 'missing_template' }
    return { ok: false, reason: 'invalid_template' }
  }

  if (flow === 'external_site') {
    if (/^https?:\/\//i.test(productUrl)) return { ok: true, url: productUrl }
    return { ok: false, reason: 'missing_product_url' }
  }

  return { ok: false, reason: 'missing_product_url' }
}
