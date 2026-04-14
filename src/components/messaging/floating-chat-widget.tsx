'use client'

import { useMemo, useRef, useState } from 'react'
import { Maximize2, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  chatUrl: string
  title: string
  shopName: string
  /** Logo shop trên nút nổi khi đóng — chỉ hiển thị **tròn** (`rounded-full` + `object-cover`). Không dùng trong header khi mở. */
  launcherLogoUrl?: string | null
  loading?: 'lazy' | 'eager'
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy']
  openLabel: string
  closeLabel: string
  openFullPageLabel: string
}

export function FloatingChatWidget({
  chatUrl,
  title,
  shopName,
  launcherLogoUrl,
  loading,
  referrerPolicy,
  openLabel,
  closeLabel,
  openFullPageLabel,
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

  const launcherSrc = typeof launcherLogoUrl === 'string' ? launcherLogoUrl.trim() : ''
  const showLauncherLogo = Boolean(launcherSrc && /^https?:\/\//i.test(launcherSrc))

  if (closed) {
    if (showLauncherLogo) {
      return (
        <button
          type="button"
          className={`fixed ${anchorClass} ${topLayerClass} h-14 w-14 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
          onClick={() => setClosed(false)}
          title={openLabel}
          aria-label={openLabel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={launcherSrc}
            alt=""
            className="pointer-events-none h-full w-full object-cover object-center select-none"
          />
        </button>
      )
    }
    return (
      <button
        type="button"
        className={`fixed ${anchorClass} ${topLayerClass} flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/95 p-0 shadow-lg transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        onClick={() => setClosed(false)}
        title={openLabel}
        aria-label={openLabel}
      >
        <MessageCircle className="h-7 w-7 text-muted-foreground" aria-hidden />
      </button>
    )
  }

  return (
    <div
      className={`fixed ${anchorClass} ${topLayerClass} h-[min(70vh,560px)] w-[min(92vw,380px)] overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2 py-2 sm:px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{shopName}</div>
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

