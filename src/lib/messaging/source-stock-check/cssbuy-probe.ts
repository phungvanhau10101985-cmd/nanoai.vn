import type { SourceStockCheckResult } from './source-stock-types'
import {
  classifyCssbuyAddToCartCta,
  coerceUrlForSourceStock,
  cssbuyHtmlShowsAddToCartButton,
  cssbuyHtmlSuggestsSecurityBlock,
  cssbuyPlaywrightPdpUrl,
} from './source-stock-urls'
import { withSourceStockProbePage } from './source-stock-probe-page'

const CSSBUY_PDP_PROBE_JS = `() => {
  const html = document.documentElement ? document.documentElement.outerHTML : "";
  const low = (html || "").toLowerCase();
  const title = document.title || "";
  const href = location.href || "";
  const bodyText = (document.body && document.body.innerText) || "";
  const blockNeedles = ${JSON.stringify([
    'just a moment',
    'attention required',
    'cf-browser-verification',
    'cf-challenge-running',
    'checking if the site connection is secure',
    'verify you are human',
    'enable javascript and cookies to continue',
    'sorry, you have been blocked',
    'access denied',
    '安全验证',
    '验证码',
  ])};
  const pdpOk = ["add to cart", "i accept the risks", "shop_detail", "purchase quantity"].some((m) => low.includes(m) || bodyText.toLowerCase().includes(m));
  const blocked = !pdpOk && (title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("attention required") || blockNeedles.some((n) => low.includes(n) || title.toLowerCase().includes(n)));
  const nodes = Array.from(document.querySelectorAll("div,button,a,p,span"));
  const exact = (el, re) => re.test(((el.innerText || "") + "").trim());
  const cartEl = document.querySelector("div.ty_button_btn6, .ty_button_btn6")
    || nodes.find((el) => exact(el, /^add to cart$/i));
  const buyEl = document.querySelector("div.ty_button_btn1, .ty_button_btn1")
    || nodes.find((el) => exact(el, /^buy now$/i));
  const cart = cartEl || buyEl || null;
  const looksLikePdp = !!(
    document.querySelector(".shop_detail,.shop_right,.shop_info,.btn_info,.shop_detail_content,.ty_button_btn6,.group-btn")
    || /inventory/i.test(bodyText)
    || /purchase quantity/i.test(bodyText)
    || /add to cart/i.test(bodyText)
    || /buy now/i.test(bodyText)
  );
  return {
    blocked: !!blocked,
    title,
    href,
    htmlLen: (html || "").length,
    looksLikePdp,
    addToCartFound: !!(cartEl || buyEl),
    addToCartDisabled: false,
    addToCartClass: cart ? String(cart.className || "") : "",
    hasAcceptRisks: /i accept the risks/i.test(bodyText),
  };
}`

export async function evaluateCssbuyPdpStock(
  rawUrl: string,
  partnerId?: string | null
): Promise<SourceStockCheckResult> {
  const coerced = coerceUrlForSourceStock(rawUrl, 'cssbuy')
  if (coerced.error) {
    return {
      status: 'error',
      error: `Không quy đổi được sang URL CSSBuy hợp lệ: ${coerced.error}`.slice(0, 1000),
      checked_via: 'cssbuy',
    }
  }
  const pdp = cssbuyPlaywrightPdpUrl(coerced.url) || cssbuyPlaywrightPdpUrl(rawUrl)
  if (!pdp) {
    return {
      status: 'error',
      error: 'Không suy ra được URL CSSBuy goodsDetail để mở Playwright.',
      checked_via: 'cssbuy',
    }
  }
  try {
    const { snap, html, title, href } = await withSourceStockProbePage({
      pageUrl: pdp,
      partnerId,
      preferHosts: ['cssbuy.com'],
      locale: 'en-US',
      timezoneId: 'Asia/Shanghai',
      clickAcceptRisks: true,
      waitLocator: '.ty_button_btn6, .ty_button_btn1',
      waitText: 'Add to Cart',
      probeJs: CSSBUY_PDP_PROBE_JS,
    })
    if (cssbuyHtmlSuggestsSecurityBlock(html, title, href) || snap.blocked) {
      return {
        status: 'blocked',
        error: 'CSSBuy bị Cloudflare / CAPTCHA / chặn bảo mật — fallback Vipomall/PandaMall.'.slice(0, 1000),
        checked_via: 'cssbuy',
      }
    }
    const found = Boolean(snap.addToCartFound) || cssbuyHtmlShowsAddToCartButton(html)
    const looks = Boolean(snap.looksLikePdp)
    const st = classifyCssbuyAddToCartCta(found)
    if (st === 'in_stock') {
      return { status: 'in_stock', error: null, checked_via: 'cssbuy' }
    }
    const err = looks
      ? 'CSSBuy: không thấy nút «Add to Cart» / «Buy now» — coi hết hàng.'
      : 'CSSBuy: không mở được trang sản phẩm sau modal — coi hết hàng.'
    return { status: 'out_of_stock', error: err.slice(0, 1000), checked_via: 'cssbuy' }
  } catch (exc) {
    const detail = (exc instanceof Error ? exc.message : String(exc)) || 'unexpected_error'
    const low = detail.toLowerCase()
    if (['captcha', 'cloudflare', 'cf-ray', 'challenge', 'access denied'].some((n) => low.includes(n))) {
      return {
        status: 'blocked',
        error: (`CSSBuy bị chặn bảo mật / CAPTCHA / Cloudflare — fallback nền khác. ${detail}`).slice(0, 1000),
        checked_via: 'cssbuy',
      }
    }
    return {
      status: 'error',
      error: (`Lỗi Playwright/CSSBuy: ${detail} — chưa kiểm tra được.`).slice(0, 1000),
      checked_via: 'cssbuy',
    }
  }
}
