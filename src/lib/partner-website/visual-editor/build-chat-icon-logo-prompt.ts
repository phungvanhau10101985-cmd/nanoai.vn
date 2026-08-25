/** Prompt mặc định tạo logo icon Chat mua — luôn gửi, khách không cần gõ. */
export const CHAT_ICON_LOGO_DEFAULT_PROMPT =
  'This is a shop Chat mua / consult button. Required layout: large bold Vietnamese text "Tư vấn" and smaller Vietnamese text "Nhắn tin" under it. The artwork fills the entire circular icon frame edge-to-edge (bleed to the border), no padding, no letterboxing, no empty ring. Both lines must stay readable at about 36px.'

export function buildChatIconLogoPrompt(input: {
  shopTitle?: string | null
  extra?: string | null
  hasReference?: boolean
  colorFacts?: string | null
}): string {
  const title = String(input.shopTitle || '').trim()
  const extra = String(input.extra || '').trim()
  const parts = [CHAT_ICON_LOGO_DEFAULT_PROMPT]
  if (title) parts.push(`Shop name: ${title}.`)
  if (input.hasReference) {
    parts.push(
      'A reference image is attached. Follow its style, colors, and marks when they help, but keep the large "Tư vấn" / small "Nhắn tin" text hierarchy.'
    )
  }
  const colorFacts = String(input.colorFacts || '').trim()
  if (colorFacts) parts.push(colorFacts)
  if (extra && extra !== CHAT_ICON_LOGO_DEFAULT_PROMPT) {
    parts.push(`Optional user request: ${extra}`)
  }
  return parts.join(' ')
}
