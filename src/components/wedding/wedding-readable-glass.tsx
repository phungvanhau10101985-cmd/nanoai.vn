'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  children: ReactNode
  id?: string
  /** Khối trượt lên một lần khi khách cuộn tới, nếu thiệp bật hiệu ứng. */
  reveal?: boolean
  /** Chủ đề thiệp — nhịp mở vỏ đọc biến trên khối này. */
  themeId?: string
}

/** Khối chữ nội dung thiệp, không có tấm nền riêng. */
export function WeddingReadableGlass({ className, children, id, reveal, themeId }: Props) {
  return (
    <div
      id={id}
      data-wedding-glass=""
      data-wedding-reveal={reveal ? '' : undefined}
      data-cover-theme={themeId || undefined}
      className={cn('relative shadow-none', className)}
      style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="relative w-full min-w-0 [container-type:inline-size]">{children}</div>
    </div>
  )
}
