/**
 * Category listing visual HTML is one shared shell per device (`collection.html`).
 * Live `/c/{path}` rebinds title, breadcrumb, and catalog categoryId so every
 * category keeps its own content while header/layout stay in sync with home.
 */

import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteHomePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export type LiveCategoryListingCrumb = {
  path: string
  name: string
}

export type LiveCategoryListingBind = {
  id: string
  path: string
  name: string
  description?: string | null
  seoBody?: string | null
  ancestors?: LiveCategoryListingCrumb[] | null
}

function stampOpenAttr(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${escapeAttr(value)}"`)
  return open.replace(/>$/, ` ${name}="${escapeAttr(value)}">`)
}

function breadcrumbInnerHtml(
  listing: LiveCategoryListingBind,
  locale: WebLocale,
  siteSlug: string
): string {
  const t = getPartnerSiteShopCopy(locale)
  const home = siteSlug ? partnerSiteHomePath(siteSlug) : '/'
  const crumbs = (listing.ancestors ?? []).filter((c) => String(c.name || '').trim())
  const parts = [
    `<a href="${escapeAttr(home)}" data-pw-el="${PW_EL.crumb}">${escapeHtml(t.navHome)}</a>`,
    ...crumbs.map((c) => {
      const href = partnerSiteCategoryPath(siteSlug, c.path)
      return `<span aria-hidden="true">/</span><a href="${escapeAttr(href)}" data-pw-el="${PW_EL.crumb}">${escapeHtml(c.name)}</a>`
    }),
    `<span aria-hidden="true">/</span><span data-pw-el="${PW_EL.crumb}">${escapeHtml(listing.name)}</span>`,
  ]
  return parts.join('')
}

function replaceMainHeading(html: string, name: string): string {
  return html.replace(
    /(<main\b[\s\S]*?<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/i,
    `$1${escapeHtml(name)}$3`
  )
}

function replaceLead(html: string, description: string): string {
  if (description) {
    const withText = html.replace(
      /(<header\b[^>]*pw-page-head[\s\S]*?<p\b[^>]*pw-muted[^>]*>)([\s\S]*?)(<\/p>)/i,
      `$1${escapeHtml(description)}$3`
    )
    if (withText !== html) return withText
    return html.replace(
      /(<header\b[^>]*pw-page-head[^>]*>)([\s\S]*?)(<\/header>)/i,
      `$1$2<p class="pw-muted" data-pw-el="${PW_EL.body}">${escapeHtml(description)}</p>$3`
    )
  }
  return html.replace(
    /<p\b[^>]*pw-muted[^>]*>[\s\S]*?<\/p>/i,
    (block, offset, source: string) => {
      const before = source.slice(0, offset)
      if (!/<header\b[^>]*pw-page-head[\s\S]*$/i.test(before)) return block
      return ''
    }
  )
}

function stampListingCatalog(html: string, listing: LiveCategoryListingBind, siteSlug: string): string {
  const href = partnerSiteCategoryPath(siteSlug, listing.path)
  return html.replace(/<(section|div)\b[^>]*\bdata-pw-catalog\b[^>]*>/gi, (open) => {
    if (/\bdata-pw-personalize\s*=/.test(open)) return open
    if (/\bdata-pw-related\s*=/.test(open)) return open
    if (/\bdata-pw-outfit\s*=/.test(open)) return open
    let next = stampOpenAttr(open, 'data-category-id', listing.id)
    next = stampOpenAttr(next, 'data-pw-listing-href', href)
    return next
  })
}

function ensureSeoBody(html: string, seoBody: string): string {
  const body = seoBody.trim()
  if (!body) {
    return html.replace(/<section\b[^>]*data-pw-listing-seo="1"[^>]*>[\s\S]*?<\/section>/i, '')
  }
  const block = `<section data-pw-listing-seo="1" data-pw-region="${PW_REGION.content}" aria-label="SEO"><p class="pw-muted" style="white-space:pre-line">${escapeHtml(body)}</p></section>`
  if (/data-pw-listing-seo="1"/.test(html)) {
    return html.replace(
      /<section\b[^>]*data-pw-listing-seo="1"[^>]*>[\s\S]*?<\/section>/i,
      block
    )
  }
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${block}</main>`)
  return `${html}${block}`
}

export function bindLiveCategoryListingToHtml(
  html: string,
  listing: LiveCategoryListingBind | null | undefined,
  opts?: { locale?: WebLocale; siteSlug?: string }
): string {
  const id = String(listing?.id || '').trim()
  const path = String(listing?.path || '').trim()
  const name = String(listing?.name || '').trim()
  if (!html || !id || !path || !name) return html
  const locale = opts?.locale || 'vi'
  const siteSlug = String(opts?.siteSlug || '').trim()
  const description = String(listing?.description || '').trim()
  let out = html
  out = replaceMainHeading(out, name)
  out = replaceLead(out, description)
  out = out.replace(
    /(<nav\b[^>]*data-pw-region=["']breadcrumb["'][^>]*>)([\s\S]*?)(<\/nav>)/i,
    `$1${breadcrumbInnerHtml({ ...listing, id, path, name }, locale, siteSlug)}$3`
  )
  out = stampListingCatalog(out, { ...listing, id, path, name }, siteSlug)
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(name)}</title>`)
  out = ensureSeoBody(out, String(listing?.seoBody || ''))
  return out
}
