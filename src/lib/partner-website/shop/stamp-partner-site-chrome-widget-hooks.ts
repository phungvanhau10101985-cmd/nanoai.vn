import { chromeCountBadgeKindFromAttr } from '@/lib/partner-website/shop/chrome-count-badges'
import { stampPartnerSiteChatOpenAttrsInHtml } from '@/lib/partner-website/shop/partner-site-chat-embed'
import {
  partnerSiteAccountPath,
  partnerSiteCartPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  chromeWidgetHref,
  chromeWidgetLiveHook,
  isVisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hasAttr(attrs: string, name: string): boolean {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, 'i').test(attrs)
}

function setAttr(attrs: string, name: string, value: string): string {
  const assignment = ` ${name}="${escapeAttr(value)}"`
  const quoted = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (quoted.test(attrs)) return attrs.replace(quoted, assignment)
  const flag = new RegExp(`\\s${name}(?=\\s|$)`, 'i')
  if (flag.test(attrs)) return attrs.replace(flag, assignment)
  return `${attrs}${assignment}`
}

function ensureFlag(attrs: string, name: string): string {
  return hasAttr(attrs, name) ? attrs : `${attrs} ${name}`
}

function stampChromeBtnOpenTag(
  tag: string,
  attrs: string,
  kindRaw: string,
  siteSlug: string
): string {
  const kind = kindRaw.trim()
  if (!isVisualEditorChromeWidgetKind(kind)) return `<${tag}${attrs}>`

  const hook = chromeWidgetLiveHook(kind)
  let next = attrs

  if (hook === 'chat') {
    next = ensureFlag(next, 'data-nanoai-open-chat')
    return `<${tag}${next}>`
  }

  if (hook === 'search-image') {
    next = setAttr(next, 'data-pw-image-search', '1')
    return `<${tag}${next}>`
  }

  if (hook === 'categories') {
    next = setAttr(next, 'data-pw-cat-toggle', '1')
    next = setAttr(next, 'data-pw-el', 'cat-toggle')
    return `<${tag}${next}>`
  }

  if (hook === 'contact') {
    next = setAttr(next, 'data-pw-contact-channel', kind === 'chat-zalo' ? 'zalo' : 'facebook')
    return `<${tag}${next}>`
  }

  if (hook === 'topup' || hook === 'search') {
    return `<${tag}${next}>`
  }

  if (hook === 'try-on') {
    next = ensureFlag(next, 'data-nanoai-try-on')
    return `<${tag}${next}>`
  }

  if (hook === 'favorite') {
    next = ensureFlag(next, 'data-pw-favorite')
    return `<${tag}${next}>`
  }

  if (hook === 'add-cart') {
    next = ensureFlag(next, 'data-pw-add-cart')
    if (!hasAttr(next, 'data-pw-el')) next = setAttr(next, 'data-pw-el', 'card-cart')
    return `<${tag}${next}>`
  }

  if (hook === 'buy-now') {
    next = ensureFlag(next, 'data-pw-buy')
    if (!hasAttr(next, 'data-pw-el')) next = setAttr(next, 'data-pw-el', 'buy')
    return `<${tag}${next}>`
  }

  if (siteSlug && tag.toLowerCase() === 'a') {
    const href = chromeWidgetHref(kind, siteSlug)
    if (href && href !== '#') {
      next = setAttr(next, 'href', href)
      if (kind === 'account' || kind === 'login') {
        next = setAttr(next, 'data-pw-account-fallback-href', href)
      }
    }
  }

  if (kind === 'cart') next = setAttr(next, 'data-pw-el', 'cart')
  if (kind === 'account') next = setAttr(next, 'data-pw-el', 'account')
  if (chromeCountBadgeKindFromAttr(kind)) {
    next = setAttr(next, 'data-pw-chrome-count', '1')
  }

  return `<${tag}${next}>`
}

function stampChromeBtnTags(html: string, siteSlug: string): string {
  return html.replace(
    /<(a|button)\b([^>]*\bdata-pw-chrome-btn\s*=\s*["']([^"']+)["'][^>]*)>/gi,
    (_full, tag: string, attrs: string, kind: string) => stampChromeBtnOpenTag(tag, attrs, kind, siteSlug)
  )
}

function stampImageSearchButtons(html: string): string {
  return html.replace(
    /<(button|a)\b([^>]*(?:\bdata-pw-image-search\b|\bpw-search-image-btn\b|\bpw-shop-search-image\b)[^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      if (hasAttr(attrs, 'data-pw-image-search')) return full
      return `<${tag}${setAttr(attrs, 'data-pw-image-search', '1')}>`
    }
  )
}

function stampCategoryToggles(html: string): string {
  return html.replace(
    /<(button|a)\b([^>]*(?:\bdata-pw-el\s*=\s*["']cat-toggle["']|\bdata-pw-cat-toggle\b|\bpw-cat-btn\b|\bpw-shop-cat-btn\b)[^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      let next = attrs
      if (!hasAttr(next, 'data-pw-cat-toggle')) next = setAttr(next, 'data-pw-cat-toggle', '1')
      if (!hasAttr(next, 'data-pw-el')) next = setAttr(next, 'data-pw-el', 'cat-toggle')
      return next === attrs ? full : `<${tag}${next}>`
    }
  )
}

function stampSearchForms(html: string): string {
  return html.replace(
    /<form\b([^>]*(?:\bdata-pw-search-form\b|\brole\s*=\s*["']search["']|\bpw-search-form\b|\bpw-shop-search-form\b)[^>]*)>/gi,
    (full, attrs: string) => {
      let next = attrs
      if (!hasAttr(next, 'data-pw-search-form')) next = ensureFlag(next, 'data-pw-search-form')
      if (!hasAttr(next, 'role')) next = setAttr(next, 'role', 'search')
      return next === attrs ? full : `<form${next}>`
    }
  )
}

function stampElRoleHrefs(html: string, siteSlug: string): string {
  if (!siteSlug) return html
  return html.replace(/<a\b([^>]*\bdata-pw-el\s*=\s*["'](cart|account)["'][^>]*)>/gi, (full, attrs: string, el: string) => {
    const href = el === 'cart' ? partnerSiteCartPath(siteSlug) : partnerSiteAccountPath(siteSlug)
    const next = setAttr(attrs, 'href', href)
    return next === attrs ? full : `<a${next}>`
  })
}

/**
 * Serve-time: every Thêm-phần-tử chrome widget gets shop routes / API hooks.
 * New templates and old saved HTML both go through this — do not patch one shop's HTML.
 */
export function stampPartnerSiteChromeWidgetHooksInHtml(
  html: string,
  input?: { siteSlug?: string | null }
): string {
  if (!html.trim()) return html
  const siteSlug = input?.siteSlug?.trim() ?? ''
  let out = stampPartnerSiteChatOpenAttrsInHtml(html)
  out = stampChromeBtnTags(out, siteSlug)
  out = stampImageSearchButtons(out)
  out = stampCategoryToggles(out)
  out = stampSearchForms(out)
  out = stampElRoleHrefs(out, siteSlug)
  return out
}
