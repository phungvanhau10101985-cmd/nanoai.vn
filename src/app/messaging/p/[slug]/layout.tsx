import type { ReactNode } from 'react'
import type { Viewport } from 'next'

/**
 * `overlays-content`: bàn phím chồng lên layout — `innerHeight` vs `visualViewport` chênh rõ hơn,
 * kết hợp neo ô nhập `fixed` + `bottom` (px) trong client để đẩy thanh nhập lên trên bàn phím.
 * (Một số WebView không co `100dvh` đúng với `resizes-content`.)
 */
export const viewport: Viewport = {
  interactiveWidget: 'overlays-content',
}

export default function PartnerGuestChatLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
