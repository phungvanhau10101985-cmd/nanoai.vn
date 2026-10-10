import { PARTNER_SHOP_CHROME_FLOAT_SCRIPT } from '@/lib/partner-website/shop/chrome-float-widgets'
import { buildPartnerSiteSliderBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-slider-bootstrap-script'
import { buildPartnerShopCdnImageRetryScript } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PARTNER_SHOP_LISTING_HEAD_SCRIPT } from '@/lib/partner-website/shop/listing-head'
import { PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT } from '@/lib/partner-website/shop/mobile-header-back'
import { PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT } from '@/lib/partner-website/shop/mobile-header-logo-collapse'
import { PARTNER_SHOP_SEARCH_CLAMP_SCRIPT } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { PARTNER_SHOP_LOGO_HOST_SCRIPT } from '@/lib/partner-website/shop/partner-shop-logo-host-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { PARTNER_SHOP_DOCK_NAV_SCRIPT } from '@/lib/partner-website/shop/partner-site-dock-nav-active'
import { PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT } from '@/lib/partner-website/shop/pin-chrome-icon-badges'
import {
  extractPartnerShopRuntimeScriptInner,
  hashPartnerShopRuntimeBody,
  PW_SHOP_RUNTIME_ROUTE_PREFIX,
} from '@/lib/partner-website/shop/pw-shop-hashed-runtime'
import { PARTNER_SHOP_STAY_SCROLL_SCRIPT } from '@/lib/partner-website/shop/stay-scroll-elements'
import { PARTNER_SHOP_STICK_HEADER_SCRIPT } from '@/lib/partner-website/shop/stick-header-elements'
import {
  PARTNER_SHOP_IMAGE_ZOOM_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
} from '@/lib/partner-website/visual-editor/pw-scene'

/**
 * Shop-independent runtime scripts. Live pages emit them as same-position sync
 * `<script src>` so the body is not repeated in every HTML + RSC payload.
 * Server-only: importing this from a client component would bundle every body.
 */
const STATIC_RUNTIME_SOURCES: Array<[string, () => string]> = [
  ['scene-center', () => PARTNER_SHOP_SCENE_CENTER_SCRIPT],
  ['listing-head', () => PARTNER_SHOP_LISTING_HEAD_SCRIPT],
  ['mobile-header-logo', () => PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT],
  ['mobile-head-back', () => PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT],
  ['stick-header', () => PARTNER_SHOP_STICK_HEADER_SCRIPT],
  ['stay-scroll', () => PARTNER_SHOP_STAY_SCROLL_SCRIPT],
  ['chrome-float', () => PARTNER_SHOP_CHROME_FLOAT_SCRIPT],
  ['logo-host', () => PARTNER_SHOP_LOGO_HOST_SCRIPT],
  ['search-clamp', () => PARTNER_SHOP_SEARCH_CLAMP_SCRIPT],
  ['image-zoom', () => PARTNER_SHOP_IMAGE_ZOOM_SCRIPT],
  ['dock-nav', () => PARTNER_SHOP_DOCK_NAV_SCRIPT],
  ['badge-pin', () => PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT],
  ['chat-bridge', () => extractPartnerShopRuntimeScriptInner(buildPartnerSiteLandingChatBridgeScript())],
  ['slider', () => extractPartnerShopRuntimeScriptInner(buildPartnerSiteSliderBootstrapScript())],
  ['cdn-image-retry', () => extractPartnerShopRuntimeScriptInner(buildPartnerShopCdnImageRetryScript())],
]

/** Smaller scripts cost more as an extra request than they save inline. */
const MIN_STATIC_RUNTIME_CHARS = 1500

type StaticRuntimeEntry = { name: string; hash: string; body: string }

let registry: {
  byBody: Map<string, StaticRuntimeEntry>
  byName: Map<string, StaticRuntimeEntry>
} | null = null

function staticRuntimeRegistry() {
  if (registry) return registry
  const byBody = new Map<string, StaticRuntimeEntry>()
  const byName = new Map<string, StaticRuntimeEntry>()
  for (const [name, read] of STATIC_RUNTIME_SOURCES) {
    const body = String(read() || '').trim()
    if (body.length < MIN_STATIC_RUNTIME_CHARS) continue
    const entry = { name, hash: hashPartnerShopRuntimeBody(body), body }
    byBody.set(body, entry)
    byName.set(name, entry)
  }
  registry = { byBody, byName }
  return registry
}

export function staticShopRuntimeSrcForBody(body: string): string | null {
  const entry = staticRuntimeRegistry().byBody.get(String(body || '').trim())
  return entry ? `${PW_SHOP_RUNTIME_ROUTE_PREFIX}/${entry.name}.${entry.hash}.js` : null
}

const STATIC_FILE_RE = /^([a-z0-9-]+)\.([a-f0-9]{12})\.js$/

/**
 * `current: false` = hash from an older deploy (HTML kept in browser cache);
 * serve today's body under a short cache instead of a 404 that drops the feature.
 */
export function staticShopRuntimeForFile(file: string): { body: string; current: boolean } | null {
  const match = STATIC_FILE_RE.exec(String(file || '').trim().toLowerCase())
  if (!match) return null
  const entry = staticRuntimeRegistry().byName.get(match[1])
  if (!entry) return null
  return { body: entry.body, current: entry.hash === match[2] }
}
