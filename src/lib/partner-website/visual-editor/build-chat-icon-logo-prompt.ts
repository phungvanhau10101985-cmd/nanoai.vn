/** Prompt mặc định tạo icon Chat mua — vòng tròn stamp, không túi viền mờ. */
export const CHAT_ICON_LOGO_DEFAULT_PROMPT =
  'OUTPUT must be a 1:1 ROUND STAMP / APP-ICON BADGE (circular sticker), filling about 90% of the square. Layout inside a THICK SOLID circular RING: (1) this shop’s brand mark at the TOP as a small SOLID filled symbol, (2) large bold SOLID filled Vietnamese "tư vấn" in the CENTER (sentence case, not outlined, not all-caps stroke), (3) smaller SOLID filled Vietnamese "nhắn tin" under it. Interior of the circle is a clean WHITE or very light fill so the lettering reads; ring, mark, and words are strong solid brand color. Both lines must stay readable at about 36–48px. FORBIDDEN: shopping-bag silhouette as the outer shape, outline-only / pale line art, washed white drawing on grey, uppercase outlined "TƯ VẤN", letterboxing, extra English, phone mockup, square card instead of a circle.'

export function persistableHttpLogoUrl(url?: string | null): string {
  const s = String(url || '').trim()
  return /^https?:\/\//i.test(s) ? s : ''
}

function hexFromColor(raw?: string | null): string {
  const s = String(raw || '').trim()
  const m6 = s.match(/^#?([0-9a-fA-F]{6})$/)
  if (m6) return `#${m6[1].toLowerCase()}`
  const m3 = s.match(/^#?([0-9a-fA-F]{3})$/)
  if (m3) {
    const [a, b, c] = m3[1].toLowerCase().split('')
    return `#${a}${a}${b}${b}${c}${c}`
  }
  return ''
}

function hexLuminance(hex: string): number {
  const n = hex.replace('#', '')
  if (n.length !== 6) return 1
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Màu mực vòng/chữ icon chat: cho phép lòng vòng trắng. Không dùng «ONLY these colors». */
export function buildChatIconInkFacts(colors: { main?: string | null; accent?: string | null }): string {
  const main = hexFromColor(colors.main)
  const accent = hexFromColor(colors.accent)
  if (!main || hexLuminance(main) >= 0.85) {
    return 'Brand ink for the ring, shop mark, and lettering should be a saturated solid color (from the attached shop mark if present). The INSIDE of the circle stays white or very light. Forbidden: pale outlines, white-on-grey line art.'
  }
  const extra = accent && accent !== main && hexLuminance(accent) < 0.85 ? ` Supporting ink ${accent}.` : ''
  return `SOLID brand ink for the circular RING, shop mark, and "tư vấn"/"nhắn tin" lettering: ${main}.${extra} The INSIDE of the circle MUST stay a clean white or very light fill so the text reads. Do not flood the whole square with brand color. Forbidden: outline-only strokes.`
}

/** Ảnh tham khảo icon chat: ảnh user tải → logo shop → icon chat đang có. */
export function resolveChatIconStyleReferenceUrl(input: {
  userRef?: string | null
  shopLogoUrl?: string | null
  chatIconUrl?: string | null
}): string {
  return (
    persistableHttpLogoUrl(input.userRef) ||
    persistableHttpLogoUrl(input.shopLogoUrl) ||
    persistableHttpLogoUrl(input.chatIconUrl)
  )
}

export function collectChatIconStyleReferencesFromForm(input: {
  formRef?: string | null
  shopLogoUrl?: string | null
  chatIconUrl?: string | null
}): { urls: string[]; meta: Array<{ screenKey: string; label: string }> } {
  const formRef = persistableHttpLogoUrl(input.formRef)
  const shopLogo = persistableHttpLogoUrl(input.shopLogoUrl)
  if (formRef && formRef !== shopLogo) {
    return collectChatIconStyleReferences({ userRef: formRef })
  }
  return collectChatIconStyleReferences({
    shopLogoUrl: shopLogo || formRef,
    chatIconUrl: input.chatIconUrl,
  })
}

export function collectChatIconStyleReferences(input: {
  userRef?: string | null
  shopLogoUrl?: string | null
  chatIconUrl?: string | null
}): { urls: string[]; meta: Array<{ screenKey: string; label: string }> } {
  const userRef = persistableHttpLogoUrl(input.userRef)
  if (userRef) {
    return {
      urls: [userRef],
      meta: [{ screenKey: 'chat_icon_style', label: 'Chat mua icon style reference' }],
    }
  }
  const shopLogo = persistableHttpLogoUrl(input.shopLogoUrl)
  if (shopLogo) {
    return {
      urls: [shopLogo],
      meta: [{ screenKey: 'chat_icon_shop_mark', label: 'Shop brand mark for circular chat badge' }],
    }
  }
  const chatIcon = persistableHttpLogoUrl(input.chatIconUrl)
  if (chatIcon) {
    return {
      urls: [chatIcon],
      meta: [{ screenKey: 'chat_icon_style', label: 'Previous circular chat badge' }],
    }
  }
  return { urls: [], meta: [] }
}

export function buildChatIconLogoPrompt(input: {
  shopTitle?: string | null
  extra?: string | null
  hasReference?: boolean
  colorFacts?: string | null
}): string {
  const title = String(input.shopTitle || 'Shop').trim() || 'Shop'
  const extra = String(input.extra || '').trim()
  const parts = [
    `Round Chat mua / messaging stamp icon for shop "${title}".`,
    CHAT_ICON_LOGO_DEFAULT_PROMPT,
    `The top mark must come from this shop’s name "${title}" (symbol, short word, or number people already know). Keep that mark INSIDE the circular ring. Do not replace the whole icon with a generic shopping-bag drawing even if the shop sells bags — the bag may only appear as a tiny mark at the top, and large "tư vấn" / small "nhắn tin" must still dominate.`,
  ]
  if (input.hasReference) {
    parts.push(
      'A reference image is attached. Reuse its COLORS and brand marks (lotus, letters, numbers) INSIDE this new circular stamp. If the reference is a wide header lockup or a shopping bag, extract only the mark and palette — rearrange into the round badge. Keep the large "tư vấn" / small "nhắn tin" hierarchy. Do not turn the icon into outline-only line art.'
    )
  }
  const colorFacts = String(input.colorFacts || '').trim()
  if (colorFacts) {
    parts.push(colorFacts)
  }
  if (extra && extra !== CHAT_ICON_LOGO_DEFAULT_PROMPT) {
    parts.push(`Optional user request: ${extra}`)
  }
  return parts.join(' ')
}
