import type { CSSProperties } from 'react'
import type { WeddingTextFont, WeddingTextStyle } from '@/lib/wedding/wedding-section-config'

export const WEDDING_TEXT_FONT_FAMILY: Record<WeddingTextFont, string> = {
  script: '"Dancing Script", cursive',
  soft: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  formal: 'Georgia, "Times New Roman", Times, serif',
  lotus: '"Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif',
}

export const WEDDING_TEXT_SIZES = [18, 24, 32, 40, 52] as const

export const WEDDING_TEXT_COLORS = ['#3a2a2e', '#9f1239', '#be185d', '#b45309', '#1f2937', '#ffffff'] as const

export function weddingTextCss(style: WeddingTextStyle | undefined): CSSProperties {
  if (!style) return {}
  return {
    fontSize: style.size ? `${style.size}px` : undefined,
    lineHeight: style.size ? 1.25 : undefined,
    fontFamily: style.font ? WEDDING_TEXT_FONT_FAMILY[style.font] : undefined,
    color: style.color,
  }
}
