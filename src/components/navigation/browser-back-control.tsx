'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Nút outline + mũi tên — cùng style với shell công cụ tạo ảnh. */
export function BrowserBackButton({
  label,
  className,
}: {
  label: ReactNode
  className?: string
}) {
  const router = useRouter()
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'w-full touch-manipulation justify-start gap-2 lg:w-auto lg:shrink-0 lg:border-border/80 lg:bg-background/90',
        className
      )}
      onClick={() => router.back()}
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
}: {
  children: ReactNode
  className?: string
}) {
  const router = useRouter()
  return (
    <button type="button" className={cn(className)} onClick={() => router.back()}>
      {children}
    </button>
  )
}
