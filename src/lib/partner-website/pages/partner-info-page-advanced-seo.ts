import {
  extractInfoPageCmsFromHtml,
  isInfoVisualHtml,
} from '@/lib/partner-website/pages/partner-info-page-visual'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

function stripSeoCoachNodes(html: string): string {
  return html
    .replace(/<(aside|div|section)\b[^>]*\bdata-pw-seo-coach\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(aside|div|section)\b[^>]*\bdata-pw-article-editor\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\sdata-pw-article-box=(["'])[\s\S]*?\1/gi, '')
}

/** Bỏ bài AI/CMS rơi sau chân trang — chỉ giữ cột nội dung phía trên. */
export function stripStrayInfoArticlesAfterFooterFromHtml(html: string): string {
  if (!html.trim()) return html
  const closeFooter = html.search(/<\/footer>/i)
  if (closeFooter < 0) return html
  const split = closeFooter + '</footer>'.length
  const before = html.slice(0, split)
  const after = html.slice(split)
  const cleaned = after
    .replace(
      /<(article|section|div)\b[^>]*\b(?:data-pw-info-article|data-pw-info-body|data-pw-text-article)\b[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(
      /<(article|section|div)\b[^>]*\bdata-pw-region=["']content["'][^>]*>[\s\S]*?<\/\1>/gi,
      ''
    )
  return before + cleaned
}

function upsertHeadMeta(html: string, name: string, content: string): string {
  const safe = escapeAttr(content)
  const re = new RegExp(`<meta\\b([^>]*\\bname=["']${name}["'][^>]*)>`, 'i')
  if (re.test(html)) {
    return html.replace(re, (_m, attrs: string) => {
      if (/\bcontent=/i.test(attrs)) {
        return `<meta${attrs.replace(/\bcontent=(["'])[\s\S]*?\1/i, `content="${safe}"`)}>`
      }
      return `<meta${attrs} content="${safe}">`
    })
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<meta name="${name}" content="${safe}">\n</head>`)
  }
  return html
}

function upsertHeadProperty(html: string, property: string, content: string): string {
  const safe = escapeAttr(content)
  const re = new RegExp(`<meta\\b([^>]*\\bproperty=["']${property}["'][^>]*)>`, 'i')
  if (re.test(html)) {
    return html.replace(re, (_m, attrs: string) => {
      if (/\bcontent=/i.test(attrs)) {
        return `<meta${attrs.replace(/\bcontent=(["'])[\s\S]*?\1/i, `content="${safe}"`)}>`
      }
      return `<meta${attrs} content="${safe}">`
    })
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<meta property="${property}" content="${safe}">\n</head>`)
  }
  return html
}

function upsertCanonical(html: string, url: string): string {
  const safe = escapeAttr(url)
  if (/<link\b[^>]*\brel=["']canonical["']/i.test(html)) {
    return html.replace(
      /<link\b([^>]*\brel=["']canonical["'][^>]*)>/i,
      (_m, attrs: string) => {
        if (/\bhref=/i.test(attrs)) {
          return `<link${attrs.replace(/\bhref=(["'])[\s\S]*?\1/i, `href="${safe}"`)}>`
        }
        return `<link${attrs} href="${safe}">`
      }
    )
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<link rel="canonical" href="${safe}">\n</head>`)
  }
  return html
}

function upsertJsonLdScript(html: string, id: string, data: Record<string, unknown>): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const re = new RegExp(
    `<script\\b[^>]*\\bdata-pw-seo-jsonld=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,
    'i'
  )
  const tag = `<script type="application/ld+json" data-pw-seo-jsonld="${id}">${json}</script>`
  if (re.test(html)) return html.replace(re, tag)
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  return `${html}\n${tag}`
}

export type PartnerInfoPageAdvancedSeoInput = {
  pageUrl: string
  homeUrl: string
  siteName: string
  logoUrl?: string | null
  locale?: string
  homeLabel?: string
  datePublished?: string | null
  dateModified?: string | null
  noIndex?: boolean
  keywords?: string[]
}

export function buildPartnerInfoPageArticleJsonLd(
  input: PartnerInfoPageAdvancedSeoInput & { headline: string; description: string }
): Record<string, unknown> {
  const lang = String(input.locale || 'vi')
    .trim()
    .toLowerCase()
    .replace(/[_-].*$/, '')
    .slice(0, 8) || 'vi'
  const logo = input.logoUrl?.trim() || ''
  const publisher: Record<string, unknown> = {
    '@type': 'Organization',
    name: input.siteName,
  }
  if (logo) {
    publisher.logo = { '@type': 'ImageObject', url: logo }
  }
  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline.slice(0, 110),
    description: input.description.slice(0, 500),
    inLanguage: lang,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.pageUrl,
    },
    author: { '@type': 'Organization', name: input.siteName },
    publisher,
    isPartOf: {
      '@type': 'WebSite',
      name: input.siteName,
      url: input.homeUrl,
    },
  }
  if (input.datePublished) article.datePublished = input.datePublished
  if (input.dateModified) article.dateModified = input.dateModified
  else if (input.datePublished) article.dateModified = input.datePublished
  if (logo) article.image = [logo]
  if (input.keywords?.length) article.keywords = input.keywords.join(', ')
  return article
}

export function buildPartnerInfoPageBreadcrumbJsonLd(input: {
  homeUrl: string
  homeLabel: string
  pageUrl: string
  pageName: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: input.homeLabel,
        item: input.homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: input.pageName,
        item: input.pageUrl,
      },
    ],
  }
}

/** Strip editor-only SEO coach UI and inject Article + Breadcrumb + OG/Twitter/canonical. */
export function injectPartnerInfoPageAdvancedSeoInHtml(
  html: string,
  input: PartnerInfoPageAdvancedSeoInput
): string {
  if (!html.trim() || !isInfoVisualHtml(html)) return stripSeoCoachNodes(html)
  let out = stripStrayInfoArticlesAfterFooterFromHtml(stripSeoCoachNodes(html))
  const extract = extractInfoPageCmsFromHtml(out)
  const headline = (extract.seoTitle || extract.title || input.siteName).trim()
  const description = (
    extract.seoDescription ||
    extract.content.split(/\n+/).map((p) => p.trim()).filter(Boolean)[0] ||
    headline
  ).trim()
  const keywords =
    input.keywords?.filter(Boolean) ||
    String(
      out.match(/data-pw-seo-keywords=["']([^"']*)["']/i)?.[1] || ''
    )
      .split(/[,;|]/)
      .map((k) => k.trim())
      .filter(Boolean)

  if (/<title\b/i.test(out)) {
    out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(headline)}</title>`)
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `<title>${escapeHtml(headline)}</title>\n</head>`)
  }

  out = upsertHeadMeta(out, 'description', description.slice(0, 500))
  if (keywords.length) out = upsertHeadMeta(out, 'keywords', keywords.join(', ').slice(0, 400))
  out = upsertHeadMeta(
    out,
    'robots',
    input.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'
  )
  out = upsertCanonical(out, input.pageUrl)

  out = upsertHeadProperty(out, 'og:type', 'article')
  out = upsertHeadProperty(out, 'og:title', headline)
  out = upsertHeadProperty(out, 'og:description', description.slice(0, 500))
  out = upsertHeadProperty(out, 'og:url', input.pageUrl)
  out = upsertHeadProperty(out, 'og:site_name', input.siteName)
  if (input.logoUrl?.trim()) out = upsertHeadProperty(out, 'og:image', input.logoUrl.trim())
  if (input.datePublished) out = upsertHeadProperty(out, 'article:published_time', input.datePublished)
  if (input.dateModified || input.datePublished) {
    out = upsertHeadProperty(
      out,
      'article:modified_time',
      input.dateModified || input.datePublished || ''
    )
  }

  out = upsertHeadMeta(out, 'twitter:card', 'summary_large_image')
  out = upsertHeadMeta(out, 'twitter:title', headline)
  out = upsertHeadMeta(out, 'twitter:description', description.slice(0, 500))
  if (input.logoUrl?.trim()) out = upsertHeadMeta(out, 'twitter:image', input.logoUrl.trim())

  const articleLd = buildPartnerInfoPageArticleJsonLd({
    ...input,
    headline,
    description,
    keywords,
  })
  const breadcrumbLd = buildPartnerInfoPageBreadcrumbJsonLd({
    homeUrl: input.homeUrl,
    homeLabel: input.homeLabel || 'Home',
    pageUrl: input.pageUrl,
    pageName: extract.title || headline,
  })
  out = upsertJsonLdScript(out, 'article', articleLd)
  out = upsertJsonLdScript(out, 'breadcrumb', breadcrumbLd)

  if (/\bdata-pw-seo-description=/i.test(out)) {
    out = out.replace(
      /\bdata-pw-seo-description=(["'])[\s\S]*?\1/i,
      `data-pw-seo-description="${escapeAttr(description.slice(0, 500))}"`
    )
  }
  return out
}

export function stripPartnerInfoPageSeoCoachFromHtml(html: string): string {
  return stripStrayInfoArticlesAfterFooterFromHtml(stripSeoCoachNodes(html))
}
