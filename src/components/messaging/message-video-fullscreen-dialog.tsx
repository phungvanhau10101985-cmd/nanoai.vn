'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  resolveGuestProductVideoPlayback,
} from '@/lib/messaging/guest-product-video'

/** Xem video sản phẩm gần toàn màn hình; nút đóng (X) theo Dialog. */
export function MessageVideoFullscreenDialog({
  src,
  onOpenChange,
  closeLabel,
}: {
  src: string | null
  onOpenChange: (open: boolean) => void
  /** Nhãn a11y cho nút đóng (tuỳ locale). */
  closeLabel?: string
}) {
  const open = Boolean(src)
  const playback = src ? resolveGuestProductVideoPlayback(src) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[100dvh] max-w-[100dvw] gap-0 border-0 bg-black p-0 shadow-none sm:max-w-[100dvw] [&>button]:right-3 [&>button]:top-3 [&>button]:z-[60] [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-white/15 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/25 [&>button]:focus:ring-white/40"
        aria-label={closeLabel?.trim() || 'Đóng video'}
      >
        {playback?.kind === 'youtube' ? (
          <div className="relative aspect-video w-[min(100vw,1280px)] max-h-[min(100dvh,100%)] bg-black">
            <iframe
              title="Video"
              src={playback.embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : playback?.kind === 'video' ? (
          <video
            className="max-h-[min(92dvh,920px)] w-full max-w-[min(100vw,1280px)] bg-black object-contain"
            src={playback.src}
            controls
            playsInline
            autoPlay
          />
        ) : src ? (
          <p className="px-6 py-10 text-center text-sm text-white/90">
            Không phát được định dạng video này trong trang.{' '}
            <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Mở liên kết
            </a>
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
