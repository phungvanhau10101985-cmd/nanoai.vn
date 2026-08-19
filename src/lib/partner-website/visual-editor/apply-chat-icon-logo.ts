import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isPersistableChatIconUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function replaceChatLogoImgSrc(tag: string, src: string): string {
  if (!/\bpw-chrome-chat-logo\b/.test(tag)) return tag
  return /\bsrc=["']/.test(tag)
    ? tag.replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`)
    : tag.replace(/<img\b/i, `<img src="${src}"`)
}

function stampChatIconAttr(attrs: string): string {
  if (/\bdata-pw-chat-icon-logo=/.test(attrs)) {
    return attrs.replace(/\bdata-pw-chat-icon-logo=["'][^"']*["']/i, 'data-pw-chat-icon-logo="1"')
  }
  return `${attrs} data-pw-chat-icon-logo="1"`
}

function applyChatIconInsideButton(inner: string, src: string): string {
  if (/<img\b[^>]*\bpw-chrome-chat-logo\b/i.test(inner)) {
    return inner.replace(/<img\b[^>]*>/gi, (tag) => replaceChatLogoImgSrc(tag, src))
  }
  if (!/<span\b[^>]*\bpw-chrome-icon-wrap\b/i.test(inner)) return inner
  const img = `<img class="pw-chrome-chat-logo" src="${src}" alt="" width="22" height="22" draggable="false" />`
  return inner.replace(
    /(<span\b[^>]*\bpw-chrome-icon-wrap\b[^>]*>)([\s\S]*?)(<\/span>)/i,
    (_full, open: string, wrapInner: string, close: string) => {
      const cleaned = String(wrapInner).replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
      return `${open}${img}${cleaned}${close}`
    }
  )
}

/** Ghi logo icon Chat mua vào mọi nút `[data-pw-chrome-btn="chat"]` trong HTML. */
export function applyChatIconLogoToHtml(html: string, logoUrl: string): string {
  const logo = String(logoUrl || '').trim()
  if (!isPersistableChatIconUrl(logo) || !html.trim()) return html
  if (!/data-pw-chrome-btn=["']chat["']/.test(html) && !/\bpw-chrome-chat-logo\b/.test(html)) {
    return html
  }
  const src = escapeHtmlAttr(logo)
  let next = html.replace(
    /<(button|a)\b([^>]*\bdata-pw-chrome-btn=["']chat["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, inner: string) =>
      `<${tag}${stampChatIconAttr(attrs)}>${applyChatIconInsideButton(inner, src)}</${tag}>`
  )
  next = next.replace(/<img\b[^>]*>/gi, (tag) => replaceChatLogoImgSrc(tag, src))
  return next
}

/** Ghi logo icon Chat mua vào mọi file HTML (desktop / laptop / tablet / mobile). */
export function applyChatIconLogoToProject(
  project: PartnerWebsiteProject,
  logoUrl: string
): PartnerWebsiteProject {
  const logo = String(logoUrl || '').trim()
  if (!isPersistableChatIconUrl(logo)) return project
  let changed = false
  const files = project.files.map((f) => {
    if (f.kind !== 'html') return f
    const next = applyChatIconLogoToHtml(f.content, logo)
    if (next === f.content) return f
    changed = true
    return { ...f, content: next }
  })
  return changed ? { ...project, files } : project
}
