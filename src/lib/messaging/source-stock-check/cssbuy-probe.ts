import type { Page } from 'playwright'
import type { SourceStockCheckResult } from './source-stock-types'
import {
  classifyCssbuyAddToCartCta,
  coerceUrlForSourceStock,
  cssbuyHtmlSuggestsSecurityBlock,
  cssbuyPlaywrightPdpUrl,
} from './source-stock-urls'
import {
  pollPageOutOfStockNotice,
  readPageStockZone,
  withSourceStockProbePage,
  type SourceStockCartInteract,
  type SourceStockProbeSnap,
} from './source-stock-probe-page'
import { noticeFromStockZone, productZoneLooksLoaded } from './stock-signals'

async function dismissCssbuyHumanVerification(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const textOf = (el: Element) => ((el as HTMLElement).innerText || '').trim()
      const box = Array.from(document.querySelectorAll('div,section,dialog')).find((el) =>
        /please complete the human verification first/i.test(textOf(el))
      )
      if (!box) return
      const scope = box.parentElement || document
      const closer = Array.from(scope.querySelectorAll('div,button,span,i')).find((el) => {
        const t = textOf(el)
        const c = String((el as HTMLElement).className || '')
        return t === '×' || t === 'x' || /close|el-dialog__close|icon-close/i.test(c)
      })
      if (closer) (closer as HTMLElement).click()
    })
  } catch {
    /* ignore */
  }
}

async function probeCssbuyCart(page: Page, snap: SourceStockProbeSnap): Promise<SourceStockCartInteract> {
  if (snap.blocked || !snap.addToCartFound) {
    return {
      notice: null,
      clicked: false,
      clickNote: snap.addToCartFound ? '' : 'no-cta',
      verificationBlocked: false,
      zone: await readPageStockZone(page),
    }
  }
  await dismissCssbuyHumanVerification(page)
  await page.waitForTimeout(400)
  const zone = await readPageStockZone(page)
  const already = noticeFromStockZone(zone)
  if (already) {
    return { notice: already, clicked: false, clickNote: 'already-visible', verificationBlocked: false, zone }
  }
  const cartBtn = page.locator('.ty_button_btn6').first()
  const textBtn = page.getByText('Add to Cart', { exact: false }).first()
  const hasClass = (await cartBtn.count()) > 0
  const hasText = (await textBtn.count()) > 0
  if (!hasClass && !hasText) {
    return { notice: null, clicked: false, clickNote: 'no-cta', verificationBlocked: false, zone }
  }
  let clickNote = 'clicked'
  try {
    if (hasClass) await cartBtn.click({ timeout: 8_000, force: true })
    else await textBtn.click({ timeout: 8_000, force: true })
  } catch (e) {
    clickNote = `fail: ${e instanceof Error ? e.message : String(e)}`.slice(0, 240)
  }
  const notice = await pollPageOutOfStockNotice(page)
  let text = ''
  try {
    text = String(await page.evaluate('() => (document.body && document.body.innerText) || ""'))
  } catch {
    text = ''
  }
  const verificationBlocked =
    !notice && clickNote.startsWith('fail:') && text.toLowerCase().includes('human verification')
  return {
    notice,
    clicked: clickNote === 'clicked',
    clickNote,
    verificationBlocked,
    zone: await readPageStockZone(page),
  }
}

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
    const { snap, html, title, href, cart } = await withSourceStockProbePage({
      pageUrl: pdp,
      partnerId,
      preferHosts: ['cssbuy.com'],
      locale: 'en-US',
      timezoneId: 'Asia/Shanghai',
      clickAcceptRisks: true,
      waitLocator: '.ty_button_btn6, .ty_button_btn1',
      waitText: 'Add to Cart',
      probeJs: CSSBUY_PDP_PROBE_JS,
      interact: probeCssbuyCart,
    })
    if (cssbuyHtmlSuggestsSecurityBlock(html, title, href) || snap.blocked) {
      return {
        status: 'blocked',
        error: 'CSSBuy bị Cloudflare / CAPTCHA / chặn bảo mật — fallback Vipomall/PandaMall.'.slice(0, 1000),
        checked_via: 'cssbuy',
      }
    }
    const found = Boolean(snap.addToCartFound)
    const looks = Boolean(snap.looksLikePdp)
    const zone = cart.zone
    let notice = cart.notice
    if (found) {
      if (notice) {
        /* nhãn vùng giá thắng hơn nút */
      } else if (cart.verificationBlocked) {
        return {
          status: 'blocked',
          error: 'CSSBuy: modal «human verification» che nút giỏ, bấm không tới — các nền khác vẫn được đọc.'.slice(0, 1000),
          checked_via: 'cssbuy',
        }
      } else if (!cart.clicked) {
        return {
          status: 'error',
          error: 'CSSBuy: thấy nút giỏ nhưng bấm không tới — chưa kết luận còn hàng.',
          checked_via: 'cssbuy',
        }
      }
    } else {
      if (zone.risksOpen) {
        return {
          status: 'error',
          error: 'CSSBuy: modal «I accept the risks» còn mở — trang chưa đọc được, chưa kết luận hết hàng.',
          checked_via: 'cssbuy',
        }
      }
      notice = noticeFromStockZone(zone)
      if (!notice && !productZoneLooksLoaded(zone)) {
        return {
          status: 'error',
          error: 'CSSBuy: chưa hiện giá, tên hoặc ảnh sản phẩm — chưa kết luận hết hàng.',
          checked_via: 'cssbuy',
        }
      }
    }
    const st = classifyCssbuyAddToCartCta(found, false, notice || '')
    if (st === 'in_stock') {
      return { status: 'in_stock', error: null, checked_via: 'cssbuy' }
    }
    if (notice) {
      return {
        status: 'out_of_stock',
        error: `CSSBuy: vùng giá/thông báo báo hết hàng («${notice}»).`.slice(0, 1000),
        checked_via: 'cssbuy',
      }
    }
    if (looks || productZoneLooksLoaded(zone)) {
      return {
        status: 'out_of_stock',
        error: 'CSSBuy: trang sản phẩm đã hiện nhưng không thấy nút «Add to Cart» / «Buy now» — coi hết hàng.',
        checked_via: 'cssbuy',
      }
    }
    return {
      status: 'error',
      error: 'CSSBuy: chưa hiện giá, tên hoặc ảnh sản phẩm — chưa kết luận hết hàng.',
      checked_via: 'cssbuy',
    }
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
