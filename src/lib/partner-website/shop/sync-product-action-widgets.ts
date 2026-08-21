import { visualDeviceVariantFromHtmlPath } from '@/lib/partner-website/visual-editor/visual-editor-pages'

const FAVORITE_WIDGET_RE =
  /<(button|a)\b([^>]*\bdata-pw-chrome-btn\s*=\s*["']favorite-product["'][^>]*)>([\s\S]*?)<\/\1>/gi

const PRODUCT_HTML_PATH_RE = /^p\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.(mobile|tablet|laptop))?\.html$/i

function sameDeviceHtml(path: string, sourcePath: string): boolean {
  return visualDeviceVariantFromHtmlPath(path) === visualDeviceVariantFromHtmlPath(sourcePath)
}

function isProductHtmlPath(path: string): boolean {
  return PRODUCT_HTML_PATH_RE.test(path.trim())
}

function firstFavoriteWidgetHtml(html: string, attr: string): string {
  const re = new RegExp(
    `<(button|a)\\b([^>]*\\bdata-pw-chrome-btn\\s*=\\s*["']favorite-product["'][^>]*\\b${attr}\\s*=\\s*["']1["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'i'
  )
  const match = re.exec(html)
  if (!match) return ''
  return match[0]
}

function firstAnyFavoriteWidgetHtml(html: string): string {
  FAVORITE_WIDGET_RE.lastIndex = 0
  const match = FAVORITE_WIDGET_RE.exec(html)
  return match ? match[0] : ''
}

function stripWidgetsWithAttr(html: string, attr: string): string {
  const re = new RegExp(
    `<(button|a)\\b([^>]*\\bdata-pw-chrome-btn\\s*=\\s*["']favorite-product["'][^>]*\\b${attr}\\s*=\\s*["']1["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'gi'
  )
  return html.replace(re, '')
}

function stampCatalogOpenTag(attrs: string): string {
  let next = attrs
  if (!/\bdata-pw-card-favorite\s*=/i.test(next)) next += ' data-pw-card-favorite="1"'
  else next = next.replace(/\bdata-pw-card-favorite\s*=\s*(["'])[^"']*\1/i, ' data-pw-card-favorite="1"')
  return next
}

function replaceOrInsertCatalogTemplate(catalogInner: string, widgetHtml: string): string {
  const tpl = `<template data-pw-card-favorite-tpl="1">${widgetHtml}</template>`
  if (/<template\b[^>]*data-pw-card-favorite-tpl/i.test(catalogInner)) {
    return catalogInner.replace(/<template\b[^>]*data-pw-card-favorite-tpl[^>]*>[\s\S]*?<\/template>/i, tpl)
  }
  return `${catalogInner}${tpl}`
}

function injectFavoriteIntoCardMedia(html: string, widgetHtml: string): string {
  return html.replace(
    /<(a|div)\b([^>]*\bdata-pw-el\s*=\s*["']card-media["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/data-pw-chrome-btn=["']favorite-product["']/.test(inner)) return full
      return `<${tag}${attrs}>${widgetHtml}${inner}</${tag}>`
    }
  )
}

function stampCatalogsInHtml(html: string, widgetHtml: string): string {
  if (!html.trim() || !widgetHtml.trim()) return html
  let out = html.replace(
    /<(section|div|article)\b([^>]*\b(?:data-pw-catalog\b|data-pw-region\s*=\s*["']catalog["'])[^>]*)>/gi,
    (_full, tag: string, attrs: string) => `<${tag}${stampCatalogOpenTag(attrs)}>`
  )
  out = injectFavoriteIntoCardMedia(out, widgetHtml)
  return out.replace(
    /<(section|div|article)\b([^>]*\bdata-pw-card-favorite\s*=\s*["']1["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (!/\b(?:data-pw-catalog\b|data-pw-region\s*=\s*["']catalog["'])/i.test(attrs)) return full
      return `<${tag}${attrs}>${replaceOrInsertCatalogTemplate(inner, widgetHtml)}</${tag}>`
    }
  )
}

function insertPdpFavoriteWidget(html: string, widgetHtml: string): string {
  const cleaned = stripWidgetsWithAttr(html, 'data-pw-pdp-favorite')
  if (/data-pw-region=["']pdp-info["']/i.test(cleaned)) {
    return cleaned.replace(
      /(<[^>]*\bdata-pw-region=["']pdp-info["'][^>]*>)/i,
      `$1${widgetHtml}`
    )
  }
  if (/class=["'][^"']*\bpw-pdp-actions\b/i.test(cleaned)) {
    return cleaned.replace(/(<[^>]*\bpw-pdp-actions\b[^>]*>)/i, `$1${widgetHtml}`)
  }
  if (/<\/main>/i.test(cleaned)) return cleaned.replace(/<\/main>/i, `${widgetHtml}</main>`)
  if (/<\/body>/i.test(cleaned)) return cleaned.replace(/<\/body>/i, `${widgetHtml}</body>`)
  return `${cleaned}${widgetHtml}`
}

/**
 * When Sửa nhanh adds Thích sản phẩm on a PDP or product grid, copy it onto every
 * product page / catalog of the same device so live inventory cards stay in sync.
 */
export function syncProductActionWidgetsAcrossProjectFiles<
  T extends { files: Array<{ path: string; kind: string; content: string }> },
>(project: T, sourcePath: string, sourceHtml: string): T {
  const path = sourcePath.trim() || 'index.html'
  const html = sourceHtml.trim()
  if (!html) return project

  const cardWidget =
    firstFavoriteWidgetHtml(html, 'data-pw-card-favorite') ||
    (/data-pw-card-favorite=["']1["']/i.test(html) ? firstAnyFavoriteWidgetHtml(html) : '')
  const pdpWidget = firstFavoriteWidgetHtml(html, 'data-pw-pdp-favorite')
  if (!cardWidget && !pdpWidget) return project

  const files = project.files.map((file) => {
    if (file.kind !== 'html') return file
    if (file.path === path) return file
    if (!sameDeviceHtml(file.path, path)) return file
    let next = file.content || ''
    if (cardWidget) next = stampCatalogsInHtml(next, cardWidget)
    if (pdpWidget && isProductHtmlPath(file.path)) next = insertPdpFavoriteWidget(next, pdpWidget)
    return next === file.content ? file : { ...file, content: next }
  })
  return { ...project, files }
}
