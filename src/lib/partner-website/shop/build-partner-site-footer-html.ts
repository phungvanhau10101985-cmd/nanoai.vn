/**
 * One engine — full shop footer (logo + 4 link columns + copyright).
 * Sửa nhanh / Xem thử / live đọc cùng HTML. Không vá từng shop.
 */
import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  PARTNER_SITE_FOOTER_COLUMN_ORDER,
  groupPartnerSiteFooterLinks,
  resolvePartnerSiteNavHref,
  visibleSortedNavLinks,
  type PartnerSiteFooterColumnId,
  type PartnerSiteNavHrefKey,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { getPartnerSiteCategoryNavLabels, getPartnerSiteShopNavPaths } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { partnerSiteInfoPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_FOOTER_KIT_ATTR, footerLinkKitKind, stampFooterKitInHtml } from '@/lib/partner-website/shop/partner-site-footer-kit'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const PW_FOOTER_FULL_ATTR = 'data-pw-footer'
export const PW_FOOTER_FULL_VALUE = 'full'

const FOOTER_OPEN_RE =
  /<(footer|div)\b(?=[^>]*?(?:data-pw-region=["']footer["']|class=["'][^"']*\b(?:pw-footer|pw-shop-footer)(?![\w-])))[^>]*>/i

function footerLabel(locale: WebLocale, hrefKey: PartnerSiteNavHrefKey, override?: string | null): string {
  if (override?.trim()) return override.trim()
  const t = getPartnerSiteShopCopy(locale)
  const n = getPartnerSiteCategoryNavLabels(locale)
  const map: Record<PartnerSiteNavHrefKey, string> = {
    home: t.navHome,
    products: t.navProducts,
    sale: n.sale,
    wishlist: t.navFavorites,
    cart: t.navCart,
    orders: t.navOrders,
    account: t.navAccount,
    about: n.about,
    contact: n.contact,
    faq: n.faq,
    shipping: n.shipping,
    returns: n.returns,
    privacy: n.privacy,
    terms: n.terms,
    payment: n.payment,
    stores: n.stores,
    lookbook: n.lookbook,
    'size-guide': n.sizeGuide,
    blog: n.blog,
  }
  return map[hrefKey] || hrefKey
}

function columnTitle(locale: WebLocale, colId: PartnerSiteFooterColumnId): string {
  const t = getPartnerSiteShopCopy(locale)
  if (colId === 'shop') return t.footerColShop
  if (colId === 'shopping') return t.footerColShopping
  if (colId === 'support') return t.footerColSupport
  return t.footerColLegal
}

function inferBrandFromHtml(html: string, fallback: string): string {
  const copyright = html.match(/data-pw-el=["']copyright["'][^>]*>([\s\S]*?)</i)
  const fromCopy = copyright?.[1]?.replace(/<[^>]+>/g, '').match(/©\s*\d{4}\s+([^.]+)/)
  if (fromCopy?.[1]?.trim()) return fromCopy[1].trim()
  const wordmark = html.match(/data-pw-el=["']wordmark["'][^>]*>([\s\S]*?)</i)
  const name = wordmark?.[1]?.replace(/<[^>]+>/g, '').trim()
  if (name) return name
  return fallback
}

function inferLogoFromHtml(html: string): string | null {
  const footerLogo = html.match(
    /<(?:footer|div)\b[^>]*(?:data-pw-region=["']footer["']|pw-footer)[\s\S]{0,4000}?<img[^>]+src=["']([^"']+)["']/i
  )
  if (footerLogo?.[1]?.trim()) return footerLogo[1].trim()
  const headerLogo = html.match(/data-pw-el=["']logo["'][^>]*src=["']([^"']+)["']/i)
  return headerLogo?.[1]?.trim() || null
}

function extractFooterRange(html: string): { start: number; end: number; html: string } | null {
  const masked = html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
  const open = FOOTER_OPEN_RE.exec(masked)
  if (!open || open.index == null) return null
  const tag = (open[1] || 'footer').toLowerCase()
  const start = open.index
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = start + open[0].length
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) {
        const closeTok = html.slice(match.index).match(new RegExp(`^</${tag}\\s*>`, 'i'))
        const end = match.index + (closeTok?.[0].length ?? `</${tag}>`.length)
        return { start, end, html: html.slice(start, end) }
      }
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return null
}

export function isSkeletalPartnerSiteFooter(footerHtml: string): boolean {
  if (!footerHtml.trim()) return true
  if (new RegExp(`${PW_FOOTER_FULL_ATTR}=["']${PW_FOOTER_FULL_VALUE}["']`).test(footerHtml)) return false
  const cols = footerHtml.match(/data-pw-el=["']col["']/g)?.length ?? 0
  const links = footerHtml.match(/data-pw-el=["']link["']/g)?.length ?? 0
  return cols <= 1 || links < 8
}

export function buildPartnerSiteFooterHtml(input: {
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
}): string {
  const locale = input.locale
  const slug = input.siteSlug.trim()
  const brand = input.brand.trim() || slug || 'Shop'
  const t = getPartnerSiteShopCopy(locale)
  const paths = slug
    ? getPartnerSiteShopNavPaths(slug)
    : {
        home: '/',
        products: '#products',
        sale: '#sale',
        wishlist: '#wishlist',
        cart: '#cart',
        orders: '#orders',
        account: '#account',
        login: '#login',
        addresses: '#addresses',
        recentlyViewed: '#recent',
        contact: '#contact',
      }
  const infoPath = (key: string) =>
    slug ? partnerSiteInfoPath(slug, key as Parameters<typeof partnerSiteInfoPath>[1]) : `/${key}`
  const groups = groupPartnerSiteFooterLinks(visibleSortedNavLinks(DEFAULT_PARTNER_SITE_FOOTER_LINKS))
  const year = String(new Date().getFullYear())
  const copyright = t.footerCopyright.replace('{year}', year).replace('{shop}', brand)
  const homeHref = escapeAttr(paths.home)
  const logo = input.logoUrl?.trim()
    ? `<a href="${homeHref}"><img class="pw-shop-footer-logo" ${pwElAttr(PW_EL.logo)} src="${escapeAttr(input.logoUrl)}" alt="${escapeHtml(brand)}" /></a>`
    : ''

  const cols = PARTNER_SITE_FOOTER_COLUMN_ORDER.map((colId) => {
    const items = groups[colId]
    if (!items.length) return ''
    const heading = columnTitle(locale, colId)
    const lis = items
      .map((item) => {
        const href = escapeAttr(resolvePartnerSiteNavHref(item.hrefKey, paths, infoPath))
        const label = escapeHtml(footerLabel(locale, item.hrefKey, item.labelOverride))
        return `<li><a href="${href}" ${pwElAttr(PW_EL.link)} ${PW_FOOTER_KIT_ATTR}="${footerLinkKitKind(item.hrefKey)}">${label}</a></li>`
      })
      .join('')
    return `<nav class="pw-shop-footer-col pw-footer-col" ${pwElAttr(PW_EL.col)} ${PW_FOOTER_KIT_ATTR}="col:${colId}" aria-label="${escapeAttr(heading)}">
      <h3>${escapeHtml(heading)}</h3>
      <ul>${lis}</ul>
    </nav>`
  }).join('')

  return `<footer class="pw-footer pw-shop-footer" ${pwRegionAttr(PW_REGION.footer)} data-pw-bg-role="footer" data-pw-token="footer" ${PW_FOOTER_FULL_ATTR}="${PW_FOOTER_FULL_VALUE}">
  <div class="pw-container pw-footer-grid pw-shop-footer-inner">
    <div class="pw-shop-footer-brand" ${PW_FOOTER_KIT_ATTR}="brand">
      ${logo}
      <p class="pw-shop-footer-name">${escapeHtml(brand)}</p>
      <p class="pw-shop-footer-hint">${escapeHtml(t.footerBrandHint)}</p>
    </div>
    ${cols}
  </div>
  <div class="pw-shop-footer-bar pw-footer-bottom" ${pwElAttr(PW_EL.copyright)} ${PW_FOOTER_KIT_ATTR}="copyright">
    <p>${escapeHtml(copyright)}</p>
    <p>${escapeHtml(t.footerPaymentHint)}</p>
  </div>
</footer>`
}

/** Upgrade blank / policy-only footers. Keep a footer already marked full. */
export function ensureFullPartnerSiteFooterInHtml(
  html: string,
  input: {
    locale?: WebLocale | null
    siteSlug?: string | null
    brand?: string | null
    logoUrl?: string | null
  }
): string {
  if (!html.trim()) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''
  if (!siteSlug) return stampFooterKitInHtml(html)
  const found = extractFooterRange(html)
  if (found && !isSkeletalPartnerSiteFooter(found.html)) return stampFooterKitInHtml(html)
  const brand = (input.brand?.trim() || inferBrandFromHtml(html, siteSlug || 'Shop')).trim()
  const logoUrl = input.logoUrl?.trim() || inferLogoFromHtml(html)
  const next = buildPartnerSiteFooterHtml({ locale, siteSlug, brand, logoUrl })
  if (!found) {
    const beforeNav = html.search(/<(nav|div)\b[^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)/i)
    if (beforeNav >= 0) return stampFooterKitInHtml(`${html.slice(0, beforeNav)}${next}\n${html.slice(beforeNav)}`)
    if (/<\/body>/i.test(html)) return stampFooterKitInHtml(html.replace(/<\/body>/i, `${next}\n</body>`))
    return stampFooterKitInHtml(`${html}\n${next}`)
  }
  return stampFooterKitInHtml(`${html.slice(0, found.start)}${next}${html.slice(found.end)}`)
}
