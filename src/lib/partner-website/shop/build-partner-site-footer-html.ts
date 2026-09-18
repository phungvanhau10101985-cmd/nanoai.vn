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
  PARTNER_SITE_FOOTER_LEGAL_HREF_KEYS,
  groupPartnerSiteFooterLinks,
  resolvePartnerSiteNavHref,
  visibleSortedNavLinks,
  type PartnerSiteFooterColumnId,
  type PartnerSiteNavHrefKey,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { getPartnerSiteCategoryNavLabels, getPartnerSiteShopNavPaths } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { partnerSiteInfoPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_FOOTER_KIT_ATTR,
  PW_FOOTER_KIT_MOIT,
  PW_FOOTER_MOIT_HREF,
  footerLinkKitKind,
  stampFooterKitInHtml,
} from '@/lib/partner-website/shop/partner-site-footer-kit'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SLOGAN_ATTR, PW_SLOGAN_SEED_ATTR } from '@/lib/partner-website/shop/partner-site-shop-slogan'

export const PW_FOOTER_FULL_ATTR = 'data-pw-footer'
export const PW_FOOTER_FULL_VALUE = 'full'
export const PW_FOOTER_PAINT_STYLE_ID = 'pw-footer-paint'

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
    'how-to-buy': n.howToBuy,
    'brand-origin': n.brandOrigin,
    'reviews-policy': n.reviewsPolicy,
    trust: n.trust,
    company: n.company,
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

function pinCssDeclImportant(style: string, name: string): string {
  const re = new RegExp(`(${name}\\s*:\\s*)([^;]+)`, 'gi')
  return style.replace(re, (full, prefix: string, value: string) => {
    if (/\s!important\s*$/i.test(value.trim())) return full
    return `${prefix}${value.trim()} !important`
  })
}

function concreteCssColor(value: string): string | null {
  const v = value.replace(/\s*!important\s*$/i, '').trim()
  if (!v || /^var\(/i.test(v) || /^(?:none|transparent|inherit|initial|unset)$/i.test(v)) return null
  if (/^#(?:[0-9a-f]{3,8})$/i.test(v)) return v
  if (/^(?:rgba?|hsla?)\(/i.test(v)) return v
  if (/^[a-z]+$/i.test(v)) return v
  return null
}

function readStyleDecl(style: string, name: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`, 'i')
  return re.exec(style)?.[1]?.trim() || null
}

function firstPaintedFooterColor(html: string): string | null {
  const re =
    /<(footer|div)\b([^>]*?(?:data-pw-region=["']footer["']|[\s"']pw-footer[\s"']|[\s"']pw-shop-footer[\s"'])[^>]*)>/gi
  let found: RegExpExecArray | null
  while ((found = re.exec(html))) {
    const full = found[0]
    if (/\bdata-pw-bg-cleared=["']1["']/i.test(full)) continue
    if (/\bdata-pw-paper=["']image["']/i.test(full)) continue
    const style = full.match(/\bstyle=(["'])([\s\S]*?)\1/i)?.[2] || ''
    const color =
      concreteCssColor(readStyleDecl(style, '--pw-footer') || '') ||
      concreteCssColor(readStyleDecl(style, 'background-color') || '') ||
      concreteCssColor(readStyleDecl(style, 'background') || '')
    if (color) return color
  }
  return null
}

function rewriteLeftoverFooterTokenFallbacks(html: string, painted: string): string {
  return html
    .replace(/var\(\s*--pw-footer\s*,\s*#111827\s*\)/gi, `var(--pw-footer,${painted})`)
    .replace(/var\(\s*--pw-footer-ink\s*,\s*#e5e7eb\s*\)/gi, 'var(--pw-footer-ink,#111827)')
}

function injectFooterPaintStyle(html: string, painted: string): string {
  const hosts =
    ':is(html,body,[data-pw-inline-visual-root],html[data-pw-look],.pw-shop[data-pw-look],[data-pw-inline-visual-root][data-pw-look])'
  const css =
    `:root,html,body,[data-pw-inline-visual-root]{--pw-footer:${painted}!important}` +
    `${hosts} .pw-footer:not([data-pw-bg-cleared="1"]):not([data-pw-paper="image"]),` +
    `${hosts} .pw-shop-footer:not([data-pw-bg-cleared="1"]):not([data-pw-paper="image"]){` +
    `background-color:${painted}!important;background-image:none!important;--pw-footer:${painted}!important;color:#111827!important}`
  const tag = `<style id="${PW_FOOTER_PAINT_STYLE_ID}">${css}</style>`
  let replaced = false
  const out = html.replace(
    new RegExp(`<style\\b[^>]*\\bid=["']${PW_FOOTER_PAINT_STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return tag
    }
  )
  if (replaced) return out
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${tag}</head>`)
  return `${tag}${out}`
}

/** Sửa nhanh paints `--pw-footer` on the element; theme `:root` must not win on live. */
export function pinPaintedFooterThemeVarsInHtml(html: string): string {
  if (!html.trim()) return html
  const pinned = html.replace(
    /<(footer|div)\b([^>]*?(?:data-pw-region=["']footer["']|[\s"']pw-footer[\s"']|[\s"']pw-shop-footer[\s"'])[^>]*)>/gi,
    (full) => {
      if (/\bdata-pw-bg-cleared=["']1["']/i.test(full)) return full
      if (/\bdata-pw-paper=["']image["']/i.test(full)) return full
      if (!/\bstyle=/i.test(full)) return full
      return full.replace(/\bstyle=(["'])([\s\S]*?)\1/i, (_s, q: string, style: string) => {
        let next = style
        if (!/--pw-footer\s*:/i.test(next)) {
          const fromBg =
            concreteCssColor(readStyleDecl(next, 'background-color') || '') ||
            concreteCssColor(readStyleDecl(next, 'background') || '')
          if (fromBg) next = `--pw-footer:${fromBg} !important;${next}`
        }
        const token = concreteCssColor(readStyleDecl(next, '--pw-footer') || '')
        if (token && !/background-color\s*:/i.test(next)) {
          next = `${next};background-color:${token} !important`
        }
        next = pinCssDeclImportant(next, '--pw-footer')
        next = pinCssDeclImportant(next, '--pw-footer-ink')
        next = pinCssDeclImportant(next, 'background-color')
        return `style=${q}${next}${q}`
      })
    }
  )
  const painted = firstPaintedFooterColor(pinned)
  const withFallbacks = painted ? rewriteLeftoverFooterTokenFallbacks(pinned, painted) : pinned
  const withPaint = painted ? injectFooterPaintStyle(withFallbacks, painted) : withFallbacks
  return pinPaintedMoitButtonVarsInHtml(withPaint)
}

function pinPaintedMoitButtonVarsInHtml(html: string): string {
  return html.replace(/<a\b([^>]*\bpw-shop-footer-moit\b[^>]*)>/gi, (full) => {
    if (!/\bstyle=/i.test(full) || !/--pw-btn-color\s*:/i.test(full)) return full
    return full.replace(/\bstyle=(["'])([\s\S]*?)\1/i, (_s, q: string, style: string) => {
      let next = pinCssDeclImportant(style, '--pw-btn-color')
      next = pinCssDeclImportant(next, '--pw-btn-ink')
      next = pinCssDeclImportant(next, 'background')
      next = pinCssDeclImportant(next, 'background-color')
      next = pinCssDeclImportant(next, 'color')
      return `style=${q}${next}${q}`
    })
  })
}

export function isSkeletalPartnerSiteFooter(footerHtml: string): boolean {
  if (!footerHtml.trim()) return true
  if (new RegExp(`${PW_FOOTER_FULL_ATTR}=["']${PW_FOOTER_FULL_VALUE}["']`).test(footerHtml)) return false
  const cols = footerHtml.match(/data-pw-el=["']col["']/g)?.length ?? 0
  const links = footerHtml.match(/data-pw-el=["']link["']/g)?.length ?? 0
  return cols <= 1 || links < 8
}

export function buildFooterNewsletterFormHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<form class="pw-newsletter" data-pw-newsletter="1" data-pw-region="form" ${PW_FOOTER_KIT_ATTR}="newsletter" novalidate>
  <input type="email" name="email" data-pw-el="field" autocomplete="email" placeholder="${escapeAttr(t.footerNewsletterPlaceholder)}" required />
  <button type="submit" data-pw-el="submit">${escapeHtml(t.footerNewsletterSubmit)}</button>
</form>`
}

function injectNewsletterIntoFooterBlock(block: string, locale: WebLocale): string {
  if (/\bdata-pw-newsletter=|\bclass=["'][^"']*\bpw-newsletter\b/i.test(block)) {
    if (!new RegExp(`${PW_FOOTER_KIT_ATTR}=["']newsletter["']`, 'i').test(block)) {
      return block.replace(/<(form|div)\b([^>]*\bpw-newsletter\b[^>]*)>/i, (tag) =>
        /\bdata-pw-footer-kit=/i.test(tag) ? tag : tag.replace(/>$/, ` ${PW_FOOTER_KIT_ATTR}="newsletter">`)
      )
    }
    return block
  }
  const form = buildFooterNewsletterFormHtml(locale)
  if (/<p\b[^>]*\bpw-shop-footer-hint\b/i.test(block)) {
    return block.replace(/(<p\b[^>]*\bpw-shop-footer-hint\b[^>]*>[\s\S]*?<\/p>)/i, `$1\n      ${form}`)
  }
  if (/data-pw-footer-kit=["']brand["']/i.test(block)) {
    return block.replace(
      /(<div class="pw-shop-footer-brand"[^>]*>)([\s\S]*?)(<\/div>)/i,
      (_, open, inner, close) => `${open}${inner}${form}${close}`
    )
  }
  return block
}

export function ensureFooterNewsletterInHtml(html: string, locale: WebLocale = 'vi'): string {
  if (!html || !/<footer\b/i.test(html)) return html
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (block) => injectNewsletterIntoFooterBlock(block, locale))
}

export function buildFooterMoitButtonHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<a class="pw-shop-footer-moit" href="${escapeAttr(PW_FOOTER_MOIT_HREF)}" target="_blank" rel="noopener noreferrer" ${pwElAttr(PW_EL.link)} ${PW_FOOTER_KIT_ATTR}="${PW_FOOTER_KIT_MOIT}">${escapeHtml(t.footerMoitTitle)}</a>`
}

function injectMoitIntoFooterBlock(block: string, locale: WebLocale): string {
  if (new RegExp(`${PW_FOOTER_KIT_ATTR}=["']${PW_FOOTER_KIT_MOIT}["']`, 'i').test(block)) return block
  if (/\bpw-shop-footer-moit\b/i.test(block)) {
    return block.replace(/<a\b([^>]*\bpw-shop-footer-moit\b[^>]*)>/i, (tag) =>
      /\bdata-pw-footer-kit=/i.test(tag) ? tag : tag.replace(/>$/, ` ${PW_FOOTER_KIT_ATTR}="${PW_FOOTER_KIT_MOIT}">`)
    )
  }
  const leftover = /<a\b([^>]*href=["'][^"']*online\.gov\.vn[^"']*["'][^>]*)>/i
  if (leftover.test(block)) {
    return block.replace(leftover, (tag) => {
      let next = /\bpw-shop-footer-moit\b/.test(tag)
        ? tag
        : /\bclass=["']([^"']*)["']/.test(tag)
          ? tag.replace(/class=["']([^"']*)["']/, (_, cls) => `class="${cls} pw-shop-footer-moit"`)
          : tag.replace(/<a\b/i, '<a class="pw-shop-footer-moit"')
      if (!/\bdata-pw-footer-kit=/i.test(next)) {
        next = next.replace(/>$/, ` ${PW_FOOTER_KIT_ATTR}="${PW_FOOTER_KIT_MOIT}">`)
      }
      return next
    })
  }
  const btn = buildFooterMoitButtonHtml(locale)
  const barRe =
    /<(div|section)\b([^>]*?(?:data-pw-el=["']copyright["']|pw-shop-footer-bar|pw-footer-bottom)[^>]*)>([\s\S]*?)<\/\1>/i
  const bar = barRe.exec(block)
  if (bar && bar.index != null) {
    return `${block.slice(0, bar.index)}<${bar[1]}${bar[2]}>${bar[3]}${btn}</${bar[1]}>${block.slice(bar.index + bar[0].length)}`
  }
  return block.replace(/<\/footer>/i, `${btn}\n</footer>`)
}

/** Idempotent. Adds the MoIT notice button to saved / leftover footers. */
export function ensureFooterMoitBadgeInHtml(html: string, locale: WebLocale = 'vi'): string {
  if (!html || !/<footer\b/i.test(html)) return html
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (block) => injectMoitIntoFooterBlock(block, locale))
}

function footerInfoPath(siteSlug: string, key: string): string {
  const slug = siteSlug.trim()
  return slug ? partnerSiteInfoPath(slug, key as Parameters<typeof partnerSiteInfoPath>[1]) : `/${key}`
}

function footerNavPaths(siteSlug: string) {
  const slug = siteSlug.trim()
  return slug
    ? getPartnerSiteShopNavPaths(slug)
    : {
        home: '/',
        products: '/products',
        sale: '/sale',
        wishlist: '/wishlist',
        cart: '/cart',
        orders: '/orders',
        account: '/account',
        login: '/login',
        addresses: '/addresses',
        recentlyViewed: '/recently-viewed',
        contact: '/contact',
      }
}

function legalPolicyLinkHtml(locale: WebLocale, siteSlug: string, hrefKey: PartnerSiteNavHrefKey): string {
  const paths = footerNavPaths(siteSlug)
  const href = escapeAttr(resolvePartnerSiteNavHref(hrefKey, paths, (key) => footerInfoPath(siteSlug, key)))
  const label = escapeHtml(footerLabel(locale, hrefKey, null))
  return `<li><a href="${href}" ${pwElAttr(PW_EL.link)} ${PW_FOOTER_KIT_ATTR}="${footerLinkKitKind(hrefKey)}">${label}</a></li>`
}

function footerHasLegalHref(block: string, hrefKey: PartnerSiteNavHrefKey): boolean {
  if (new RegExp(`${PW_FOOTER_KIT_ATTR}=["']${footerLinkKitKind(hrefKey)}["']`, 'i').test(block)) return true
  const re = new RegExp(`/${hrefKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|"|'|\\?|#|\\s|>)`, 'i')
  return re.test(block)
}

function injectLegalPolicyLinksIntoFooterBlock(block: string, locale: WebLocale, siteSlug: string): string {
  if (!new RegExp(`${PW_FOOTER_FULL_ATTR}=["']${PW_FOOTER_FULL_VALUE}["']`).test(block) && isSkeletalPartnerSiteFooter(block)) {
    return block
  }
  const missing = PARTNER_SITE_FOOTER_LEGAL_HREF_KEYS.filter((key) => !footerHasLegalHref(block, key))
  if (!missing.length) return block
  const linksHtml = missing.map((key) => legalPolicyLinkHtml(locale, siteSlug, key)).join('')
  if (/data-pw-footer-kit=["']col:legal["']/i.test(block)) {
    return block.replace(
      /<nav\b([^>]*data-pw-footer-kit=["']col:legal["'][^>]*)>([\s\S]*?)<\/nav>/i,
      (full) => {
        if (/<\/ul>/i.test(full)) return full.replace(/<\/ul>/i, `${linksHtml}</ul>`)
        return full.replace(/<\/nav>/i, `<ul>${linksHtml}</ul></nav>`)
      }
    )
  }
  const heading = columnTitle(locale, 'legal')
  const col = `<nav class="pw-shop-footer-col pw-footer-col" ${pwElAttr(PW_EL.col)} ${PW_FOOTER_KIT_ATTR}="col:legal" aria-label="${escapeAttr(heading)}">
      <h3>${escapeHtml(heading)}</h3>
      <ul>${linksHtml}</ul>
    </nav>`
  if (/<div\b[^>]*\bpw-shop-footer-bar\b/i.test(block)) {
    return block.replace(/(<div\b[^>]*\bpw-shop-footer-bar\b)/i, `${col}\n  $1`)
  }
  if (/data-pw-footer-kit=["']copyright["']/i.test(block)) {
    return block.replace(/(<(?:div|p|section)\b[^>]*data-pw-footer-kit=["']copyright["'])/i, `${col}\n  $1`)
  }
  return block.replace(/<\/footer>/i, `${col}\n</footer>`)
}

/** Idempotent. Adds missing legal/policy links to saved full footers (how-to-buy, origin, reviews, trust, company). */
export function ensureFooterLegalPolicyLinksInHtml(
  html: string,
  input: { locale?: WebLocale | null; siteSlug?: string | null } = {}
): string {
  if (!html || !/<footer\b/i.test(html)) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (block) =>
    injectLegalPolicyLinksIntoFooterBlock(block, locale, siteSlug)
  )
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
      <p class="pw-shop-footer-hint" ${pwElAttr(PW_EL.slogan)} ${PW_SLOGAN_ATTR}="1" ${PW_SLOGAN_SEED_ATTR}="${escapeAttr(t.footerBrandHint)}">${escapeHtml(t.footerBrandHint)}</p>
      ${buildFooterNewsletterFormHtml(locale)}
    </div>
    ${cols}
  </div>
  <div class="pw-shop-footer-bar pw-footer-bottom" ${pwElAttr(PW_EL.copyright)} ${PW_FOOTER_KIT_ATTR}="copyright">
    <p>${escapeHtml(copyright)}</p>
    <p>${escapeHtml(t.footerPaymentHint)}</p>
    ${buildFooterMoitButtonHtml(locale)}
  </div>
</footer>`
}

function finishFooterKit(html: string, locale: WebLocale, siteSlug = ''): string {
  return ensureFooterNewsletterInHtml(
    ensureFooterLegalPolicyLinksInHtml(ensureFooterMoitBadgeInHtml(stampFooterKitInHtml(html), locale), {
      locale,
      siteSlug,
    }),
    locale
  )
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
  const found = extractFooterRange(html)
  if (!siteSlug) {
    if (found) return finishFooterKit(html, locale, siteSlug)
  } else if (found && !isSkeletalPartnerSiteFooter(found.html)) {
    return finishFooterKit(html, locale, siteSlug)
  }
  const brand = (input.brand?.trim() || inferBrandFromHtml(html, siteSlug || 'Shop')).trim()
  const logoUrl = input.logoUrl?.trim() || inferLogoFromHtml(html)
  const next = buildPartnerSiteFooterHtml({ locale, siteSlug, brand, logoUrl })
  if (!found) {
    const beforeNav = html.search(/<(nav|div)\b[^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)/i)
    if (beforeNav >= 0) {
      return finishFooterKit(`${html.slice(0, beforeNav)}${next}\n${html.slice(beforeNav)}`, locale, siteSlug)
    }
    if (/<\/body>/i.test(html)) {
      return finishFooterKit(html.replace(/<\/body>/i, `${next}\n</body>`), locale, siteSlug)
    }
    return finishFooterKit(`${html}\n${next}`, locale, siteSlug)
  }
  return finishFooterKit(`${html.slice(0, found.start)}${next}${html.slice(found.end)}`, locale, siteSlug)
}
