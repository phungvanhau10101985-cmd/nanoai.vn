import { mergeSiteCartLine, parseSiteCartLines, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'
import {
  queuePartnerSitePendingCart,
  readPartnerSitePendingCart,
  takePartnerSitePendingCart,
  type PartnerSitePendingCartLine,
} from '@/lib/partner-website/shop/partner-site-pending-cart'
import { isPartnerShopLoginPath } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import {
  partnerSiteCartApiPath,
  partnerSiteProductApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

type FlushWindow = Window & { __pwPendingCartFlushInFlight?: boolean }

export type FlushPartnerSitePendingCartResult = {
  flushed: boolean
  buyNow: boolean
  last: PartnerSitePendingCartLine | null
}

function newLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function resolvePendingCard(
  siteSlug: string,
  item: PartnerSitePendingCartLine,
  authHeaders: () => Record<string, string>,
  captureFromResponse?: (res: Response) => void
): Promise<SiteCartLine['card'] | null> {
  const res = await fetch(`${partnerSiteProductApiPath(siteSlug, item.inventory_id)}?view=buy`, {
    credentials: 'same-origin',
    headers: authHeaders(),
  })
  captureFromResponse?.(res)
  const json = (await res.json().catch(() => ({}))) as {
    product?: {
      id?: string
      name?: string
      imageUrl?: string
      productUrl?: string
      priceHint?: string
      sku?: string
    }
  }
  const p = json.product
  const name = String(p?.name || item.name || '').trim() || 'Product'
  const image_url = String(p?.imageUrl || item.image_url || '').trim()
  const product_url = String(p?.productUrl || item.product_url || '').trim()
  if (!res.ok || !p || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  return {
    name,
    image_url,
    product_url,
    inventory_id: p.id || item.inventory_id,
    ...(p.priceHint || item.price_hint ? { price_hint: p.priceHint || item.price_hint } : {}),
    ...(p.sku || item.sku ? { sku: p.sku || item.sku } : {}),
  }
}

/** Đưa giỏ tạm (188 pending-cart) vào giỏ đã login. Bỏ qua `/login` để trang đích hiện modal. */
export async function flushPartnerSitePendingCartAfterAuth(input: {
  siteSlug: string
  pathname?: string
  authHeaders: () => Record<string, string>
  captureFromResponse?: (res: Response) => void
}): Promise<FlushPartnerSitePendingCartResult> {
  const empty: FlushPartnerSitePendingCartResult = { flushed: false, buyNow: false, last: null }
  if (typeof window === 'undefined') return empty
  const win = window as FlushWindow
  if (win.__pwPendingCartFlushInFlight) return empty
  const path = input.pathname ?? window.location.pathname
  if (isPartnerShopLoginPath(path, input.siteSlug)) return empty
  if (!readPartnerSitePendingCart(input.siteSlug).length) return empty
  win.__pwPendingCartFlushInFlight = true
  const list = takePartnerSitePendingCart(input.siteSlug)
  if (!list.length) {
    win.__pwPendingCartFlushInFlight = false
    return empty
  }

  try {
    const cartRes = await fetch(partnerSiteCartApiPath(input.siteSlug), {
      credentials: 'same-origin',
      headers: input.authHeaders(),
    })
    input.captureFromResponse?.(cartRes)
    if (!cartRes.ok) throw new Error('cart')
    const cartJson = (await cartRes.json().catch(() => ({}))) as { items?: unknown }
    let items = parseSiteCartLines(cartJson.items)
    let buyNow = false
    let last: PartnerSitePendingCartLine | null = null

    for (const item of list) {
      if (item.buyNow) buyNow = true
      last = item
      const card = await resolvePendingCard(input.siteSlug, item, input.authHeaders, input.captureFromResponse)
      if (!card) throw new Error('product')
      const line: SiteCartLine = {
        id: newLineId(),
        card,
        quantity: Math.min(99, Math.max(1, item.quantity || 1)),
        color: item.color || '',
        size: item.size || '',
        note: '',
        ...(item.image_url ? { variantLineImages: [item.image_url] } : {}),
      }
      items = mergeSiteCartLine(items, line)
    }

    const saveRes = await fetch(partnerSiteCartApiPath(input.siteSlug), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...input.authHeaders() },
      body: JSON.stringify({ items }),
    })
    input.captureFromResponse?.(saveRes)
    if (!saveRes.ok) throw new Error('save')
    try {
      document.dispatchEvent(new CustomEvent('pw-cart-updated'))
    } catch {
      /* ignore */
    }
    return { flushed: true, buyNow, last }
  } catch {
    win.__pwPendingCartFlushInFlight = false
    for (const item of list) {
      queuePartnerSitePendingCart(input.siteSlug, item, { buyNow: item.buyNow })
    }
    return empty
  }
}
