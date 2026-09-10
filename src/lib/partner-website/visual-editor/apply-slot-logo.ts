import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { applyChatIconLogoToHtml } from '@/lib/partner-website/visual-editor/apply-chat-icon-logo'
import {
  visualDeviceVariantFromHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type PartnerWebsiteLogoSlot = 'favicon' | 'header' | 'footer' | 'chat'

export const PARTNER_WEBSITE_DEVICE_LOGO_SLOTS = ['header', 'footer'] as const
export type PartnerWebsiteDeviceLogoSlot = (typeof PARTNER_WEBSITE_DEVICE_LOGO_SLOTS)[number]

export type PartnerWebsiteHtmlLogoSlot = PartnerWebsiteDeviceLogoSlot | 'chat'

export type PartnerWebsiteLogoInventory = {
  faviconUrl: string
  chatUrl: string
  header: Record<VisualDeviceVariant, string>
  footer: Record<VisualDeviceVariant, string>
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function isPersistableLogoUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || '').trim())
}

export function decodeLogoSrc(src: string): string {
  return String(src || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function isFilledLogoSrc(src: string): boolean {
  const s = decodeLogoSrc(src)
  if (s.length < 5) return false
  if (/^data:image\/gif/i.test(s)) return false
  if (s.startsWith('data:image/')) return false
  if (/^https?:\/\//i.test(s)) return true
  return /^\/(?!\/)/.test(s)
}

function readSrc(tag: string): string {
  const raw = tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || ''
  return decodeLogoSrc(raw)
}

function isChatLogoTag(tag: string): boolean {
  return /\bpw-chrome-chat-logo\b/.test(tag)
}

function isFooterLogoTag(tag: string): boolean {
  return (
    /\bpw-shop-footer-logo\b/.test(tag) ||
    /data-pw-logo-slot=["']footer["']/.test(tag)
  )
}

function isHeaderLogoTag(tag: string): boolean {
  if (isChatLogoTag(tag) || isFooterLogoTag(tag)) return false
  return /(?:\bclass=["'][^"']*\b(?:pw-logo|pw-shop-logo|site-logo)\b|\bdata-pw-logo-added=|\bdata-pw-logo-slot=["']header["']|\bdata-pw-el=["']logo["'])/i.test(
    tag
  )
}

function setLogoImgSrc(tag: string, src: string): string {
  let out = /\bsrc=["']/.test(tag)
    ? tag.replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`)
    : tag.replace(/<img\b/i, `<img src="${src}"`)
  out = out.replace(/\s*data-pw-logo-empty=["'][^"']*["']/gi, '')
  if (src && !/\bdata-pw-logo-slot=/.test(out)) {
    if (isFooterLogoTag(out)) {
      out = out.replace(/<img\b/i, '<img data-pw-logo-slot="footer"')
    } else if (isHeaderLogoTag(out)) {
      out = out.replace(/<img\b/i, '<img data-pw-logo-slot="header"')
    }
  }
  return out
}

function clearLogoImg(tag: string): string {
  let next = tag.replace(/\bsrc=["'][^"']*["']/i, 'src=""')
  if (!/\bsrc=/.test(next)) next = next.replace(/<img\b/i, '<img src=""')
  if (!/\bdata-pw-logo-empty=/.test(next)) {
    next = next.replace(/<img\b/i, '<img data-pw-logo-empty="1"')
  }
  return next
}

function mapImgs(chunk: string, pred: (tag: string) => boolean, fn: (tag: string) => string): string {
  return chunk.replace(/<img\b[^>]*>/gi, (tag) => (pred(tag) ? fn(tag) : tag))
}

function applyToHeaderBlocks(html: string, fn: (inner: string) => string): string {
  let next = html.replace(/<header\b([^>]*)>([\s\S]*?)<\/header>/gi, (_full, attrs: string, inner: string) => {
    return `<header${attrs}>${fn(inner)}</header>`
  })
  if (next === html) {
    next = html.replace(
      /<(div|section)\b([^>]*\b(?:pw-shop-header|data-pw-region=["']header["'])[^>]*)>([\s\S]*?)<\/\1>/gi,
      (_full, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${fn(inner)}</${tag}>`
    )
  }
  return next
}

function applyToFooterBlocks(html: string, fn: (inner: string) => string): string {
  return html.replace(/<footer\b([^>]*)>([\s\S]*?)<\/footer>/gi, (_full, attrs: string, inner: string) => {
    return `<footer${attrs}>${fn(inner)}</footer>`
  })
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

function injectHeaderLogo(inner: string, src: string, alt: string): string {
  if (/<img\b[^>]*(?:\bpw-logo\b|\bpw-shop-logo\b|data-pw-logo-slot=["']header["']|data-pw-el=["']logo["'])/i.test(inner)) {
    return mapImgs(inner, isHeaderLogoTag, (tag) => setLogoImgSrc(tag, src))
  }
  return inner.replace(
    /<a\b([^>]*(?:pw-brand|pw-shop-brand|data-pw-logo-home)[^>]*)>([\s\S]*?)<\/a>/i,
    (_full, attrs: string, brandInner: string) => {
      const img = `<img class="pw-logo pw-shop-logo" src="${src}" alt="${alt}" data-pw-logo-slot="header" data-pw-el="logo"/>`
      return `<a${attrs}>${img}${hideWordmarksIn(brandInner)}</a>`
    }
  )
}

function injectFooterLogo(inner: string, src: string, alt: string): string {
  if (/<img\b[^>]*(?:pw-shop-footer-logo|data-pw-logo-slot=["']footer["'])/i.test(inner)) {
    return mapImgs(inner, isFooterLogoTag, (tag) => setLogoImgSrc(tag, src))
  }
  const img = `<img class="pw-shop-footer-logo pw-logo" src="${src}" alt="${alt}" data-pw-logo-slot="footer" data-pw-el="logo"/>`
  if (/\bpw-shop-footer-brand\b/.test(inner)) {
    return inner.replace(
      /(<div\b[^>]*\bpw-shop-footer-brand\b[^>]*>)/i,
      `$1${img}`
    )
  }
  return `${img}${inner}`
}

function extractFromImgs(chunk: string, pred: (tag: string) => boolean): string {
  const re = /<img\b[^>]*>/gi
  let m: RegExpExecArray | null
  let leftoverEmpty = ''
  while ((m = re.exec(chunk))) {
    const tag = m[0]
    if (!pred(tag)) continue
    const src = readSrc(tag)
    if (!isFilledLogoSrc(src)) continue
    if (/\bdata-pw-logo-empty=["']1["']/i.test(tag)) {
      if (!leftoverEmpty) leftoverEmpty = src
      continue
    }
    return src
  }
  return leftoverEmpty
}

function extractRegionChunk(html: string, region: 'header' | 'footer'): string {
  const tag = region
  const tagged = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'i'))?.[0]
  if (tagged) return tagged
  const byRegion = html.match(
    new RegExp(
      `<(header|footer|div|section)\\b[^>]*data-pw-region=["']${region}["'][^>]*>[\\s\\S]*?</\\1>`,
      'i'
    )
  )?.[0]
  if (byRegion) return byRegion
  const cls = region === 'header' ? '(?:pw-header|pw-shop-header)' : '(?:pw-footer|pw-shop-footer)'
  return (
    html.match(
      new RegExp(`<(header|footer|div|section)\\b[^>]*\\bclass=["'][^"']*\\b${cls}\\b[^>]*>[\\s\\S]*?</\\1>`, 'i')
    )?.[0] || ''
  )
}

function isFooterRegionLogoTag(tag: string): boolean {
  if (isChatLogoTag(tag)) return false
  return isFooterLogoTag(tag) || isHeaderLogoTag(tag)
}

export function extractSlotLogoUrlFromHtml(html: string, slot: PartnerWebsiteHtmlLogoSlot): string {
  if (!html.trim()) return ''
  if (slot === 'chat') {
    return extractFromImgs(html, isChatLogoTag)
  }
  if (slot === 'footer') {
    const footer = extractRegionChunk(html, 'footer') || html
    return (
      extractFromImgs(footer, isFooterLogoTag) ||
      extractFromImgs(footer, isFooterRegionLogoTag)
    )
  }
  const header = extractRegionChunk(html, 'header')
  const fromHeader = header ? extractFromImgs(header, isHeaderLogoTag) : ''
  if (fromHeader) return fromHeader
  return extractFromImgs(html, (tag) => /data-pw-logo-slot=["']header["']/i.test(tag) && !isChatLogoTag(tag))
}

export function emptyLogoInventory(): PartnerWebsiteLogoInventory {
  const blank: Record<VisualDeviceVariant, string> = {
    desktop: '',
    laptop: '',
    tablet: '',
    mobile: '',
  }
  return {
    faviconUrl: '',
    chatUrl: '',
    header: { ...blank },
    footer: { ...blank },
  }
}

function isHomeHtmlPath(path: string): boolean {
  return /(^|\/)index(?:\.(?:mobile|tablet|laptop))?\.html$/i.test(path)
}

export function extractLogoInventoryFromProject(
  project: PartnerWebsiteProject | null | undefined,
  faviconUrl?: string | null,
  chatIconLogoUrl?: string | null,
  opts?: { htmlSource?: string | null; logoUrl?: string | null }
): PartnerWebsiteLogoInventory {
  const out = emptyLogoInventory()
  out.faviconUrl = String(faviconUrl || '').trim()
  const themeChat = decodeLogoSrc(String(chatIconLogoUrl || '').trim())
  out.chatUrl = isFilledLogoSrc(themeChat) ? themeChat : ''
  const files: Array<{ path: string; content: string }> = []
  if (project?.files?.length) {
    for (const file of project.files) {
      if (file.kind !== 'html' || !file.content?.trim()) continue
      files.push({ path: file.path, content: file.content })
    }
  }
  const htmlSource = opts?.htmlSource?.trim() || ''
  const hasDesktopHome = files.some(
    (f) => isHomeHtmlPath(f.path) && visualDeviceVariantFromHtmlPath(f.path) === 'desktop'
  )
  if (htmlSource && !hasDesktopHome) {
    files.unshift({ path: 'index.html', content: htmlSource })
  }
  files.sort((a, b) => Number(isHomeHtmlPath(b.path)) - Number(isHomeHtmlPath(a.path)))
  for (const file of files) {
    const device = visualDeviceVariantFromHtmlPath(file.path)
    const isHome = isHomeHtmlPath(file.path)
    for (const slot of PARTNER_WEBSITE_DEVICE_LOGO_SLOTS) {
      if (out[slot][device] && !isHome) continue
      const url = extractSlotLogoUrlFromHtml(file.content, slot)
      if (url) out[slot][device] = url
    }
    if (!out.chatUrl) {
      const chat = extractSlotLogoUrlFromHtml(file.content, 'chat')
      if (chat) out.chatUrl = chat
    }
  }
  if (htmlSource) {
    if (!out.header.desktop) {
      const h = extractSlotLogoUrlFromHtml(htmlSource, 'header')
      if (h) out.header.desktop = h
    }
    if (!out.footer.desktop) {
      const f = extractSlotLogoUrlFromHtml(htmlSource, 'footer')
      if (f) out.footer.desktop = f
    }
    if (!out.chatUrl) {
      const c = extractSlotLogoUrlFromHtml(htmlSource, 'chat')
      if (c) out.chatUrl = c
    }
  }
  const fallback = decodeLogoSrc(String(opts?.logoUrl || '').trim())
  if (isFilledLogoSrc(fallback)) {
    for (const device of ['desktop', 'laptop', 'tablet', 'mobile'] as VisualDeviceVariant[]) {
      if (!out.header[device]) out.header[device] = fallback
    }
  }
  return out
}

export function extractLogoInventoryFromWebsite(website: {
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
  logoUrl?: string | null
  theme?: { faviconUrl?: string | null; chatIconLogoUrl?: string | null; logoUrl?: string | null } | null
}): PartnerWebsiteLogoInventory {
  return extractLogoInventoryFromProject(
    website?.project,
    website?.theme?.faviconUrl,
    website?.theme?.chatIconLogoUrl,
    {
      htmlSource: website?.htmlSource,
      logoUrl: website?.theme?.logoUrl || website?.logoUrl,
    }
  )
}

/** After Sửa nhanh Lưu: Chat mua in HTML is the source — copy into theme so Quản lý logo matches. */
export function withChatIconLogoFromProject<T extends { chatIconLogoUrl?: string | null }>(
  theme: T,
  project: PartnerWebsiteProject | null | undefined,
  htmlSource?: string | null
): T {
  const inv = extractLogoInventoryFromProject(project, null, theme.chatIconLogoUrl, { htmlSource })
  if (!inv.chatUrl || inv.chatUrl === String(theme.chatIconLogoUrl || '').trim()) return theme
  return { ...theme, chatIconLogoUrl: inv.chatUrl }
}

export function applySlotLogoToHtml(
  html: string,
  slot: PartnerWebsiteHtmlLogoSlot,
  logoUrl: string,
  brandTitle?: string
): string {
  const raw = String(logoUrl || '').trim()
  if (!html.trim()) return html
  if (slot === 'chat') {
    if (!isPersistableLogoUrl(raw)) return html
    return applyChatIconLogoToHtml(html, raw)
  }
  const alt = escapeHtmlAttr((brandTitle || 'Logo').trim() || 'Logo')
  if (!isPersistableLogoUrl(raw)) {
    if (slot === 'footer') {
      return applyToFooterBlocks(html, (inner) => mapImgs(inner, isFooterLogoTag, clearLogoImg))
    }
    return applyToHeaderBlocks(html, (inner) => mapImgs(inner, isHeaderLogoTag, clearLogoImg))
  }
  const src = escapeHtmlAttr(raw)
  if (slot === 'footer') {
    return applyToFooterBlocks(html, (inner) => injectFooterLogo(inner, src, alt))
  }
  return applyToHeaderBlocks(html, (inner) => injectHeaderLogo(inner, src, alt))
}

export function applySlotLogoToProject(
  project: PartnerWebsiteProject,
  slot: PartnerWebsiteHtmlLogoSlot,
  logoUrl: string,
  device?: VisualDeviceVariant,
  brandTitle?: string
): PartnerWebsiteProject {
  const allDevices = slot === 'chat' || !device
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    if (!allDevices && visualDeviceVariantFromHtmlPath(f.path) !== device) return f
    const next = applySlotLogoToHtml(f.content, slot, logoUrl, brandTitle)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}
