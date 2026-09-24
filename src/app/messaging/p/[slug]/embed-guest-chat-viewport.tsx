import type { ReactNode } from 'react'
import { headers } from 'next/headers'

function firstSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key]
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v ?? '').trim()
}

/**
 * `?embed=1` trong **tab trình duyệt** (không phải trong iframe shop) → thêm khung bo tròn giống popup.
 * Trong iframe (Sec-Fetch-Dest: iframe) → false để vẫn full khung như FloatingChatWidget / nanoai-chat-widget.
 */
function embedQueryOn(sp: Record<string, string | string[] | undefined>): boolean {
  const ev = firstSearchParam(sp, 'embed').toLowerCase()
  return ev === '1' || ev === 'true' || ev === 'yes'
}

export function guestChatEmbedPopupChrome(
  sp: Record<string, string | string[] | undefined>
): boolean {
  if (!embedQueryOn(sp)) return false
  const dest = (headers().get('sec-fetch-dest') || '').toLowerCase()
  return dest === 'document'
}

/** Paint khung chat ngay từ HTML — không chờ useEffect mới biết đang nhúng. */
export function guestChatEmbedFlags(sp: Record<string, string | string[] | undefined>): {
  initialEmbedUi: boolean
  initialGuestInIframe: boolean
} {
  const dest = (headers().get('sec-fetch-dest') || '').toLowerCase()
  const initialGuestInIframe = dest === 'iframe'
  return {
    initialEmbedUi: embedQueryOn(sp) || initialGuestInIframe,
    initialGuestInIframe,
  }
}

export function EmbedGuestChatViewport({
  popupChrome,
  children,
}: {
  popupChrome: boolean
  children: ReactNode
}) {
  if (!popupChrome) {
    return <div className="h-[100dvh] overflow-hidden bg-background">{children}</div>
  }
  return (
    <div className="flex min-h-[100dvh] items-stretch justify-center bg-black/30 sm:items-center sm:bg-black/40 sm:p-4 dark:bg-black/50">
      <div
        className={
          'flex w-full max-w-[min(100vw,400px)] flex-col overflow-hidden bg-background shadow-2xl ' +
          'h-[100dvh] max-h-[100dvh] rounded-none border-0 sm:h-[min(90dvh,640px)] sm:max-h-[min(90dvh,640px)] sm:rounded-2xl sm:border sm:border-border/55'
        }
      >
        {children}
      </div>
    </div>
  )
}
