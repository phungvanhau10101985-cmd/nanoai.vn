import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const PW_SLOGAN_ATTR = 'data-pw-slogan'
export const PW_SLOGAN_SEED_ATTR = 'data-pw-seed-slogan'
export const PW_SLOGAN_MAX = 80
export const PW_SLOGAN_PRODUCTS_MAX = 200

const SLOGAN_NODE_RE =
  /<(span|p)\b([^>]*\b(?:data-pw-slogan|data-pw-el=["']slogan["'])[^>]*)>([\s\S]*?)<\/\1>/gi

function decodeHtmlText(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sanitizePartnerShopSlogan(raw: unknown, max = PW_SLOGAN_MAX): string {
  return decodeHtmlText(String(raw ?? '')).slice(0, max)
}

export function sanitizePartnerShopSloganProducts(raw: unknown): string {
  return sanitizePartnerShopSlogan(raw, PW_SLOGAN_PRODUCTS_MAX)
}

export function partnerShopSloganFromTheme(
  theme?: Pick<PartnerWebsiteTheme, 'slogan'> | PartnerWebsiteTheme | null
): string {
  return sanitizePartnerShopSlogan(theme?.slogan)
}

export function partnerShopSloganProductsFromTheme(theme?: PartnerWebsiteTheme | null): string {
  return sanitizePartnerShopSloganProducts(theme?.sloganProducts)
}

function readAttr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))
  return decodeHtmlText(m?.[1] || '')
}

function stampAttr(attrs: string, name: string, value: string): string {
  const token = ` ${name}="${escapeAttr(value)}"`
  if (new RegExp(`\\b${name}=`, 'i').test(attrs)) {
    return attrs.replace(new RegExp(`\\s*\\b${name}=["'][^"']*["']`, 'i'), token)
  }
  return `${attrs}${token}`
}

function setHidden(attrs: string, hidden: boolean): string {
  const userHidden = /\bdata-pw-hidden=["']1["']/i.test(attrs)
  let next = attrs.replace(/(?<![\w-])hidden(?:=["'][^"']*["'])?/gi, '').replace(/\s{2,}/g, ' ')
  if (hidden || userHidden) next = `${next} hidden`
  return next
}

function isFooterHint(attrs: string): boolean {
  return /\bpw-shop-footer-hint\b/.test(attrs)
}

function sloganNodeHtml(tag: 'span' | 'p', attrs: string, text: string, hidden: boolean): string {
  const withEl = /\bdata-pw-el=/.test(attrs) ? attrs : `${attrs} ${pwElAttr(PW_EL.slogan)}`
  const stamped = stampAttr(setHidden(withEl, hidden), PW_SLOGAN_ATTR, '1')
  return `<${tag}${stamped}>${text ? escapeHtml(text) : ''}</${tag}>`
}

export function ensureSloganNodesInHtml(html: string, opts?: { footerSeed?: string }): string {
  if (!html.trim()) return html
  const seed = sanitizePartnerShopSlogan(opts?.footerSeed || '', PW_SLOGAN_PRODUCTS_MAX)
  let next = html

  if (!/<span\b[^>]*\bpw-slogan\b/i.test(next)) {
    const topbarInner =
      /<(div)\b([^>]*\b(?:pw-topbar-inner|pw-shop-topbar-inner)\b[^>]*)>/i.exec(next)
    if (topbarInner && topbarInner.index != null) {
      const insertAt = topbarInner.index + topbarInner[0].length
      const node = sloganNodeHtml('span', ' class="pw-slogan"', '', true)
      next = `${next.slice(0, insertAt)}\n      ${node}${next.slice(insertAt)}`
    }
  }

  if (seed) {
    next = next.replace(
      /<p\b([^>]*\bpw-shop-footer-hint\b[^>]*)>([\s\S]*?)<\/p>/i,
      (full, attrs: string, inner: string) => {
        if (/\bdata-pw-el=["']slogan["']/.test(attrs) || new RegExp(`\\b${PW_SLOGAN_ATTR}=`, 'i').test(attrs)) {
          if (new RegExp(`\\b${PW_SLOGAN_SEED_ATTR}=`, 'i').test(attrs)) return full
          return `<p${stampAttr(attrs, PW_SLOGAN_SEED_ATTR, seed)}>${inner}</p>`
        }
        const stamped = stampAttr(
          stampAttr(`${attrs} ${pwElAttr(PW_EL.slogan)}`, PW_SLOGAN_ATTR, '1'),
          PW_SLOGAN_SEED_ATTR,
          seed
        )
        return `<p${stamped}>${inner}</p>`
      }
    )
  }

  return next
}

export function applySloganInHtml(
  html: string,
  slogan: string,
  opts?: { footerSeed?: string }
): string {
  const ready = ensureSloganNodesInHtml(html, opts)
  const nextSlogan = sanitizePartnerShopSlogan(slogan)
  const fallbackSeed = sanitizePartnerShopSlogan(opts?.footerSeed || '', PW_SLOGAN_PRODUCTS_MAX)
  return ready.replace(SLOGAN_NODE_RE, (_full, tag: string, attrs: string) => {
    const seed = readAttr(attrs, PW_SLOGAN_SEED_ATTR) || fallbackSeed
    if (isFooterHint(attrs)) {
      const text = nextSlogan || seed
      let nextAttrs = attrs
      if (seed && !readAttr(attrs, PW_SLOGAN_SEED_ATTR)) {
        nextAttrs = stampAttr(nextAttrs, PW_SLOGAN_SEED_ATTR, seed)
      }
      return sloganNodeHtml(tag === 'span' ? 'span' : 'p', nextAttrs, text, false)
    }
    return sloganNodeHtml(tag === 'span' ? 'span' : 'p', attrs, nextSlogan, !nextSlogan)
  })
}

export function extractSloganFromHtml(html: string): string {
  let found = ''
  const re = new RegExp(SLOGAN_NODE_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const attrs = match[2] || ''
    const text = decodeHtmlText(match[3] || '')
    const seed = readAttr(attrs, PW_SLOGAN_SEED_ATTR)
    if (isFooterHint(attrs)) {
      if (text && text !== seed) found = text
      continue
    }
    if (text) return sanitizePartnerShopSlogan(text)
  }
  return sanitizePartnerShopSlogan(found)
}

export function applySloganToProject(
  project: PartnerWebsiteProject,
  slogan: string,
  opts?: { footerSeed?: string }
): PartnerWebsiteProject {
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    const next = applySloganInHtml(f.content, slogan, opts)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}

export function bindPartnerShopSloganInHtml(
  html: string,
  theme: Pick<PartnerWebsiteTheme, 'slogan'> | PartnerWebsiteTheme | null | undefined,
  locale: WebLocale = 'vi'
): string {
  const seed = getPartnerSiteShopCopy(locale).footerBrandHint
  return applySloganInHtml(html, partnerShopSloganFromTheme(theme), { footerSeed: seed })
}
