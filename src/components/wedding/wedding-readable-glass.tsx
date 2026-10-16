'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'

type Props = {
  theme: WeddingTheme
  className?: string
  children: ReactNode
  id?: string
  /** Hero / mở thiệp: vignette mạnh hơn ở vùng chữ */
  strength?: 'hero' | 'section'
  /** Khối trượt lên một lần khi khách cuộn tới, nếu thiệp bật hiệu ứng. */
  reveal?: boolean
}

/** Khối chữ nội dung thiệp: không phủ nền, ảnh thiệp hiện xuyên suốt. */
export function WeddingReadableGlass({ className, children, id, reveal }: Props) {
  return (
    <div
      id={id}
      data-wedding-reveal={reveal ? '' : undefined}
      className={cn('relative isolate bg-transparent shadow-none', className)}
      style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="relative z-10 w-full min-w-0 [container-type:inline-size]">{children}</div>
    </div>
  )
}
