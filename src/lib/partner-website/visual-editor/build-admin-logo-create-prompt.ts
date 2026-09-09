import { buildChatIconLogoPrompt } from '@/lib/partner-website/visual-editor/build-chat-icon-logo-prompt'
import type { PartnerWebsiteLogoSlot } from '@/lib/partner-website/visual-editor/apply-slot-logo'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

/** Prompt tạo logo trên quản trị: mỗi ô có mặc định; gợi ý text + ảnh tham khảo đều tùy chọn. */
export function buildAdminLogoCreatePrompt(input: {
  slot: PartnerWebsiteLogoSlot
  shopTitle?: string | null
  extra?: string | null
  hasReference?: boolean
  device?: VisualDeviceVariant | null
}): string {
  const title = String(input.shopTitle || 'Shop').trim() || 'Shop'
  const extra = String(input.extra || '').trim()
  const device = input.device || 'desktop'
  if (input.slot === 'chat') {
    return buildChatIconLogoPrompt({
      shopTitle: title,
      extra,
      hasReference: Boolean(input.hasReference),
    })
  }
  const parts: string[] = []
  if (input.slot === 'favicon') {
    parts.push(
      `Square favicon PNG for "${title}". 1:1, simple high-contrast mark, readable at 16-32px, no tiny text, fill the frame, isolated on a flat background so it can be cut to a transparent PNG.`
    )
  } else if (input.slot === 'header') {
    parts.push(
      `Website header logo for "${title}" (${device}). Clean brand mark, high contrast, readable at small size, isolated on a flat background for a transparent PNG.`
    )
  } else {
    parts.push(
      `Website footer logo for "${title}" (${device}). Clean brand mark, high contrast, readable at small size, isolated on a flat background for a transparent PNG.`
    )
  }
  if (input.hasReference) {
    parts.push('A reference image is attached. Follow its style, colors, and marks.')
  }
  if (extra) parts.push(`Optional user request: ${extra}`)
  return parts.join(' ')
}
