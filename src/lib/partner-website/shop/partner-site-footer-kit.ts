/**
 * Footer kit — ẩn/hiện khối gốc (logo, 4 cột, copyright) + từng link nhỏ như Head.
 * Không xóa mục stock. Không thêm phần tử bằng dấu + / Thêm vào chân trang.
 */
import { isPartnerSiteNavHrefKey, type PartnerSiteNavHrefKey } from '@/lib/partner-website/shop/partner-site-nav-footer'

export const PW_FOOTER_KIT_ATTR = 'data-pw-footer-kit'

export const PW_FOOTER_KIT_MOIT = 'moit'
export const PW_FOOTER_MOIT_HREF = 'https://online.gov.vn/'

export const PW_FOOTER_KIT_NEWSLETTER = 'newsletter'

export const PW_FOOTER_KIT_STOCK = [
  'brand',
  'newsletter',
  'col:shop',
  'col:shopping',
  'col:support',
  'col:legal',
  'copyright',
  PW_FOOTER_KIT_MOIT,
] as const

export type PwFooterKitStockKind = (typeof PW_FOOTER_KIT_STOCK)[number]

export const PW_FOOTER_LINK_KIT_MATCHERS: { key: PartnerSiteNavHrefKey; re: string }[] = [
  { key: 'size-guide', re: '/size-guide(?:/|$|\\?|#)' },
  { key: 'sale', re: '/kho-sale(?:/|$|\\?|#)' },
  { key: 'wishlist', re: '/wishlist(?:/|$|\\?|#)' },
  { key: 'products', re: '/products(?:/|$|\\?|#)' },
  { key: 'shipping', re: '/shipping(?:/|$|\\?|#)' },
  { key: 'returns', re: '/returns(?:/|$|\\?|#)' },
  { key: 'payment', re: '/payment(?:/|$|\\?|#)' },
  { key: 'privacy', re: '/privacy(?:/|$|\\?|#)' },
  { key: 'terms', re: '/terms(?:/|$|\\?|#)' },
  { key: 'orders', re: '/orders(?:/|$|\\?|#)' },
  { key: 'account', re: '/account(?:/|$|\\?|#)' },
  { key: 'contact', re: '/contact(?:/|$|\\?|#)' },
  { key: 'about', re: '/about(?:/|$|\\?|#)' },
  { key: 'stores', re: '/stores(?:/|$|\\?|#)' },
  { key: 'lookbook', re: '/lookbook(?:/|$|\\?|#)' },
  { key: 'faq', re: '/faq(?:/|$|\\?|#)' },
  { key: 'cart', re: '/cart(?:/|$|\\?|#)' },
  { key: 'blog', re: '/blog(?:/|$|\\?|#)' },
]

export function footerLinkKitKind(hrefKey: PartnerSiteNavHrefKey): `link:${PartnerSiteNavHrefKey}` {
  return `link:${hrefKey}`
}

export function footerLinkKitHrefKey(kind: string): PartnerSiteNavHrefKey | null {
  if (!kind.startsWith('link:')) return null
  const key = kind.slice(5)
  return isPartnerSiteNavHrefKey(key) ? key : null
}

export function isPwFooterKitLinkKind(kind: string): boolean {
  return footerLinkKitHrefKey(kind) != null || /^link:extra-\d+$/.test(kind)
}

export function inferFooterLinkKitKind(href: string): `link:${PartnerSiteNavHrefKey}` | null {
  const raw = String(href || '').trim()
  if (!raw || raw === '#') return null
  for (const row of PW_FOOTER_LINK_KIT_MATCHERS) {
    if (new RegExp(row.re, 'i').test(raw)) return footerLinkKitKind(row.key)
  }
  const path = raw.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0]
  if (path === '/' || /^\/site\/[^/]+\/?$/i.test(path)) return 'link:home'
  return null
}

const COL_KINDS = ['col:shop', 'col:shopping', 'col:support', 'col:legal'] as const
type FooterColKitKind = (typeof COL_KINDS)[number]

export function isPwFooterKitStockKind(v: string): v is PwFooterKitStockKind {
  return (PW_FOOTER_KIT_STOCK as readonly string[]).includes(v)
}

export function inferFooterColumnKitKind(html: string): FooterColKitKind | null {
  const score: Record<FooterColKitKind, number> = {
    'col:shop': 0,
    'col:shopping': 0,
    'col:support': 0,
    'col:legal': 0,
  }
  const hit = (kind: FooterColKitKind, n: number) => {
    score[kind] += n
  }
  if (/\/(privacy|terms)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:legal', 4)
  if (/\/(faq|shipping|returns)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 3)
  if (/\/payment(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 1)
  if (/\/(products|kho-sale|wishlist|size-guide)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:shopping', 3)
  if (/\/(about|contact|stores|lookbook|blog)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:shop', 3)
  if (/\/(cart|orders|account)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 1)
  const text = html.replace(/<[^>]+>/g, ' ').toLowerCase()
  if (/chính sách|privacy|terms|ポリシー|정책|政策/.test(text)) hit('col:legal', 2)
  if (/hỗ trợ|support|サポート|지원|支持/.test(text)) hit('col:support', 2)
  if (/mua sắm|shopping|ショッピング|쇼핑|购物/.test(text)) hit('col:shopping', 2)
  if (/cửa hàng|店铺|ショップ|스토어/.test(text) && !/mua sắm|shopping/.test(text)) hit('col:shop', 2)
  let best: FooterColKitKind | null = null
  let bestN = 0
  for (const kind of COL_KINDS) {
    if (score[kind] > bestN) {
      best = kind
      bestN = score[kind]
    }
  }
  return bestN > 0 ? best : null
}

function withKitAttr(openTag: string, kind: string): string {
  if (/\bdata-pw-footer-kit=/i.test(openTag)) return openTag
  return openTag.replace(/>$/, ` ${PW_FOOTER_KIT_ATTR}="${kind}">`)
}

function stampFooterKitInFooterBlock(block: string): string {
  let next = block.replace(/<div\b([^>]*\bpw-shop-footer-brand\b[^>]*)>/gi, (full) => withKitAttr(full, 'brand'))
  next = next.replace(/<(form|div)\b([^>]*\b(?:pw-newsletter|data-pw-newsletter)[^>]*)>/gi, (full) =>
    withKitAttr(full, 'newsletter')
  )
  next = next.replace(/<(div|p|section)\b([^>]*\bdata-pw-el=["']copyright["'][^>]*)>/gi, (full) =>
    withKitAttr(full, 'copyright')
  )
  const used = new Set<string>()
  next = next.replace(
    /<nav\b([^>]*?(?:pw-shop-footer-col|pw-footer-col|data-pw-el=["']col["'])[^>]*)>([\s\S]*?)<\/nav>/gi,
    (full, _attrs: string, inner: string) => {
      const existing = /data-pw-footer-kit=["']([^"']+)["']/i.exec(full)
      if (existing?.[1]) {
        used.add(existing[1])
        return full
      }
      const inferred = inferFooterColumnKitKind(full)
      let kind: string | null = inferred && !used.has(inferred) ? inferred : null
      if (!kind) {
        for (const cand of COL_KINDS) {
          if (!used.has(cand)) {
            kind = cand
            break
          }
        }
      }
      if (!kind) return full
      used.add(kind)
      const close = full.indexOf('>')
      if (close < 0) return full
      return `${withKitAttr(full.slice(0, close + 1), kind)}${inner}</nav>`
    }
  )
  const usedLinks = new Set<string>()
  next = next.replace(/<a\b([^>]*)>/gi, (full) => {
    if (/\bdata-pw-footer-kit=/i.test(full)) {
      const have = /data-pw-footer-kit=["']([^"']+)["']/i.exec(full)
      if (have?.[1]) usedLinks.add(have[1])
      return full
    }
    if (/\bdata-pw-footer-added=/i.test(full)) return full
    if (/\bdata-pw-el=["']logo["']/i.test(full)) return full
    if (/\bpw-shop-footer-moit\b/i.test(full) || /online\.gov\.vn/i.test(full)) {
      if (!usedLinks.has(PW_FOOTER_KIT_MOIT)) {
        usedLinks.add(PW_FOOTER_KIT_MOIT)
        return withKitAttr(full, PW_FOOTER_KIT_MOIT)
      }
    }
    if (!/\bdata-pw-el=["']link["']/i.test(full)) return full
    const href = /href=["']([^"']*)["']/i.exec(full)?.[1] || ''
    if (/online\.gov\.vn/i.test(href) && !usedLinks.has(PW_FOOTER_KIT_MOIT)) {
      usedLinks.add(PW_FOOTER_KIT_MOIT)
      return withKitAttr(full, PW_FOOTER_KIT_MOIT)
    }
    const inferred = inferFooterLinkKitKind(href)
    let kind = inferred && !usedLinks.has(inferred) ? inferred : ''
    if (!kind) {
      let n = 1
      while (usedLinks.has(`link:extra-${n}`)) n += 1
      kind = `link:extra-${n}`
    }
    usedLinks.add(kind)
    return withKitAttr(full, kind)
  })
  let addedI = 0
  next = next.replace(/<([a-z][a-z0-9]*)(\b[^>]*\bdata-pw-footer-added=["']1["'][^>]*)>/gi, (full) => {
    if (/\bdata-pw-footer-kit=/i.test(full)) return full
    addedI += 1
    return withKitAttr(full, `added:${addedI}`)
  })
  return next
}

/** Idempotent. Stamps kit ids on factory / leftover footer cells. */
export function stampFooterKitInHtml(html: string): string {
  if (!html || !/<footer\b/i.test(html)) return html
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, stampFooterKitInFooterBlock)
}
