import type { ReactNode } from 'react'
import type { Viewport } from 'next'

/** Giúp Chrome/Android co layout khi bật bàn phím; kết hợp visualViewport padding trong client. */
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
}

export default function PartnerGuestChatLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
