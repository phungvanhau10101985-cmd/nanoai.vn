import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { PARTNER_SHOP_THEME_STYLE_ID } from '@/lib/partner-website/shop/build-shop-theme-css'
import { PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { preparePartnerVisualHtmlForEditor, preparePartnerVisualHtmlForPublic } from '@/lib/partner-website/shop/render-partner-visual-html'
import {
  buildPartnerShopLiveCssPack,
  injectPartnerShopLiveCssHref,
  PARTNER_SHOP_LIVE_CSS_LINK_ID,
  partnerShopLiveCssHref,
  partnerShopLiveCssVersion,
} from '@/lib/partner-website/shop/partner-shop-live-css'
import { partnerShopLiveCssHref as hrefFromClientModule } from '@/lib/partner-website/shop/partner-shop-live-css-href'

const SHELL = `<!DOCTYPE html><html><head></head><body><header class="pw-header">Head</header></body></html>`

test('live CSS href is per slug and theme tokens', () => {
  const a = partnerShopLiveCssHref('demo-shop', DEFAULT_PARTNER_WEBSITE_THEME)
  const b = partnerShopLiveCssHref('demo-shop', { ...DEFAULT_PARTNER_WEBSITE_THEME, primaryColor: '#0f766e' })
  assert.match(a, /^\/api\/site\/demo-shop\/shop-theme\.css\?v=[0-9a-f]{16}$/)
  assert.notEqual(a, b)
  assert.notEqual(partnerShopLiveCssVersion(DEFAULT_PARTNER_WEBSITE_THEME), partnerShopLiveCssVersion({
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    look: 'marketplace',
  }))
  assert.equal(hrefFromClientModule('demo-shop', DEFAULT_PARTNER_WEBSITE_THEME), a)
})

test('live CSS pack has theme tokens, layout, look, and footer fit', () => {
  const css = buildPartnerShopLiveCssPack({ ...DEFAULT_PARTNER_WEBSITE_THEME, look: 'shop' })
  assert.match(css, /--pw-primary/)
  assert.match(css, /\.pw-header/)
  assert.match(css, /html\[data-pw-look="shop"\]|\.pw-shop\[data-pw-look="shop"\]/)
  assert.match(css, /\.pw-newsletter/)
  assert.doesNotMatch(css, /nanoai-visual-editor-styles/)
})

test('injectPartnerShopLiveCssHref stamps a stylesheet link and strips engine style tags', () => {
  const withEngine = `<!DOCTYPE html><html><head>
<style id="${PARTNER_SHOP_THEME_STYLE_ID}">.dead{color:red}</style>
<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">.layout{color:blue}</style>
</head><body><header class="pw-header">Head</header></body></html>`
  const out = injectPartnerShopLiveCssHref(withEngine, { siteSlug: 'demo-shop', theme: DEFAULT_PARTNER_WEBSITE_THEME })
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_LIVE_CSS_LINK_ID}"`))
  assert.match(out, /\/api\/site\/demo-shop\/shop-theme\.css\?v=/)
  assert.doesNotMatch(out, new RegExp(`id="${PARTNER_SHOP_THEME_STYLE_ID}"`))
  assert.doesNotMatch(out, new RegExp(`id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}"`))
  assert.match(out, /data-pw-look="shop"/)
})

test('live visual HTML uses the stylesheet link; Sửa nhanh stays inline', () => {
  const live = preparePartnerVisualHtmlForPublic(SHELL, {
    siteSlug: 'demo-shop',
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    locale: 'vi',
    pageKey: 'home',
  })
  const editor = preparePartnerVisualHtmlForEditor(SHELL, {
    variant: 'desktop',
    siteSlug: 'demo-shop',
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    locale: 'vi',
    pageKey: 'home',
  })
  assert.match(live, new RegExp(`id="${PARTNER_SHOP_LIVE_CSS_LINK_ID}"`))
  assert.doesNotMatch(live, new RegExp(`<style id="${PARTNER_SHOP_THEME_STYLE_ID}"`))
  assert.match(editor, new RegExp(`id="${PARTNER_SHOP_THEME_STYLE_ID}"`))
  assert.doesNotMatch(editor, new RegExp(`id="${PARTNER_SHOP_LIVE_CSS_LINK_ID}"`))
})

test('live CSS href stays out of Redis so the shop shell can import it', () => {
  const hrefSrc = readFileSync(join(process.cwd(), 'src/lib/partner-website/shop/partner-shop-live-css-href.ts'), 'utf8')
  const shellSrc = readFileSync(
    join(process.cwd(), 'src/components/partner-website/shop/partner-site-shop-shell.tsx'),
    'utf8'
  )
  assert.doesNotMatch(hrefSrc, /from ['"]@\/lib\/cache\/partner-shop-cache['"]/)
  assert.doesNotMatch(hrefSrc, /from ['"]ioredis['"]/)
  assert.doesNotMatch(hrefSrc, /from ['"]node:crypto['"]/)
  assert.match(shellSrc, /partner-shop-live-css-href/)
  assert.equal(shellSrc.includes("from '@/lib/partner-website/shop/partner-shop-live-css'"), false)
})
