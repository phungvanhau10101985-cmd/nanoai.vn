import { sanitizePartnerShopCustomEmbedHtml } from '@/lib/partner-website/shop/sanitize-partner-shop-custom-embed'

/** Phone or zalo.me link → https://zalo.me/<digits>. Same rules as 188 `normalizeZaloPersonalUrl`. */
export function normalizeZaloPersonalUrl(raw: string): string | null {
  const text = String(raw ?? '').trim()
  if (!text || /[<>"']/.test(text)) return null
  const fromLink = text.match(/(?:https?:\/\/)?(?:www\.)?zalo\.me\/([0-9]{9,20})\/?/i)
  let digits = ''
  if (fromLink) {
    digits = fromLink[1]
  } else {
    let compact = text.replace(/[\s.\-()]/g, '')
    if (compact.startsWith('+')) compact = compact.slice(1)
    if (!/^\d+$/.test(compact)) return null
    digits = compact
  }
  if (digits.startsWith('84') && (digits.length === 11 || digits.length === 12)) {
    digits = `0${digits.slice(2)}`
  }
  if (!/^\d+$/.test(digits) || digits.length < 9 || digits.length > 20) return null
  if (digits.length <= 11 && !digits.startsWith('0')) {
    digits = `0${digits}`
    if (digits.length > 11) return null
  }
  return `https://zalo.me/${digits}`
}

export function normalizeChatDigitsId(raw: string, min = 6, max = 20): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < min || digits.length > max) return null
  return digits
}

export function buildFacebookCustomerChatHtml(pageId?: string | null): string {
  const id = normalizeChatDigitsId(pageId ?? '')
  if (!id) return ''
  return (
    `<div id="fb-root"></div>` +
    `<script async defer crossorigin="anonymous" src="https://connect.facebook.net/vi_VN/sdk.js#xfbml=1&version=v18.0"></script>` +
    `<div class="fb-customerchat" page_id="${id}" attribution="setup_tool"></div>`
  )
}

export type ZaloOpenMode = 'personal' | 'oa'

/** Chưa chọn: có số cá nhân thì mở số đó, không thì Official Account. */
export function resolveZaloOpenMode(
  mode: string | null | undefined,
  personalUrl?: string | null
): ZaloOpenMode {
  if (mode === 'oa' || mode === 'personal') return mode
  return normalizeZaloPersonalUrl(personalUrl || '') ? 'personal' : 'oa'
}

/** Link nút Zalo trên shop. Cá nhân ưu tiên số đã lưu; OA ưu tiên OA ID. */
export function resolvePartnerShopZaloClickUrl(input: {
  zaloOpen?: string | null
  zaloPersonalUrl?: string | null
  zaloOaId?: string | null
  contactZaloUrl?: string | null
}): string | null {
  const personal = normalizeZaloPersonalUrl(input.zaloPersonalUrl || '')
  const oaId = normalizeChatDigitsId(input.zaloOaId || '')
  const contact = String(input.contactZaloUrl ?? '').trim()
  const contactUrl = /^https?:\/\//i.test(contact) ? contact : ''
  const mode = resolveZaloOpenMode(input.zaloOpen, personal)
  if (mode === 'personal') return personal || contactUrl || null
  return (oaId ? `https://zalo.me/${oaId}` : null) || contactUrl || null
}

export function buildZaloPersonalButtonHtml(url?: string | null): string {
  const href = normalizeZaloPersonalUrl(url || '')
  if (!href) return ''
  return (
    `<a href="${href}" target="_blank" rel="noopener noreferrer" data-zalo-open="personal" ` +
    `aria-label="Nhắn Zalo cho shop" ` +
    `style="position:fixed;right:16px;bottom:16px;z-index:2147483000;display:inline-flex;` +
    `align-items:center;background:#0068FF;color:#fff;font:600 14px/1 system-ui,sans-serif;` +
    `padding:12px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,104,255,.35);` +
    `text-decoration:none">Nhắn Zalo</a>`
  )
}

export function buildZaloOaWidgetHtml(oaId?: string | null): string {
  const id = normalizeChatDigitsId(oaId ?? '')
  if (!id) return ''
  return (
    `<div class="zalo-chat-widget" data-oaid="${id}" data-welcome-message="Xin chào! Chúng tôi có thể giúp gì cho bạn?" data-autopopup="0"></div>` +
    `<script src="https://sp.zalo.me/plugins/sdk.js"></script>`
  )
}

/** Trusted chat widgets plus sanitized Zalo custom HTML, for the end of body. */
export function buildPartnerShopChatWidgetsHtml(input: {
  facebookChatPageId?: string | null
  zaloOaId?: string | null
  zaloPersonalUrl?: string | null
  zaloOpen?: string | null
  zaloCustomHtml?: string | null
}): string {
  const mode = resolveZaloOpenMode(input.zaloOpen, input.zaloPersonalUrl)
  const zalo =
    mode === 'personal'
      ? buildZaloPersonalButtonHtml(input.zaloPersonalUrl)
      : buildZaloOaWidgetHtml(input.zaloOaId)
  const parts = [
    buildFacebookCustomerChatHtml(input.facebookChatPageId),
    zalo,
    sanitizePartnerShopCustomEmbedHtml(input.zaloCustomHtml),
  ].filter(Boolean)
  return parts.join('\n')
}
