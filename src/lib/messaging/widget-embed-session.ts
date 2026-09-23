import { isChatWidgetScriptSrc, isHostedChatIframeSrc } from '@/lib/messaging/parse-site-chat-embed'

/** Storage trên domain trang host (shop) — không dùng cookie để tránh bị chặn trong iframe bên thứ ba. */
export const NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF = 'nanoai_return_chat_iframe_href_v1'
export const NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF = 'nanoai_persist_chat_iframe_href_v1'

function isPersistableChatIframeHref(href: string): boolean {
  const next = href.trim()
  if (!next) return false
  if (isChatWidgetScriptSrc(next)) return false
  return isHostedChatIframeSrc(next)
}

/** URL iframe đã lưu chỉ được mở lại khi cùng origin với chat đang cấu hình. */
export function chatIframeHrefMatchesConfiguredUrl(storedHref: string, configuredChatUrl: string): boolean {
  const storedRaw = storedHref.trim()
  const configuredRaw = configuredChatUrl.trim()
  if (!storedRaw || !configuredRaw) return false
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://nanoai.invalid/'
    return new URL(storedRaw, base).origin === new URL(configuredRaw, base).origin
  } catch {
    return false
  }
}

export function readReturnChatIframeHref(configuredChatUrl?: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      window.localStorage.getItem(NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF)?.trim()
      || window.sessionStorage.getItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF)?.trim()
      || ''
    if (!raw) return null
    if (!isPersistableChatIframeHref(raw)) {
      clearReturnChatIframeHref()
      return null
    }
    if (configuredChatUrl && !chatIframeHrefMatchesConfiguredUrl(raw, configuredChatUrl)) {
      clearReturnChatIframeHref()
      return null
    }
    return raw
  } catch {
    return null
  }
}

export function writeReturnChatIframeHref(href: string, configuredChatUrl?: string): void {
  if (typeof window === 'undefined') return
  try {
    const next = href.trim()
    if (!isPersistableChatIframeHref(next)) return
    if (
      configuredChatUrl
      && /^https?:\/\//i.test(next)
      && !chatIframeHrefMatchesConfiguredUrl(next, configuredChatUrl)
    ) {
      return
    }
    window.sessionStorage.setItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF, next)
    window.localStorage.setItem(NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF, next)
  } catch {
    /* quota / private mode */
  }
}

export function clearReturnChatIframeHref(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF)
    window.localStorage.removeItem(NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF)
  } catch {
    /* ignore */
  }
}
