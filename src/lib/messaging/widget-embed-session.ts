/** Storage trên domain trang host (shop) — không dùng cookie để tránh bị chặn trong iframe bên thứ ba. */
export const NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF = 'nanoai_return_chat_iframe_href_v1'
export const NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF = 'nanoai_persist_chat_iframe_href_v1'

export function readReturnChatIframeHref(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      window.localStorage.getItem(NANOAI_PERSIST_RETURN_CHAT_IFRAME_HREF)?.trim()
      || window.sessionStorage.getItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF)?.trim()
      || ''
    return raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

export function writeReturnChatIframeHref(href: string): void {
  if (typeof window === 'undefined') return
  try {
    const next = href.trim()
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
