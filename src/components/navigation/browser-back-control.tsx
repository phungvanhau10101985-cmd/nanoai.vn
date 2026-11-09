'use client'

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Về trang vừa mở. Chỉ khi tab không có lịch sử mới dùng đường dẫn dự phòng. */
export function goToPreviousPage(fallbackHref?: string) {
  if (typeof window === 'undefined') return
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  if (fallbackHref) window.location.assign(fallbackHref)
}

/** Nút outline + mũi tên — cùng style với shell công cụ tạo ảnh. */
export function BrowserBackButton({
  label,
  className,
  fallbackHref,
}: {
  label: ReactNode
  className?: string
  fallbackHref?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'w-full touch-manipulation justify-start gap-2 lg:w-auto lg:shrink-0',
        className
      )}
      onClick={() => goToPreviousPage(fallbackHref)}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  )
}

/** Kiểu liên kết văn bản (vd. « Về danh sách) — gọi lịch sử trình duyệt. */
export function BrowserBackTextButton({
  children,
  className,
  fallbackHref,
}: {
  children: ReactNode
  className?: string
  fallbackHref?: string
}) {
  return (
    <button type="button" className={cn(className)} onClick={() => goToPreviousPage(fallbackHref)}>
      {children}
    </button>
  )
}
