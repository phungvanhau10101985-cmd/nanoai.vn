/** Mã nhúng chat trên site chính NanoAI: iframe `/messaging/p/…` hoặc script shop (`data-chat-url`). */

export type SiteChatEmbedPayload = {
  src: string
  title: string
  loading?: 'lazy' | 'eager'
  referrerPolicy?: string
}

function htmlAttr(raw: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = raw.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return m?.[1]?.trim() || ''
}

function parseUrlish(raw: string): URL | null {
  const t = String(raw || '').trim()
  if (!t) return null
  try {
    return new URL(t)
  } catch {
    try {
      return new URL(t, 'https://nanoai.invalid/')
    } catch {
      return null
    }
  }
}

/** File widget JS — không được dùng làm `src` iframe (trình duyệt hiện mã nguồn). */
export function isChatWidgetScriptSrc(url: string): boolean {
  const parsed = parseUrlish(url)
  const path = (parsed?.pathname || String(url || '')).toLowerCase()
  return path.endsWith('.js') || path.includes('nanoai-chat-widget.js')
}

/** Trang chat khách — URL iframe hợp lệ. */
export function isHostedChatIframeSrc(url: string): boolean {
  const raw = String(url || '').trim()
  if (!raw || isChatWidgetScriptSrc(raw)) return false
  const parsed = parseUrlish(raw)
  const path = parsed?.pathname || raw
  return /\/messaging\/p\//i.test(path)
}

/**
 * Đọc ô «Mã nhúng chat NanoAI».
 * Script shop lấy `data-chat-url`; iframe lấy `src` trang chat. Không nhận file `.js`.
 */
export function parseSiteChatEmbed(raw: string): SiteChatEmbedPayload | null {
  const source = String(raw || '').trim()
  if (!source) return null

  const dataChatUrl = htmlAttr(source, 'data-chat-url')
  const src = htmlAttr(source, 'src')
  const iframeTitle = htmlAttr(source, 'title')
  const shopName = htmlAttr(source, 'data-shop-name')
  const loadingRaw = htmlAttr(source, 'loading').toLowerCase()
  const referrerPolicy = htmlAttr(source, 'referrerpolicy')
  const loading = loadingRaw === 'eager' ? 'eager' : 'lazy'
  const title = iframeTitle || shopName || 'Chat widget'

  if (dataChatUrl && isHostedChatIframeSrc(dataChatUrl)) {
    return {
      src: dataChatUrl,
      title,
      loading,
      referrerPolicy: referrerPolicy || 'no-referrer-when-downgrade',
    }
  }

  if (src && isHostedChatIframeSrc(src)) {
    return {
      src,
      title,
      loading,
      referrerPolicy: referrerPolicy || undefined,
    }
  }

  /** Iframe cũ trỏ URL khác `/messaging/p/` — vẫn nhận, trừ file JS. */
  if (src && !isChatWidgetScriptSrc(src)) {
    return {
      src,
      title,
      loading,
      referrerPolicy: referrerPolicy || undefined,
    }
  }

  return null
}
