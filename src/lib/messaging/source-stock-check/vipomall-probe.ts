import type { SourceStockCheckResult } from './source-stock-types'
import {
  coerceUrlForSourceStock,
  resolveNumeric1688OfferIdFromSourceUrl,
  vipomallHtmlShowsAddToCartCta,
  vipomallHtmlSuggestsBlocked,
} from './source-stock-urls'
import { buildVipomallPdpUrl, VIPOMALL_PLATFORM_1688 } from '@/lib/messaging/listing-import/listing-import-urls'
import { withSourceStockProbePage } from './source-stock-probe-page'

const VIPOMALL_PDP_PROBE_JS = `() => {
  const html = document.documentElement ? document.documentElement.outerHTML : "";
  const low = (html || "").toLowerCase();
  const title = document.title || "";
  const bodyText = (document.body && document.body.innerText) || "";
  const pdpOk = ["thêm giỏ hàng", "cart_detail.svg", "spn-color", "mua ngay"].some(
    (m) => low.includes(m) || bodyText.toLowerCase().includes(m)
  );
  const challenge = ["just a moment", "attention required", "cf-browser-verification", "verify you are human"].some(
    (n) => title.toLowerCase().includes(n) || low.includes(n)
  );
  const cart = document.querySelector('button.button img[src*="cart_detail.svg"]')
    || Array.from(document.querySelectorAll("button.button, span.spn-color, button")).find((el) =>
      /thêm\\s*giỏ\\s*hàng/i.test(((el.innerText || "") + "").trim())
    );
  const buy = Array.from(document.querySelectorAll("button, a, span")).find((el) =>
    /^mua ngay$/i.test(((el.innerText || "") + "").trim())
  );
  return {
    blocked: !pdpOk && challenge,
    cartFound: !!cart,
    buyFound: !!buy,
    ctaFound: !!(cart || buy),
  };
}`

export async function evaluateVipomallSourceStockFromUrl(
  rawUrl: string,
  opts?: { fallbackProductId?: string | null; partnerId?: string | null }
): Promise<SourceStockCheckResult> {
  let page = ''
  const coerced = coerceUrlForSourceStock(rawUrl, 'vipomall')
  if (coerced.error || !coerced.url.trim()) {
    const oid = resolveNumeric1688OfferIdFromSourceUrl(rawUrl, opts?.fallbackProductId)
    if (!oid) {
      return {
        status: 'error',
        error: `Không quy đổi được sang Vipomall: ${coerced.error || 'thiếu offerId'}`.slice(0, 1000),
        checked_via: 'vipomall',
      }
    }
    page = buildVipomallPdpUrl(oid, VIPOMALL_PLATFORM_1688)
  } else {
    page = coerced.url.trim()
  }
  try {
    const { snap, html, title } = await withSourceStockProbePage({
      pageUrl: page,
      partnerId: opts?.partnerId,
      preferHosts: ['vipomall.vn'],
      waitLocator: "button.button, span.spn-color, img[src*='cart_detail.svg']",
      probeJs: VIPOMALL_PDP_PROBE_JS,
    })
    if (
      (vipomallHtmlSuggestsBlocked(html) && !vipomallHtmlShowsAddToCartCta(html) && title.toLowerCase().includes('just a moment')) ||
      snap.blocked
    ) {
      return {
        status: 'blocked',
        error: 'Vipomall bị Cloudflare / CAPTCHA — fallback PandaMall.',
        checked_via: 'vipomall',
      }
    }
    if (snap.ctaFound || vipomallHtmlShowsAddToCartCta(html)) {
      return { status: 'in_stock', error: null, checked_via: 'vipomall' }
    }
    return {
      status: 'out_of_stock',
      error: 'Vipomall: không thấy nút «Thêm giỏ hàng» / «Mua ngay» — coi hết hàng.',
      checked_via: 'vipomall',
    }
  } catch (exc) {
    const detail = (exc instanceof Error ? exc.message : String(exc)) || 'unexpected_error'
    const low = detail.toLowerCase()
    if (['captcha', 'cloudflare', 'cf-ray', 'challenge', 'access denied'].some((n) => low.includes(n))) {
      return {
        status: 'blocked',
        error: (`Vipomall bị chặn bảo mật / CAPTCHA / Cloudflare — fallback PandaMall. ${detail}`).slice(0, 1000),
        checked_via: 'vipomall',
      }
    }
    return {
      status: 'error',
      error: (`Lỗi Playwright/Vipomall: ${detail}`).slice(0, 1000),
      checked_via: 'vipomall',
    }
  }
}
