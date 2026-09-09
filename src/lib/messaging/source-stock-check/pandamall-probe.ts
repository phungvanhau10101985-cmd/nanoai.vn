import type { SourceStockCheckResult } from './source-stock-types'
import { coerceUrlForSourceStock, pandamallHtmlShowsCartOrBuyCta, pandamallHtmlSuggestsBlocked } from './source-stock-urls'
import { withSourceStockProbePage } from './source-stock-probe-page'

const PANDAMALL_PDP_PROBE_JS = `() => {
  const html = document.documentElement ? document.documentElement.outerHTML : "";
  const low = (html || "").toLowerCase();
  const title = document.title || "";
  const bodyText = (document.body && document.body.innerText) || "";
  const pdpOk = ["btn-addcart", "btn-buynow", "thêm vào giỏ", "mua ngay", "group-btn"].some(
    (m) => low.includes(m) || bodyText.toLowerCase().includes(m)
  );
  const challenge = ["just a moment", "attention required", "cf-browser-verification", "verify you are human"].some(
    (n) => title.toLowerCase().includes(n) || low.includes(n)
  );
  const add = document.querySelector(".group-btn .btn-addcart, button.btn-addcart");
  const buy = document.querySelector(".group-btn .btn-buynow, button.btn-buynow");
  const addByText = Array.from(document.querySelectorAll("button, span")).find((el) =>
    /^thêm vào giỏ$/i.test(((el.innerText || "") + "").trim())
  );
  const buyByText = Array.from(document.querySelectorAll("button, span")).find((el) =>
    /^mua ngay$/i.test(((el.innerText || "") + "").trim())
  );
  const login = /đăng nhập/i.test(bodyText) && (location.href || "").toLowerCase().includes("login");
  return {
    blocked: !pdpOk && challenge,
    login: !!login,
    ctaFound: !!(add || buy || addByText || buyByText),
  };
}`

export async function evaluatePandamallSourceStock(
  rawUrl: string,
  partnerId?: string | null
): Promise<SourceStockCheckResult> {
  const coerced = coerceUrlForSourceStock(rawUrl, 'pandamall')
  if (coerced.error || !coerced.url) {
    return {
      status: 'error',
      error: `Không quy đổi được sang PandaMall: ${coerced.error || 'Không có URL PandaMall hợp lệ.'}`.slice(0, 1000),
      checked_via: 'pandamall',
    }
  }
  try {
    const { snap, html, title } = await withSourceStockProbePage({
      pageUrl: coerced.url,
      partnerId,
      preferHosts: ['pandamall.vn'],
      pandamallLogin: true,
      waitLocator: '.btn-addcart, .btn-buynow, .group-btn',
      probeJs: PANDAMALL_PDP_PROBE_JS,
    })
    if (pandamallHtmlSuggestsBlocked(html, title) || snap.blocked) {
      return {
        status: 'blocked',
        error: 'PandaMall bị Cloudflare / CAPTCHA — dừng nếu các nền khác cũng bị chặn.',
        checked_via: 'pandamall',
      }
    }
    if (snap.login && !snap.ctaFound) {
      return {
        status: 'error',
        error: 'PandaMall yêu cầu đăng nhập — chưa đọc được nút giỏ/mua.',
        checked_via: 'pandamall',
      }
    }
    if (snap.ctaFound || pandamallHtmlShowsCartOrBuyCta(html)) {
      return { status: 'in_stock', error: null, checked_via: 'pandamall' }
    }
    return {
      status: 'out_of_stock',
      error: 'PandaMall: không thấy nút «Thêm vào giỏ» / «Mua ngay» — coi hết hàng.',
      checked_via: 'pandamall',
    }
  } catch (exc) {
    const detail = (exc instanceof Error ? exc.message : String(exc)) || 'unexpected_error'
    const low = detail.toLowerCase()
    if (['captcha', 'cloudflare', 'cf-ray', 'challenge', 'access denied'].some((n) => low.includes(n))) {
      return {
        status: 'blocked',
        error: (`PandaMall bị chặn bảo mật / CAPTCHA / Cloudflare. ${detail}`).slice(0, 1000),
        checked_via: 'pandamall',
      }
    }
    return {
      status: 'error',
      error: (`Lỗi Playwright/PandaMall: ${detail}`).slice(0, 1000),
      checked_via: 'pandamall',
    }
  }
}
