import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function attrClassHas(attrs: string, name: string): boolean {
  const m = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)
  if (!m) return false
  return m[1].split(/\s+/).filter(Boolean).includes(name)
}

function isFilledLogoSrc(src: string): boolean {
  const s = String(src || '').trim()
  return s.length > 4 && !s.startsWith('data:image/') && /^https?:\/\//i.test(s)
}

function isLogoImgTag(tag: string): boolean {
  return /(?:\bclass=["'][^"']*\b(?:pw-logo|pw-shop-logo|pw-shop-footer-logo|site-logo)\b|\bdata-pw-logo-added=)/i.test(
    tag
  )
}

function readSrc(tag: string): string {
  return tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || ''
}

/** First real (http/https) logo image URL in the HTML, if any. */
export function extractFilledLogoUrl(html: string): string {
  const re = /<img\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const tag = m[0]
    if (!isLogoImgTag(tag)) continue
    const src = readSrc(tag)
    if (isFilledLogoSrc(src)) return src
  }
  return ''
}

/** True when HTML already has a real (http/https) logo image. */
export function htmlHasFilledLogoImage(html: string): boolean {
  return Boolean(extractFilledLogoUrl(html))
}

export function projectHasFilledLogoImage(project: PartnerWebsiteProject | null | undefined): boolean {
  if (!project?.files?.length) return false
  return project.files.some((f) => f.kind === 'html' && htmlHasFilledLogoImage(f.content))
}

function hideWordmarksIn(inner: string): string {
  return inner.replace(
    /<span\b([^>]*\bclass=["'][^"']*\bpw-wordmark\b[^"']*["'][^>]*)>([\s\S]*?)<\/span>/gi,
    (full, attrs: string, text: string) => {
      if (/\bdata-pw-logo-wordmark-hidden=/.test(full)) return full
      const trimmed = String(attrs || '').replace(/\sstyle=["'][^"']*["']/i, '')
      return `<span${trimmed} data-pw-logo-wordmark-hidden="1" style="display:none">${text}</span>`
    }
  )
}

/** Hide leftover raw brand text (e.g. `<a class="pw-shop-brand"><img/>188.com.vn</a>`). */
function hideLeftoverBrandText(inner: string): string {
  const next = hideWordmarksIn(inner)
  const hidden: Array<{ start: number; end: number }> = []
  const hiddenRe = /<span\b[^>]*data-pw-logo-wordmark-hidden[\s\S]*?<\/span>/gi
  let m: RegExpExecArray | null
  while ((m = hiddenRe.exec(next))) {
    hidden.push({ start: m.index, end: m.index + m[0].length })
  }
  const padded = `${next}<`
  const out = padded.replace(/>([^<]+)</g, (full, text: string, offset: number) => {
    if (!String(text).trim()) return full
    if (hidden.some((r) => offset >= r.start && offset < r.end)) return full
    return `><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">${text}</span><`
  })
  return out.endsWith('<') ? out.slice(0, -1) : out
}

function fillEmptyLogoImgs(html: string, src: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isLogoImgTag(tag)) return tag
    if (isFilledLogoSrc(readSrc(tag))) return tag
    let out = /\bsrc=["'][^"']*["']/i.test(tag)
      ? tag.replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`)
      : tag.replace(/<img\b/i, `<img src="${src}"`)
    out = out.replace(/\s*data-pw-logo-empty=["'][^"']*["']/gi, '')
    return out
  })
}

function replaceTextBrandAnchors(
  html: string,
  src: string,
  fallbackAlt: string,
  injectMissing = true
): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    if (!attrClassHas(attrs, 'pw-brand') && !attrClassHas(attrs, 'pw-shop-brand')) return full
    if (/<img\b[^>]*(?:\bpw-logo\b|\bpw-shop-logo\b|\bsite-logo\b|data-pw-logo-added)/i.test(inner)) {
      return `<a${attrs}>${hideLeftoverBrandText(inner)}</a>`
    }
    if (!injectMissing) return full
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || fallbackAlt
    const alt = escapeHtmlAttr(text)
    const img = `<img class="pw-logo pw-shop-logo" src="${src}" alt="${alt}" data-pw-logo-slot="header"/>`
    if (/\bpw-wordmark\b/.test(inner)) {
      return `<a${attrs}>${img}${hideWordmarksIn(inner)}</a>`
    }
    return `<a${attrs}>${img}<span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">${inner}</span></a>`
  })
}

function hideFooterNames(inner: string): string {
  return inner.replace(
    /<p\b([^>]*\bclass=["'][^"']*\bpw-shop-footer-name\b[^"']*["'][^>]*)>([\s\S]*?)<\/p>/gi,
    (full, attrs: string, text: string) => {
      if (/\bdata-pw-logo-wordmark-hidden=/.test(full)) return full
      const trimmed = String(attrs || '').replace(/\sstyle=["'][^"']*["']/i, '')
      return `<p${trimmed} data-pw-logo-wordmark-hidden="1" style="display:none">${text}</p>`
    }
  )
}

function replaceFooterBrandBlocks(html: string, src: string, fallbackAlt: string): string {
  return html.replace(
    /<div\b([^>]*\bpw-shop-footer-brand\b[^>]*)>([\s\S]*?)<\/div>/gi,
    (full, attrs: string, inner: string) => {
      if (!attrClassHas(attrs, 'pw-shop-footer-brand')) return full
      if (!/pw-shop-footer-name/.test(inner)) return full
      const nextInner = hideFooterNames(inner)
      if (/<img\b[^>]*(?:pw-shop-footer-logo|pw-logo)[^>]*src=["']https?:\/\//i.test(inner)) {
        return `<div${attrs}>${nextInner}</div>`
      }
      const name =
        inner.match(/<p\b[^>]*pw-shop-footer-name[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
        fallbackAlt
      const img = `<img class="pw-shop-footer-logo pw-logo" src="${src}" alt="${escapeHtmlAttr(name)}" data-pw-logo-slot="footer"/>`
      return `<div${attrs}>${img}${nextInner}</div>`
    }
  )
}

/**
 * First image logo: replace every leftover text wordmark / empty logo img.
 * Already-filled image logos stay as-is (later edits save per slot).
 */
export function applyFirstImageLogoToHtml(
  html: string,
  logoUrl: string,
  brandTitle?: string
): string {
  const logo = String(logoUrl || '').trim()
  if (!logo || !/^https?:\/\//i.test(logo) || !html.trim()) return html
  const src = escapeHtmlAttr(logo)
  const alt = (brandTitle || 'Logo').trim() || 'Logo'
  let next = fillEmptyLogoImgs(html, src)
  next = replaceTextBrandAnchors(next, src, alt, !htmlHasFilledLogoImage(next))
  next = replaceFooterBrandBlocks(next, src, alt)
  return next
}

/** Apply first image logo to every HTML file that still only has text / empty slots. */
export function applyFirstImageLogoToProject(
  project: PartnerWebsiteProject,
  logoUrl: string,
  brandTitle?: string
): PartnerWebsiteProject {
  const logo = String(logoUrl || '').trim()
  if (!logo || !/^https?:\/\//i.test(logo)) return project
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    const next = applyFirstImageLogoToHtml(f.content, logo, brandTitle)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}
