/** sessionStorage trên domain trang host (shop) — không dùng cookie. */
export const NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF = 'nanoai_return_chat_iframe_href_v1'

export function readReturnChatIframeHref(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF)?.trim() ?? ''
    return raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

export function writeReturnChatIframeHref(href: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF, href.trim())
  } catch {
    /* quota / private mode */
  }
}

export function clearReturnChatIframeHref(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(NANOAI_SESSION_RETURN_CHAT_IFRAME_HREF)
  } catch {
    /* ignore */
  }
}
