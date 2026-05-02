'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

const MIN_SCALE = 1
const MAX_SCALE = 4

/** Ảnh trong dialog: pinch 2 ngón để zoom, 1 ngón kéo khi đã zoom. */
function PinchZoomImage({ src, className }: { src: string; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)

  const pinchRef = useRef<{
    initialDist: number
    initialScale: number
    initialX: number
    initialY: number
  } | null>(null)

  const panRef = useRef<{
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  useEffect(() => {
    setScale(1)
    setX(0)
    setY(0)
    pinchRef.current = null
    panRef.current = null
  }, [src])

  /** Chặn scroll/gesture mặc định khi pinch để zoom chỉ áp vào ảnh. */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault()
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        panRef.current = null
        const d = touchDistance(e.touches[0], e.touches[1])
        pinchRef.current = {
          initialDist: Math.max(d, 1),
          initialScale: scale,
          initialX: x,
          initialY: y,
        }
        return
      }
      if (e.touches.length === 1 && scale > MIN_SCALE + 0.02) {
        pinchRef.current = null
        const t = e.touches[0]
        panRef.current = {
          startClientX: t.clientX,
          startClientY: t.clientY,
          startX: x,
          startY: y,
        }
      }
    },
    [scale, x, y]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null
      }
      if (pinchRef.current && e.touches.length === 2) {
        e.preventDefault()
        const d = touchDistance(e.touches[0], e.touches[1])
        const { initialDist, initialScale } = pinchRef.current
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale * (d / initialDist)))
        setScale(next)
        if (next <= MIN_SCALE + 0.02) {
          setX(0)
          setY(0)
        }
        return
      }
      if (panRef.current && e.touches.length === 1 && scale > MIN_SCALE + 0.02) {
        e.preventDefault()
        const t = e.touches[0]
        const { startClientX, startClientY, startX, startY } = panRef.current
        setX(startX + (t.clientX - startClientX))
        setY(startY + (t.clientY - startClientY))
      }
    },
    [scale]
  )

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null
    panRef.current = null
    setScale((s) => {
      if (s < MIN_SCALE + 0.05) {
        setX(0)
        setY(0)
        return MIN_SCALE
      }
      return s
    })
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative flex max-h-[min(88vh,920px)] w-full touch-none select-none items-center justify-center overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={className}
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  )
}

/** Xem ảnh full màn hình trên cùng trang (không mở tab / không chuyển URL). */
export function MessageImagePreviewDialog({
  src,
  onOpenChange,
  download,
}: {
  src: string | null
  onOpenChange: (open: boolean) => void
  /** Khi có: hiện nút tải ảnh (fetch blob để tránh CORS chặn thuộc tính `download` trên URL ngoài). */
  download?: { label: string; filename: string } | null
}) {
  const [downloadBusy, setDownloadBusy] = useState(false)

  useEffect(() => {
    setDownloadBusy(false)
  }, [src])

  const handleDownload = useCallback(async () => {
    if (!src || !download) return
    setDownloadBusy(true)
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = download.filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(obj)
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadBusy(false)
    }
  }, [src, download])

  return (
    <Dialog open={Boolean(src)} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[96vh] max-w-[min(100vw,1280px)] gap-0 border-0 bg-transparent p-3 shadow-none sm:max-w-[min(100vw,1280px)] [&>button]:right-3 [&>button]:top-3 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-black/55 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/75 [&>button]:focus:ring-white/40"
      >
        {src ? (
          <div className="flex w-full flex-col gap-3">
            <PinchZoomImage src={src} className="mx-auto max-h-[min(88vh,920px)] w-auto max-w-full object-contain" />
            {download ? (
              <div className="flex justify-center px-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2 bg-white/90 text-foreground hover:bg-white dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
                  disabled={downloadBusy}
                  onClick={() => void handleDownload()}
                >
                  {downloadBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {download.label}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
