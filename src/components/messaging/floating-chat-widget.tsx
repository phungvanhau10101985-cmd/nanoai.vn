'use client'

import { useMemo, useRef, useState } from 'react'
import { Maximize2, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NANOAI_WIDGET_MSG_SOURCE } from '@/lib/messaging/widget-parent-bridge'

type Props = {
  chatUrl: string
  title: string
  shopName: string
  loading?: 'lazy' | 'eager'
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy']
  openLabel: string
  closeLabel: string
  openFullPageLabel: string
  /** Nút «Đơn hàng của tôi» — gửi postMessage vào iframe chat. */
  myOrdersLabel: string
}

export function FloatingChatWidget({
  chatUrl,
  title,
  shopName,
  loading,
  referrerPolicy,
  openLabel,
  closeLabel,
  openFullPageLabel,
  myOrdersLabel,
}: Props) {
  const [closed, setClosed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Keep NanoAI widget above common social/contact bubbles (e.g. Zalo).
  const anchorClass = 'bottom-[10.5rem] right-3 md:bottom-6 md:right-4'
  const topLayerClass = 'z-[2147483000]'

  const fullPageUrl = useMemo(() => {
    try {
      const url = new URL(chatUrl)
      url.searchParams.delete('embed')
      return url.toString()
    } catch {
      return chatUrl
    }
  }, [chatUrl])

  const postOpenMyOrdersToIframe = () => {
    try {
      const w = iframeRef.current?.contentWindow
      if (!w) return
      w.postMessage({ source: NANOAI_WIDGET_MSG_SOURCE, type: 'OPEN_MY_ORDERS' } as const, window.location.origin)
    } catch {
      /* ignore */
    }
  }

  if (closed) {
    return (
      <Button
        type="button"
        size="sm"
        className={`fixed ${anchorClass} ${topLayerClass} h-10 rounded-full px-3 shadow-xl`}
        onClick={() => setClosed(false)}
        title={openLabel}
      >
        <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
        {openLabel}
      </Button>
    )
  }

  return (
    <div
      className={`fixed ${anchorClass} ${topLayerClass} h-[min(70vh,560px)] w-[min(92vw,380px)] overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2 py-2 sm:px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{shopName}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 whitespace-nowrap px-2 text-[11px] font-medium sm:px-2.5 sm:text-xs"
          onClick={postOpenMyOrdersToIframe}
          title={myOrdersLabel}
        >
          {myOrdersLabel}
        </Button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(fullPageUrl, '_blank', 'noopener,noreferrer')}
            title={openFullPageLabel}
            aria-label={openFullPageLabel}
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setClosed(true)}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="h-[calc(100%-49px)] overflow-hidden rounded-b-xl">
        <iframe
          ref={iframeRef}
          src={chatUrl}
          title={title}
          loading={loading}
          referrerPolicy={referrerPolicy}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  )
}

