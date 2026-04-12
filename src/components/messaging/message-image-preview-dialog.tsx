'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'

/** Xem ảnh full màn hình trên cùng trang (không mở tab / không chuyển URL). */
export function MessageImagePreviewDialog({
  src,
  onOpenChange,
}: {
  src: string | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={Boolean(src)} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[96vh] max-w-[min(100vw,1280px)] gap-0 border-0 bg-transparent p-3 shadow-none sm:max-w-[min(100vw,1280px)] [&>button]:right-3 [&>button]:top-3 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-black/55 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/75 [&>button]:focus:ring-white/40"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="mx-auto max-h-[min(88vh,920px)] w-auto max-w-full object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
