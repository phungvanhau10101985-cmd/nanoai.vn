'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { weddingTextPlateStyle, type WeddingTheme } from '@/lib/wedding/wedding-theme'

type Props = {
  theme: WeddingTheme
  className?: string
  children: ReactNode
  id?: string
  /** Hero: giữa đậm hơn một chút so với khối mục. */
  strength?: 'hero' | 'section'
  /** Khối trượt lên một lần khi khách cuộn tới, nếu thiệp bật hiệu ứng. */
  reveal?: boolean
  /** Nền chữ radial. Tắt trên vỏ bìa, nơi ảnh và khung đã có lớp riêng. */
  plate?: boolean
}

/** Khối chữ nội dung thiệp: hai mép trái phải trong suốt, giữa đậm nhất. */
export function WeddingReadableGlass({ className, children, id, reveal, theme, strength = 'section', plate = true }: Props) {
  return (
    <div
      id={id}
      data-wedding-reveal={reveal ? '' : undefined}
      className={cn('relative isolate bg-transparent shadow-none', className)}
      style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      {plate ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={weddingTextPlateStyle(theme.id, strength)}
        />
      ) : null}
      <div className="relative z-10 w-full min-w-0 [container-type:inline-size]">{children}</div>
    </div>
  )
}
