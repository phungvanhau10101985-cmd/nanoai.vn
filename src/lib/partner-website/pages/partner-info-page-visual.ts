import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { WebLocale } from '@/lib/i18n/config'
import {
  adsPlatformPolicyParagraph,
  contentHasAdsPlatformPolicy,
  isPartnerSiteAdsPolicyPageKey,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import {
  cmsVisualHtmlPath,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
  VISUAL_DEVICE_VARIANTS,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { splitStaticPageContentToParagraphs } from '@/lib/partner-website/pages/partner-static-page-types'
import {
  isPartnerTextArticlePage,
  isPartnerTextArticlePageKey,
  isVisualInfoCmsPageKey,
  stampPartnerTextArticleMarkersInHtml,
  PW_TEXT_ARTICLE_ATTR,
} from '@/lib/partner-website/pages/partner-text-article-page'

/** Shop text pages edited in Sửa nhanh and mirrored to CMS. */
export const VISUAL_INFO_CMS_SLUG_BY_PAGE: Partial<Record<PartnerWebsitePageKey, string>> = {
  about: 'about',
  contact: 'contact',
  faq: 'faq',
  sale: 'sale',
  lookbook: 'lookbook',
  blog: 'blog',
  stores: 'stores',
  size_guide: 'size-guide',
  shipping: 'shipping',
  returns: 'returns',
  payment: 'payment',
  privacy: 'privacy',
  terms: 'terms',
  thank_you: 'thank-you',
}

/** @deprecated Dùng isPartnerTextArticlePageKey / isPartnerTextArticlePage — giữ alias CMS rộng. */
export function isVisualInfoContentPageKey(pageKey: string | null | undefined): boolean {
  return isVisualInfoCmsPageKey(pageKey)
}

/** Trang chữ blog/policy — ô AI + schema Article (không gồm sale/lookbook). */
export function isVisualTextArticlePageKey(pageKey: string | null | undefined): boolean {
  return isPartnerTextArticlePageKey(pageKey)
}

export function visualInfoPageCmsSlug(
  pageKey: PartnerWebsitePageKey | null | undefined,
  cmsSlug?: string | null
): string {
  const custom = cmsSlug?.trim().toLowerCase() || ''
  if (custom) return custom
  if (!pageKey) return ''
  return VISUAL_INFO_CMS_SLUG_BY_PAGE[pageKey] || ''
}

export function visualEditSelectValueFromCmsSlug(slug: string): string {
  const key = cmsSlugToVisualPageKey(slug)
  return key || `cms:${slug.trim().toLowerCase()}`
}

export function cmsSlugToVisualPageKey(slug: string): PartnerWebsitePageKey | null {
  const raw = slug.trim().toLowerCase()
  for (const [key, value] of Object.entries(VISUAL_INFO_CMS_SLUG_BY_PAGE)) {
    if (value === raw) return key as PartnerWebsitePageKey
  }
  return null
}

export function cmsSlugToInfoPageKey(slug: string): PartnerSiteInfoPageKey | null {
  const raw = slug.trim().toLowerCase()
  if (raw === 'size-guide') return 'size-guide'
  if (raw === 'thank-you') return 'thank-you'
  const keys: PartnerSiteInfoPageKey[] = [
    'about',
    'contact',
    'faq',
    'sale',
    'shipping',
    'returns',
    'privacy',
    'terms',
    'payment',
    'stores',
    'lookbook',
    'blog',
  ]
  return keys.includes(raw as PartnerSiteInfoPageKey) ? (raw as PartnerSiteInfoPageKey) : null
}

export type InfoPageCmsExtract = {
  title: string
  content: string
  seoTitle: string
  seoDescription: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Gắn đoạn tuân thủ Google Merchant / Facebook / TikTok vào HTML trang chính sách (idempotent). */
export function ensureAdsPlatformPolicyInHtml(
  html: string,
  locale: WebLocale,
  pageKey?: string | null
): string {
  if (!html.trim()) return html
  const isPolicyPage =
    isPartnerSiteAdsPolicyPageKey(pageKey) ||
    /data-pw-article-kind=["']policy["']/i.test(html)
  if (!isPolicyPage) return html
  if (contentHasAdsPlatformPolicy(html)) return html

  const pHtml = `<p data-pw-el="body" data-pw-ads-policy="1">${escapeHtml(adsPlatformPolicyParagraph(locale))}</p>`
  if (/data-pw-info-body/i.test(html)) {
    return html.replace(
      /<(div|section|article)\b([^>]*\bdata-pw-info-body\b[^>]*)>([\s\S]*?)<\/\1>/i,
      (_m, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner}${pHtml}</${tag}>`
    )
  }
  if (/data-pw-region=["']content["']/i.test(html)) {
    return html.replace(
      /<(article|section|div|main)\b([^>]*\bdata-pw-region=["']content["'][^>]*)>([\s\S]*?)<\/\1>/i,
      (_m, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner}${pHtml}</${tag}>`
    )
  }
  return html
}

function innerTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|li|details|summary|article)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function pickAttrBlock(html: string, attrNeedle: string): string {
  const re = new RegExp(
    `<([a-z0-9]+)([^>]*${attrNeedle}[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'i'
  )
  return html.match(re)?.[3] || ''
}

export function isInfoVisualHtml(html: string): boolean {
  return isPartnerTextArticlePage({ html }) || (
    /data-pw-page=["']info["']/i.test(html) ||
    /data-pw-info-article/i.test(html) ||
    /data-pw-info-title/i.test(html) ||
    new RegExp(`\\b${PW_TEXT_ARTICLE_ATTR}=["']1["']`, 'i').test(html) ||
    /class=["'][^"']*\bpw-shop-info\b/i.test(html)
  )
}

export function extractInfoPageCmsFromHtml(html: string): InfoPageCmsExtract {
  const titleHtml =
    pickAttrBlock(html, 'data-pw-info-title') ||
    html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    ''
  const title = innerTextFromHtml(titleHtml).trim().slice(0, 200)
  const bodyHtml =
    pickAttrBlock(html, 'data-pw-info-body') ||
    pickAttrBlock(html, 'data-pw-region="content"') ||
    pickAttrBlock(html, "data-pw-region='content'") ||
    html.match(/<article\b[^>]*class=["'][^"']*\bpw-shop-info\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    ''
  let content = innerTextFromHtml(bodyHtml)
  if (title && content.toLowerCase().startsWith(title.toLowerCase())) {
    content = content.slice(title.length).trim()
  }
  content = content.slice(0, 20000)
  const metaDesc =
    html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ||
    html.match(/data-pw-seo-description=["']([^"']*)["']/i)?.[1] ||
    ''
  const seoDescription = (metaDesc.trim() || splitStaticPageContentToParagraphs(content)[0] || title)
    .slice(0, 500)
  const docTitle = innerTextFromHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()
  return {
    title: title || docTitle.slice(0, 200) || 'Page',
    content,
    seoTitle: (docTitle || title).slice(0, 200),
    seoDescription,
  }
}

function paragraphsToBodyHtml(content: string): string {
  const parts = splitStaticPageContentToParagraphs(content)
  if (!parts.length) return '<p data-pw-el="body"></p>'
  return parts.map((p) => `<p data-pw-el="body">${escapeHtml(p)}</p>`).join('\n')
}

export function applyInfoPageCmsToHtml(
  html: string,
  input: { title: string; content: string; seoTitle?: string; seoDescription?: string }
): string {
  let out = stampPartnerSiteInfoPageSeoInHtml(html, { title: input.title })
  const title = input.title.trim().slice(0, 200)
  const seoTitle = (input.seoTitle || title).trim().slice(0, 200)
  const seoDescription = (input.seoDescription || splitStaticPageContentToParagraphs(input.content)[0] || title)
    .trim()
    .slice(0, 500)
  const bodyInner = paragraphsToBodyHtml(input.content)

  if (/<h1\b[^>]*\bdata-pw-info-title\b/i.test(out)) {
    out = out.replace(
      /<(h1)\b([^>]*\bdata-pw-info-title\b[^>]*)>[\s\S]*?<\/\1>/i,
      `<h1$2>${escapeHtml(title)}</h1>`
    )
  } else {
    out = out.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${escapeHtml(title)}</h1>`)
  }

  if (/data-pw-info-body/i.test(out)) {
    out = out.replace(
      /<(div|section|article)\b([^>]*\bdata-pw-info-body\b[^>]*)>([\s\S]*?)<\/\1>/i,
      (_m, _tag: string, attrs: string, inner: string) => {
        const keptTitle = /data-pw-info-title/i.test(inner)
          ? inner.match(/<h1\b[\s\S]*?<\/h1>/i)?.[0] || ''
          : ''
        return `<div${attrs}>${keptTitle}${bodyInner}</div>`
      }
    )
  }

  if (/<title\b/i.test(out)) {
    out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seoTitle)}</title>`)
  }
  if (/<meta\b[^>]*name=["']description["']/i.test(out)) {
    out = out.replace(
      /<meta\b([^>]*name=["']description["'][^>]*)>/i,
      (_m, attrs: string) => {
        if (/\bcontent=/i.test(attrs)) {
          return `<meta${attrs.replace(/\bcontent=(["'])[\s\S]*?\1/i, `content="${escapeHtml(seoDescription)}"`)}>`
        }
        return `<meta${attrs} content="${escapeHtml(seoDescription)}">`
      }
    )
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(
      /<\/head>/i,
      `<meta name="description" content="${escapeHtml(seoDescription)}">\n</head>`
    )
  }

  if (/\bdata-pw-seo-description=/i.test(out)) {
    out = out.replace(
      /\bdata-pw-seo-description=(["'])[\s\S]*?\1/i,
      `data-pw-seo-description="${escapeHtml(seoDescription)}"`
    )
  }
  return out
}

function ensureAttr(openTag: string, name: string, value?: string): string {
  if (new RegExp(`\\b${name}(?:\\s|=|$)`, 'i').test(openTag)) return openTag
  const assignment = value != null ? ` ${name}="${escapeHtml(value)}"` : ` ${name}`
  return openTag.replace(/>$/, `${assignment}>`)
}

function stampFirstContentH1(fragment: string): string {
  return fragment.replace(/<(h1)\b([^>]*)>/i, (_full, _tag: string, attrs: string) => {
    let next = `<h1${attrs}>`
    next = ensureAttr(next, 'data-pw-el', 'heading')
    next = ensureAttr(next, 'data-pw-info-title', '1')
    return next
  })
}

/** Stamp SEO content hooks onto an info-page visual HTML (Sửa nhanh = CMS source). */
export function stampPartnerSiteInfoPageSeoInHtml(
  html: string,
  opts?: { title?: string; pageKey?: string | null; cmsSlug?: string | null }
): string {
  if (!html.trim()) return html
  if (
    !isInfoVisualHtml(html) &&
    !isPartnerTextArticlePage({ pageKey: opts?.pageKey, cmsSlug: opts?.cmsSlug, html }) &&
    !/data-pw-region=["']content["']/i.test(html)
  ) {
    return html
  }
  let out = html
  out = out.replace(
    /<(article|section|div|main)\b([^>]*\bdata-pw-region=["']content["'][^>]*)>/i,
    (full) => ensureAttr(full, 'data-pw-info-article', '1')
  )
  const contentOpen = out.search(/<(article|section|div|main)\b[^>]*\bdata-pw-region=["']content["']/i)
  if (contentOpen >= 0) {
    const before = out.slice(0, contentOpen)
    let after = out.slice(contentOpen)
    after = stampFirstContentH1(after)
    if (!/data-pw-info-body/i.test(after)) {
      after = after.replace(
        /<(article|section|div|main)\b([^>]*\bdata-pw-region=["']content["'][^>]*)>([\s\S]*?)<\/\1>/i,
        (full, tag: string, attrs: string, inner: string) => {
          const stamped = stampFirstContentH1(inner)
          const close = stamped.search(/<\/h1>/i)
          if (close >= 0) {
            const head = stamped.slice(0, close + 5)
            const rest = stamped.slice(close + 5)
            return `<${tag}${attrs}>${head}<div data-pw-info-body="1" data-pw-el="body">${rest}</div></${tag}>`
          }
          return `<${tag}${attrs}><div data-pw-info-body="1" data-pw-el="body">${stamped}</div></${tag}>`
        }
      )
    }
    out = before + after
  }
  const title = opts?.title?.trim()
  if (title && /<title\b/i.test(out) && /<title\b[^>]*>\s*<\/title>/i.test(out)) {
    out = out.replace(/<title\b[^>]*>\s*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  }
  return stampPartnerTextArticleMarkersInHtml(out, {
    pageKey: opts?.pageKey,
    cmsSlug: opts?.cmsSlug,
  })
}

export function applyInfoPageCmsToWebsiteProject(
  project: PartnerWebsiteProject,
  input: {
    visualPageKey?: PartnerWebsitePageKey | null
    cmsSlug?: string | null
    title: string
    content: string
    seoTitle?: string
    seoDescription?: string
  }
): PartnerWebsiteProject {
  const cmsSlug = input.cmsSlug?.trim() || ''
  const pageKey = input.visualPageKey || null
  let files = project.files
  let changed = false
  for (const variant of VISUAL_DEVICE_VARIANTS as VisualDeviceVariant[]) {
    const path = cmsSlug
      ? cmsVisualHtmlPath(cmsSlug, variant)
      : pageKey
        ? visualEditorHtmlPath(pageKey, variant)
        : ''
    if (!path) continue
    files = files.map((file) => {
      if (file.path !== path || file.kind !== 'html') return file
      const next = applyInfoPageCmsToHtml(file.content, input)
      if (next === file.content) return file
      changed = true
      return { ...file, content: next }
    })
  }
  return changed ? { ...project, files } : project
}
