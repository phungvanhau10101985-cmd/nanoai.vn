/** Platform CSS guard — keeps header logos at reasonable size even if AI outputs huge img tags. */
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { appendResponsiveBaselineToProjectCss } from '@/lib/partner-website/partner-website-mockup-build-rules'

export const PARTNER_WEBSITE_LOGO_GUARD_STYLE_ID = 'nanoai-pw-logo-guard'

export const PARTNER_WEBSITE_LOGO_GUARD_CSS = `
/* NanoAI platform: desktop header + logo sizing (do not crush header height) */
header.pw-header,
header.site-header,
.pw-header,
.site-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  padding: 14px clamp(16px, 4vw, 40px);
}
@media (min-width: 768px) {
  header.pw-header,
  header.site-header,
  .pw-header,
  .site-header {
    min-height: 88px;
    padding: 18px clamp(24px, 5vw, 56px);
  }
}
header.pw-header img.pw-logo,
header.pw-header img.site-logo,
header.site-header img.pw-logo,
header.site-header img.site-logo,
.pw-header img.pw-logo,
.pw-header img.site-logo,
img.pw-logo,
img.site-logo,
a.logo img,
.header-logo img,
.brand-logo img {
  max-height: 56px !important;
  height: auto !important;
  width: auto !important;
  max-width: min(240px, 46vw) !important;
  object-fit: contain !important;
  display: block;
}
@media (min-width: 768px) {
  header.pw-header img.pw-logo,
  header.site-header img.pw-logo,
  img.pw-logo,
  img.site-logo {
    max-height: 64px !important;
  }
}
header .logo-wrap,
.site-header .logo-wrap,
.pw-header-inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  header.pw-header,
  header.site-header,
  .pw-header,
  .site-header {
    min-height: 56px;
    padding: 10px 14px;
  }
  img.pw-logo,
  img.site-logo {
    max-height: 40px !important;
    max-width: min(160px, 50vw) !important;
  }
}
`.trim()

export const PARTNER_WEBSITE_LOGO_PROMPT_RULES = `- Desktop header must feel full-width and roomy: min-height ~80–96px, horizontal padding, logo left + nav + search/cart right.
- Header logo: <img class="site-logo pw-logo"> with CSS max-height: 56–64px; width: auto; object-fit: contain; max-width: 240px.
- NEVER render the logo at hero/banner size inside the navigation header.
- Do NOT create two headers (avoid a thin bar + a second hero nav). One primary sticky/top header only.`

export function injectPartnerWebsiteLogoGuardIntoHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  if (trimmed.includes(PARTNER_WEBSITE_LOGO_GUARD_STYLE_ID)) return html

  const styleTag = `<style id="${PARTNER_WEBSITE_LOGO_GUARD_STYLE_ID}">\n${PARTNER_WEBSITE_LOGO_GUARD_CSS}\n</style>`

  if (/<\/head>/i.test(trimmed)) {
    return trimmed.replace(/<\/head>/i, `${styleTag}\n</head>`)
  }
  if (/<html[^>]*>/i.test(trimmed)) {
    return trimmed.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`)
  }
  return `${styleTag}\n${trimmed}`
}

/** Append logo sizing rules to project CSS if missing. */
export function appendLogoGuardToProjectCss(css: string): string {
  if (css.includes(PARTNER_WEBSITE_LOGO_GUARD_STYLE_ID) || css.includes('nanoai-pw-logo-guard')) {
    return css
  }
  return `${css.trim()}\n\n/* ${PARTNER_WEBSITE_LOGO_GUARD_STYLE_ID} */\n.pw-header,.site-header{min-height:88px;padding:18px 40px;display:flex;align-items:center;gap:1rem;width:100%;box-sizing:border-box}.site-logo,.pw-logo{max-height:64px;width:auto;max-width:240px;object-fit:contain}\n`
}

/** Ensure generated project CSS includes logo + responsive baseline at build time. */
export function applyLogoGuardToProject(project: PartnerWebsiteProject): PartnerWebsiteProject {
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'css') return f
    let content = appendLogoGuardToProjectCss(f.content)
    content = appendResponsiveBaselineToProjectCss(content)
    if (content === f.content) return f
    changed = true
    return { ...f, content }
  })
  return changed ? { ...project, files } : project
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Force brand logo into header HTML when AI omitted or used a wrong src.
 * Prefers updating an existing header logo img; otherwise injects one.
 */
export function ensureBrandLogoInHtml(
  html: string,
  logoUrl: string | null | undefined,
  brandTitle?: string
): string {
  const logo = logoUrl?.trim() || ''
  if (!logo || !/^https?:\/\//i.test(logo) || !html.trim()) return html

  const alt = escapeHtmlAttr((brandTitle || 'Logo').trim() || 'Logo')
  const src = escapeHtmlAttr(logo)
  const logoImg = `<img class="pw-logo site-logo" src="${src}" alt="${alt}" width="160" height="48" />`

  // Already embeds this exact logo URL — keep AI markup.
  if (html.includes(logo)) return html

  // Replace first header/nav logo image src.
  const headerLogoRe =
    /(<header\b[\s\S]{0,4000}?<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/i
  if (headerLogoRe.test(html)) {
    return html.replace(headerLogoRe, `$1${src}$3`)
  }
  const navLogoRe = /(<nav\b[\s\S]{0,2000}?<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/i
  if (navLogoRe.test(html)) {
    return html.replace(navLogoRe, `$1${src}$3`)
  }

  // Inject into header / .pw-header / body start.
  if (/<header\b[^>]*>/i.test(html)) {
    return html.replace(/<header\b[^>]*>/i, (m) => `${m}\n${logoImg}`)
  }
  if (/<div\b[^>]*class=["'][^"']*(?:pw-header|site-header|header)[^"']*["'][^>]*>/i.test(html)) {
    return html.replace(
      /<div\b[^>]*class=["'][^"']*(?:pw-header|site-header|header)[^"']*["'][^>]*>/i,
      (m) => `${m}\n${logoImg}`
    )
  }
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(
      /<body\b[^>]*>/i,
      (m) => `${m}\n<header class="pw-header"><div class="pw-header-inner">${logoImg}</div></header>`
    )
  }
  return `${logoImg}\n${html}`
}

export function ensureBrandLogoInProject(
  project: PartnerWebsiteProject,
  logoUrl: string | null | undefined,
  brandTitle?: string
): PartnerWebsiteProject {
  const logo = logoUrl?.trim() || ''
  if (!logo || !/^https?:\/\//i.test(logo)) return project
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    const next = ensureBrandLogoInHtml(f.content, logo, brandTitle)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}

function isBrandLogoImgTag(tag: string): boolean {
  return /(?:\bclass=["'][^"']*\b(?:pw-logo|pw-shop-logo|pw-shop-footer-logo|site-logo)\b|\bdata-pw-logo-added=|\bdata-pw-logo-float=|\bdata-pw-el=["']logo["'])/i.test(
    tag
  )
}

/** Empty header/footer logo images so Xóa logo actually removes them from the shop HTML. */
export function clearBrandLogoInHtml(html: string): string {
  if (!html.trim()) return html
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isBrandLogoImgTag(tag)) return tag
    let next = tag.replace(/\bsrc=["'][^"']*["']/i, 'src=""')
    if (!/\bsrc=/.test(next)) next = next.replace(/<img\b/i, '<img src=""')
    if (!/\bdata-pw-logo-empty=/.test(next)) {
      next = next.replace(/<img\b/i, '<img data-pw-logo-empty="1"')
    }
    return next
  })
}

export function clearBrandLogoInProject(project: PartnerWebsiteProject): PartnerWebsiteProject {
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    const next = clearBrandLogoInHtml(f.content)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}

export const applyPartnerWebsiteBuildGuardsToProject = applyLogoGuardToProject
