import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { buildPartnerSiteBirthGenderPromptScript } from '@/lib/partner-website/shop/build-partner-site-birth-gender-prompt-script'
import { buildPartnerSitePwaInstallPromptScript } from '@/lib/partner-website/shop/build-partner-site-pwa-install-prompt-script'
import {
  injectPartnerShopRuntimeScriptsIntoHtml,
  stampPartnerShopEditorHooksInHtml,
} from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import {
  PW_PWA_INSTALL_PROMPT_CSS,
  PWA_INSTALL_PROMPT_COPY,
  pwaInstallPromptLead,
  shouldOfferPartnerPwaInstallPrompt,
} from '@/lib/partner-website/shop/partner-site-pwa-install-prompt'
import {
  isPartnerSitePwaInstallPromptDismissed,
  isPartnerSitePwaInstallPromptPending,
  markPartnerSiteFreshLoginSession,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function memoryStorage() {
  const mem = new Map<string, string>()
  return {
    getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
    setItem: (key: string, value: string) => {
      mem.set(key, String(value))
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }
}

test('PWA install prompt copy exists for every shop locale', () => {
  for (const locale of WEB_LOCALES) {
    const copy = PWA_INSTALL_PROMPT_COPY[locale]
    assert.ok(copy.title)
    assert.ok(copy.lead)
    assert.ok(copy.leadNamed.includes('{shop}'))
    assert.ok(copy.install)
    assert.ok(copy.later)
    assert.ok(copy.iosTip)
    assert.ok(copy.manualTip)
  }
  assert.match(pwaInstallPromptLead('vi', 'Demo Shop'), /Demo Shop/)
  assert.doesNotMatch(pwaInstallPromptLead('en', ''), /\{shop\}/)
})

test('PWA install prompt is offered once per login until the app is installed', () => {
  const base = {
    pending: true,
    dismissed: false,
    standalone: false,
    loginPath: false,
    editor: false,
    authenticated: true,
    rememberedInstalled: false,
    nativePromptReady: false,
    blockedByOtherPrompt: false,
    alreadySeen: true,
    phone: true,
  }
  assert.equal(shouldOfferPartnerPwaInstallPrompt(base), true)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, phone: false }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, pending: false, alreadySeen: false }), true)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, standalone: true }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, dismissed: true }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, pending: false }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, loginPath: true }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, editor: true }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, authenticated: false }), false)
  assert.equal(shouldOfferPartnerPwaInstallPrompt({ ...base, blockedByOtherPrompt: true }), false)
  assert.equal(
    shouldOfferPartnerPwaInstallPrompt({ ...base, rememberedInstalled: true, nativePromptReady: false }),
    false
  )
  assert.equal(
    shouldOfferPartnerPwaInstallPrompt({ ...base, rememberedInstalled: true, nativePromptReady: true }),
    true
  )
})

test('fresh login flags the install prompt for this shop only', () => {
  const session = memoryStorage()
  Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true })
  markPartnerSiteFreshLoginSession('demo-shop')
  assert.equal(isPartnerSitePwaInstallPromptPending('demo-shop'), true)
  assert.equal(isPartnerSitePwaInstallPromptPending('other-shop'), false)
  assert.equal(isPartnerSitePwaInstallPromptDismissed('demo-shop'), false)
  assert.equal(session.getItem('pw_fresh_login_after_auth:demo-shop'), '1')
})

test('PWA install CSS uses buy token and live HTML injects one script', () => {
  assert.match(PW_PWA_INSTALL_PROMPT_CSS, /data-pw-pwa-install-prompt/)
  assert.match(PW_PWA_INSTALL_PROMPT_CSS, /--pw-buy/)
  assert.match(PW_PWA_INSTALL_PROMPT_CSS, /min-width:640px/)
  assert.doesNotMatch(PW_PWA_INSTALL_PROMPT_CSS, /#ea580c|#f97316/)
  const theme = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(theme, /\[data-pw-pwa-install-prompt\]/)

  const html = '<!DOCTYPE html><html><body><header></header></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, {
    siteSlug: 'demo-shop',
    locale: 'vi',
    shopTitle: 'Demo Shop',
  })
  assert.equal(out.split('data-pw-pwa-install-prompt-bootstrap').length, 2)
  assert.match(out, /Cài web app/)
  assert.match(out, /pw-birth-gender-prompt-settled/)
  assert.match(out, /pw_pwa_install_prompt_pending:'\+SLUG/)
  assert.match(out, /var SLUG="demo-shop"/)
  const twice = injectPartnerShopRuntimeScriptsIntoHtml(out, {
    siteSlug: 'demo-shop',
    locale: 'vi',
    shopTitle: 'Demo Shop',
  })
  assert.equal(twice.split('data-pw-pwa-install-prompt-bootstrap').length, 2)
  const editor = stampPartnerShopEditorHooksInHtml(twice, { siteSlug: 'demo-shop' })
  assert.doesNotMatch(editor, /data-pw-pwa-install-prompt-bootstrap/)

  const script = buildPartnerSitePwaInstallPromptScript({
    siteSlug: 'hotel-shop',
    locale: 'en',
    shopTitle: 'Hotel',
  })
  assert.match(script, /Install the web app/)
  assert.match(script, /Hotel/)
  assert.match(script, /beforeinstallprompt/)
  assert.match(script, /isLoginPath/)
  assert.match(script, /function isPhone\(\)/)
  assert.match(script, /if\(!isPhone\(\)\)return false/)
  assert.match(script, /pw_pwa_install_prompt_seen:'\+SLUG/)
  assert.match(script, /setTimeout\(function\(\)\{if\(!blocker\(\)\)go\(\);\},1600\)/)
  assert.doesNotMatch(script, /#ea580c|#f97316/)
  const body = script.replace(/<\/?script\b[^>]*>/gi, '')
  assert.doesNotThrow(() => new Function(body))

  const birth = buildPartnerSiteBirthGenderPromptScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(birth, /new Event\("pw-birth-gender-prompt-settled"\)/)
})

test('React shop shell mounts the install prompt next to the birthday prompt', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(
    join(here, '../../../components/partner-website/shop/partner-site-shop-shell.tsx'),
    'utf8'
  )
  assert.match(
    src,
    /import \{ PartnerSitePwaInstallPromptModal \} from '@\/components\/partner-website\/shop\/partner-site-pwa-install-prompt-modal'/
  )
  assert.match(src, /<PartnerSitePwaInstallPromptModal siteSlug=\{siteSlug\} shopTitle=\{title\} locale=\{locale\} \/>/)
  const islands = readFileSync(
    join(here, '../../../components/partner-website/shop/partner-site-live-visual-islands.tsx'),
    'utf8'
  )
  assert.match(islands, /<PartnerSitePwaInstallPromptModal siteSlug=\{siteSlug\} shopTitle=\{shopName\} locale=\{locale\} \/>/)
})
