const ALLOWED_TAGS = new Set(['script', 'meta', 'link', 'noscript', 'iframe', 'style', 'div', 'span'])
const SCRIPT_SRC_HOSTS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'googleads.g.doubleclick.net',
  'www.googleadservices.com',
  'connect.facebook.net',
  'analytics.tiktok.com',
  'www.facebook.com',
]
const IFRAME_SRC_HOSTS = ['www.googletagmanager.com', 'www.google.com', 'www.facebook.com']

function hostOf(url: string): string {
  try {
    return new URL(url, 'https://example.invalid').hostname.toLowerCase()
  } catch {
    return ''
  }
}

function allowedSrc(url: string, hosts: string[]): boolean {
  const u = url.trim()
  if (!u) return false
  if (u.startsWith('javascript:') || u.startsWith('data:') || u.startsWith('vbscript:')) return false
  if (u.startsWith('//')) return allowedSrc(`https:${u}`, hosts)
  if (!/^https?:\/\//i.test(u)) return false
  const host = hostOf(u)
  return hosts.some((h) => host === h || host.endsWith(`.${h}`))
}

function stripEventHandlers(attrs: string): string {
  return attrs.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '').replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
}

function sanitizeOpenTag(tag: string, rawAttrs: string): string | null {
  const name = tag.toLowerCase()
  if (!ALLOWED_TAGS.has(name)) return null
  let attrs = stripEventHandlers(rawAttrs)
  attrs = attrs.replace(/\s+(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '')
  if (name === 'script') {
    const src = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim() || ''
    if (src && !allowedSrc(src, SCRIPT_SRC_HOSTS)) return null
  }
  if (name === 'iframe') {
    const src = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim() || ''
    if (src && !allowedSrc(src, IFRAME_SRC_HOSTS)) return null
    if (!/\bsandbox\s*=/.test(attrs)) attrs += ' sandbox="allow-scripts allow-same-origin"'
  }
  if (name === 'link') {
    const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim() || ''
    if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) return null
  }
  return `<${name}${attrs}>`
}

/**
 * Merchant custom HTML (head / body_open / body_close). Multi-tenant: whitelist tags,
 * block javascript: and inline handlers. Empty / unsafe → ''.
 */
export function sanitizePartnerShopCustomEmbedHtml(raw: string | null | undefined): string {
  const src = String(raw ?? '').trim()
  if (!src) return ''
  if (src.length > 20_000) return ''
  const parts: string[] = []
  const re = /<\/?([a-z][a-z0-9:-]*)\b([^>]*)>/gi
  let last = 0
  let m: RegExpExecArray | null
  const openStack: string[] = []
  while ((m = re.exec(src))) {
    const text = src.slice(last, m.index)
    if (openStack.length) parts.push(text)
    last = m.index + m[0].length
    const tag = m[1].toLowerCase()
    const isClose = m[0].startsWith('</')
    if (isClose) {
      if (!ALLOWED_TAGS.has(tag)) continue
      parts.push(`</${tag}>`)
      const idx = openStack.lastIndexOf(tag)
      if (idx >= 0) openStack.splice(idx, 1)
      continue
    }
    const selfClose = /\/\s*>$/.test(m[0])
    const open = sanitizeOpenTag(tag, m[2] || '')
    if (!open) {
      if (!selfClose && ALLOWED_TAGS.has(tag)) {
        /* skip body until close */
      }
      continue
    }
    parts.push(selfClose && !open.endsWith('/>') ? open.replace(/>$/, '/>') : open)
    if (!selfClose && tag !== 'meta' && tag !== 'link') openStack.push(tag)
  }
  if (openStack.includes('script') || openStack.includes('style') || openStack.includes('noscript')) {
    const rest = src.slice(last)
    parts.push(rest)
    while (openStack.length) {
      const t = openStack.pop()
      if (t) parts.push(`</${t}>`)
    }
  }
  return parts.join('').trim()
}

export function partnerShopVerifyMetaTags(input: {
  googleSearchConsoleVerify?: string | null
  googleMerchantCenterVerify?: string | null
  facebookDomainVerification?: string | null
}): string {
  const tags: string[] = []
  const seen = new Set<string>()
  const push = (name: string, content: string) => {
    const key = `${name}\0${content}`
    if (seen.has(key)) return
    seen.add(key)
    tags.push(`<meta name="${name}" content="${content}">`)
  }
  const gsc = String(input.googleSearchConsoleVerify ?? '').trim()
  if (gsc && /^[A-Za-z0-9_-]+$/.test(gsc)) push('google-site-verification', gsc)
  const gmc = String(input.googleMerchantCenterVerify ?? '').trim()
  if (gmc && /^[A-Za-z0-9_-]+$/.test(gmc)) push('google-site-verification', gmc)
  const fb = String(input.facebookDomainVerification ?? '').trim()
  if (fb && /^[A-Za-z0-9_-]+$/.test(fb)) push('facebook-domain-verification', fb)
  return tags.join('\n')
}

/** Live inlines the visual body into Next.js. A verify meta left in that markup sits under `<body>`. */
export function stripPartnerShopVerifyMetasFromHtml(html: string): string {
  if (!html || !/google-site-verification|facebook-domain-verification/i.test(html)) return html
  return html.replace(/<meta\b[^>]*>/gi, (tag) => {
    const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || ''
    if (name === 'google-site-verification' || name === 'facebook-domain-verification') return ''
    return tag
  })
}

export type PartnerShopDocumentVerification = {
  google?: string | string[]
  other?: Record<string, string>
}

/** Tokens for Next.js `metadata.verification` — rendered in the document `<head>`, before `<body>`. */
export function partnerShopDocumentVerification(input: {
  googleSearchConsoleVerify?: string | null
  googleMerchantCenterVerify?: string | null
  facebookDomainVerification?: string | null
}): PartnerShopDocumentVerification | null {
  const google: string[] = []
  for (const raw of [input.googleSearchConsoleVerify, input.googleMerchantCenterVerify]) {
    const token = String(raw ?? '').trim()
    if (!token || !/^[A-Za-z0-9_-]+$/.test(token) || google.includes(token)) continue
    google.push(token)
  }
  const facebook = String(input.facebookDomainVerification ?? '').trim()
  const fbOk = Boolean(facebook && /^[A-Za-z0-9_-]+$/.test(facebook))
  if (!google.length && !fbOk) return null
  return {
    ...(google.length ? { google: google.length === 1 ? google[0] : google } : {}),
    ...(fbOk ? { other: { 'facebook-domain-verification': facebook } } : {}),
  }
}
