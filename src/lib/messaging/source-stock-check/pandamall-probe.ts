import type { Page } from 'playwright'
import type { SourceStockCheckResult } from './source-stock-types'
import { coerceUrlForSourceStock, pandamallHtmlSuggestsBlocked } from './source-stock-urls'
import {
  pollPageOutOfStockNotice,
  readPageStockZone,
  withSourceStockProbePage,
  type SourceStockCartInteract,
  type SourceStockProbeSnap,
} from './source-stock-probe-page'
import { noticeFromStockZone, productZoneLooksLoaded } from './stock-signals'

async function probePandamallCart(page: Page, snap: SourceStockProbeSnap): Promise<SourceStockCartInteract> {
  const zone = await readPageStockZone(page)
  if (snap.blocked || snap.login || !snap.ctaFound) {
    return {
      notice: noticeFromStockZone(zone),
      clicked: false,
      clickNote: snap.ctaFound ? '' : 'no-cta',
      verificationBlocked: false,
      zone,
    }
  }
  const already = noticeFromStockZone(zone)
  if (already) {
    return { notice: already, clicked: false, clickNote: 'already-visible', verificationBlocked: false, zone }
  }
  const cartBtn = page.locator('.btn-addcart, .group-btn .btn-addcart').first()
  if ((await cartBtn.count()) === 0) {
    return { notice: null, clicked: false, clickNote: 'no-cta', verificationBlocked: false, zone }
  }
  let clicked = false
  try {
    await cartBtn.click({ timeout: 8_000, force: true })
    clicked = true
  } catch {
    clicked = false
  }
  const notice = await pollPageOutOfStockNotice(page)
  return {
    notice,
    clicked,
    clickNote: clicked ? 'clicked' : 'fail',
    verificationBlocked: false,
    zone: await readPageStockZone(page),
  }
}

const PANDAMALL_PDP_PROBE_JS = `() => {
  const html = document.documentElement ? document.documentElement.outerHTML : "";
  const low = (html || "").toLowerCase();
  const title = document.title || "";
  const bodyText = (document.body && document.body.innerText) || "";
  const pdpOk = ["btn-addcart", "btn-buynow", "thêm vào giỏ", "mua ngay", "group-btn"].some(
    (m) => low.includes(m) || bodyText.toLowerCase().includes(m)
  );
  const challenge = ["just a moment", "attention required", "cf-browser-verification", "verify you are human", "captcha", "access denied", "验证码"].some(
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
    const { snap, html, title, cart } = await withSourceStockProbePage({
      pageUrl: coerced.url,
      partnerId,
      preferHosts: ['pandamall.vn'],
      pandamallLogin: true,
      waitLocator: '.btn-addcart, .btn-buynow, .group-btn',
      probeJs: PANDAMALL_PDP_PROBE_JS,
      interact: probePandamallCart,
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
    const ctaFound = Boolean(snap.ctaFound)
    const notice = cart.notice || noticeFromStockZone(cart.zone)
    if (notice) {
      const viaClick = cart.clickNote === 'clicked'
      return {
        status: 'out_of_stock',
        error: viaClick
          ? `PandaMall: bấm giỏ báo hết hàng («${notice}»).`.slice(0, 1000)
          : `PandaMall: vùng giá/thông báo báo hết hàng («${notice}»).`.slice(0, 1000),
        checked_via: 'pandamall',
      }
    }
    if (ctaFound) {
      if (cart.clicked) return { status: 'in_stock', error: null, checked_via: 'pandamall' }
      return {
        status: 'error',
        error: 'PandaMall: thấy nút giỏ nhưng bấm không tới — chưa kết luận còn hàng.',
        checked_via: 'pandamall',
      }
    }
    if (productZoneLooksLoaded(cart.zone)) {
      return {
        status: 'out_of_stock',
        error: 'PandaMall: trang sản phẩm đã hiện nhưng không thấy nút «Thêm vào giỏ» / «Mua ngay» — coi hết hàng.',
        checked_via: 'pandamall',
      }
    }
    return {
      status: 'error',
      error: 'PandaMall: chưa hiện giá, tên hoặc ảnh sản phẩm — chưa kết luận hết hàng.',
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
